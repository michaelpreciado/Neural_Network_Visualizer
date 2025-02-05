import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { gsap } from 'gsap';

// Add custom shader for glowing lines
const glowLineVertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const glowLineFragmentShader = `
uniform vec3 color;
uniform float opacity;
varying vec2 vUv;
void main() {
    float intensity = 1.0 - pow(length(vUv - vec2(0.5, 0.5)) * 2.0, 2.0);
    gl_FragColor = vec4(color, opacity * intensity);
}`;

class NeuralNetworkVisualizer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#visualization'),
            antialias: true
        });
        
        // Enable transparency
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.camera.position.z = 15;
        
        // Create controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Create container globe
        this.createContainerGlobe();
        
        // Create neural network
        this.nodes = [];
        this.connections = [];
        this.connectionsByLayer = [];
        this.createNeuralNetwork();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Add trail system
        this.trails = [];
        this.trailDuration = 3000; // Trail duration in milliseconds
        
        // Start animation
        this.animate();
        
        // Start random node activation
        this.startRandomActivations();

        // Add keyboard listener for prompt propagation
        window.addEventListener('keydown', (event) => {
            if (event.key === 'p') {
                this.triggerPromptPropagation();
            }
        });

        // Add prompt handling
        this.setupPromptHandling();

        // Setup drawing canvas
        this.setupDrawing();
    }
    
    createContainerGlobe() {
        // Create main sphere with larger radius
        const globeRadius = 7;
        const sphereGeometry = new THREE.SphereGeometry(globeRadius, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.05  // Further reduced main sphere opacity
        });
        this.globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.globe);

        // Create minimal latitude lines
        const latitudeCount = 2;  // Reduced to just 2 lines for minimal effect
        const latitudeSpacing = Math.PI / (latitudeCount + 1);
        
        for (let i = 0; i < latitudeCount; i++) {
            const latitude = -Math.PI/2 + latitudeSpacing * (i + 1);
            const radius = globeRadius * Math.cos(latitude);
            const y = globeRadius * Math.sin(latitude);
            
            const circleGeometry = new THREE.CircleGeometry(radius, 48);
            circleGeometry.rotateX(Math.PI/2);
            circleGeometry.translate(0, y, 0);
            
            const circleMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                wireframe: true,
                transparent: true,
                opacity: 0.02  // Further reduced opacity
            });
            
            const circle = new THREE.Mesh(circleGeometry, circleMaterial);
            this.globe.add(circle);
        }

        // Create minimal longitude lines
        const longitudeCount = 3;  // Reduced to just 3 lines
        for (let i = 0; i < longitudeCount; i++) {
            const longitude = (i * Math.PI * 2) / longitudeCount;
            
            const curve = new THREE.EllipseCurve(
                0, 0,
                globeRadius, globeRadius,
                0, Math.PI * 2,
                false,
                0
            );
            
            const points = curve.getPoints(50);
            const geometryLine = new THREE.BufferGeometry().setFromPoints(points);
            
            const material = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.02  // Further reduced opacity
            });
            
            const ellipse = new THREE.Line(geometryLine, material);
            ellipse.rotation.y = longitude;
            this.globe.add(ellipse);
        }

        // Add subtle equator line with slightly higher opacity
        const equatorGeometry = new THREE.CircleGeometry(globeRadius, 64);
        equatorGeometry.rotateX(Math.PI/2);
        const equatorMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.03  // Slightly more visible than other lines
        });
        const equator = new THREE.Mesh(equatorGeometry, equatorMaterial);
        this.globe.add(equator);
    }
    
    createNeuralNetwork() {
        const layerCount = 4; // Input, 2 hidden, output
        const nodesPerLayer = [64, 32, 16, 10]; // Last layer has 10 nodes for digits 0-9
        
        // Adjusted sizes for better visibility with more nodes
        const inputNodeSize = 0.12;
        const hiddenNodeSize = 0.08;
        const outputNodeSize = 0.15; // Slightly larger output nodes
        
        // Network radius should be smaller than globe radius
        const networkInnerRadius = 4.0;
        const networkOuterRadius = 5.0;
        
        // Different colors for input and output layers
        const inputColor = 0x00ff00;  // Green for input
        const hiddenColor = 0x00ffff; // Cyan for hidden
        const outputColor = 0xff3366;  // Pink for output
        const inactiveColor = 0x334455; // Darker blue-grey for inactive nodes

        // Create nodes in a spherical arrangement
        for (let layer = 0; layer < layerCount; layer++) {
            const layerNodes = [];
            const layerAngle = (layer / (layerCount - 1)) * Math.PI - Math.PI/2;
            
            // Determine if this is input, hidden, or output layer
            const isInput = layer === 0;
            const isOutput = layer === layerCount - 1;
            const nodeSize = isInput ? inputNodeSize : (isOutput ? outputNodeSize : hiddenNodeSize);
            const baseColor = isInput ? inputColor : (isOutput ? outputColor : hiddenColor);
            
            const currentLayerSize = nodesPerLayer[layer];
            const nodesInInnerRing = Math.floor(currentLayerSize / 2);
            const nodesInOuterRing = currentLayerSize - nodesInInnerRing;
            
            // Inner ring
            for (let i = 0; i < nodesInInnerRing; i++) {
                const isInactive = !isInput && !isOutput && Math.random() < 0.3;
                const nodeColor = isInactive ? inactiveColor : baseColor;
                const node = this.createNode(
                    nodeSize,
                    nodeColor,
                    layerAngle,
                    (i / nodesInInnerRing) * Math.PI * 2,
                    networkInnerRadius,
                    isInput || isOutput,
                    isInactive
                );
                node.isInactive = isInactive;
                layerNodes.push(node);
            }
            
            // Outer ring
            for (let i = 0; i < nodesInOuterRing; i++) {
                const isInactive = !isInput && !isOutput && Math.random() < 0.3;
                const nodeColor = isInactive ? inactiveColor : baseColor;
                const node = this.createNode(
                    nodeSize,
                    nodeColor,
                    layerAngle,
                    (i / nodesInOuterRing) * Math.PI * 2,
                    networkOuterRadius,
                    isInput || isOutput,
                    isInactive
                );
                node.isInactive = isInactive;
                layerNodes.push(node);
            }
            
            this.nodes.push(layerNodes);
        }
        
        // Create glowing connections with color gradients
        for (let layer = 0; layer < layerCount - 1; layer++) {
            const layerConnections = [];
            const isFromInput = layer === 0;
            const isToOutput = layer === layerCount - 2;
            
            for (let i = 0; i < nodesPerLayer[layer]; i++) {
                for (let j = 0; j < nodesPerLayer[layer + 1]; j++) {
                    const fromNode = this.nodes[layer][i];
                    const toNode = this.nodes[layer + 1][j];
                    
                    // Skip connections if either node is inactive
                    if (fromNode.isInactive || toNode.isInactive) {
                        continue;
                    }

                    // Adjust connection probability based on node proximity
                    const distance = fromNode.position.distanceTo(toNode.position);
                    const connectionProbability = 0.2 * (1 - distance / 10);
                    
                    if (Math.random() < connectionProbability) {
                        const startPoint = fromNode.position;
                        const endPoint = toNode.position;

                        // Create the main connection line with curved path
                        const points = [];
                        const segments = 20;
                        for (let k = 0; k <= segments; k++) {
                            const t = k / segments;
                            const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
                            
                            // Add slight curve to the connection
                            const mid = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5);
                            const offset = new THREE.Vector3()
                                .subVectors(endPoint, startPoint)
                                .cross(new THREE.Vector3(0, 1, 0))
                                .normalize()
                                .multiplyScalar(Math.sin(t * Math.PI) * 0.2);
                            point.add(offset);
                            points.push(point);
                        }

                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        
                        // Determine connection color based on layers
                        let connectionColor;
                        if (isFromInput) {
                            connectionColor = new THREE.Color(inputColor);
                        } else if (isToOutput) {
                            connectionColor = new THREE.Color(outputColor);
                        } else {
                            connectionColor = new THREE.Color(hiddenColor);
                        }

                        // Create main line with reduced opacity for cleaner look
                        const lineMaterial = new THREE.LineBasicMaterial({
                            color: connectionColor,
                            transparent: true,
                            opacity: 0.15,
                            blending: THREE.AdditiveBlending
                        });
                        const line = new THREE.Line(geometry, lineMaterial);
                        
                        // Create glow effect
                        const glowMaterial = new THREE.ShaderMaterial({
                            uniforms: {
                                color: { value: connectionColor },
                                opacity: { value: 0.05 }
                            },
                            vertexShader: glowLineVertexShader,
                            fragmentShader: glowLineFragmentShader,
                            transparent: true,
                            blending: THREE.AdditiveBlending
                        });
                        const glowLine = new THREE.Line(geometry, glowMaterial);
                        glowLine.scale.multiplyScalar(1.2);

                        this.scene.add(line);
                        this.scene.add(glowLine);
                        this.connections.push(line);
                        this.connections.push(glowLine);
                        
                        layerConnections.push({
                            line,
                            glowLine,
                            fromNode: fromNode,
                            toNode: toNode
                        });
                    }
                }
            }
            this.connectionsByLayer.push(layerConnections);
        }
    }

    createNode(size, color, layerAngle, horizontalAngle, radius, isEndpoint, isInactive) {
        const nodeGeometry = new THREE.SphereGeometry(size, 16, 16);
        const nodeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: isInactive ? 0.3 : 0.8
        });

        const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
        
        // Convert to Cartesian coordinates
        const x = radius * Math.cos(layerAngle) * Math.cos(horizontalAngle);
        const y = radius * Math.sin(layerAngle);
        const z = radius * Math.cos(layerAngle) * Math.sin(horizontalAngle);
        
        node.position.set(x, y, z);

        // Add glow effect to nodes
        const glowGeometry = new THREE.SphereGeometry(size * 1.5, 16, 16);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                opacity: { value: isInactive ? 0.1 : (isEndpoint ? 0.4 : 0.3) }
            },
            vertexShader: glowLineVertexShader,
            fragmentShader: glowLineFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        node.add(glow);

        this.scene.add(node);
        return node;
    }

    activateNode(node, duration = 0.5, color = 0xffffff) {
        const originalColor = node.material.color.clone();
        const originalOpacity = node.material.opacity;

        return new Promise(resolve => {
            gsap.to(node.material, {
                duration: duration,
                opacity: 1,
                onStart: () => {
                    node.material.color.setHex(color);
                },
                onComplete: () => {
                    gsap.to(node.material, {
                        duration: duration,
                        opacity: originalOpacity,
                        onComplete: () => {
                            node.material.color.copy(originalColor);
                            resolve();
                        }
                    });
                }
            });
        });
    }

    createTrail(startPoint, endPoint, color) {
        const points = [];
        const segments = 20;
        
        // Create curved path
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
            
            // Add curve to the path
            const mid = new THREE.Vector3().lerpVectors(startPoint, endPoint, 0.5);
            const offset = new THREE.Vector3()
                .subVectors(endPoint, startPoint)
                .cross(new THREE.Vector3(0, 1, 0))
                .normalize()
                .multiplyScalar(Math.sin(t * Math.PI) * 0.2);
            point.add(offset);
            points.push(point);
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create the trail line with glow effect
        const trailMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(color) },
                opacity: { value: 1.0 }
            },
            vertexShader: glowLineVertexShader,
            fragmentShader: glowLineFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const trail = new THREE.Line(geometry, trailMaterial);
        this.scene.add(trail);

        // Add trail to the trails array with creation timestamp
        this.trails.push({
            line: trail,
            createdAt: Date.now()
        });

        return trail;
    }

    activateConnection(connection, duration = 0.5, createTrail = true) {
        const originalOpacity = connection.line.material.opacity;
        const originalColor = connection.line.material.color.clone();

        if (createTrail) {
            // Create trail effect
            const trail = this.createTrail(
                connection.fromNode.position,
                connection.toNode.position,
                0xffffff
            );
        }

        return new Promise(resolve => {
            // Animate main line
            gsap.to(connection.line.material, {
                duration: duration / 2,
                opacity: 1,
                onStart: () => {
                    connection.line.material.color.setHex(0xffffff);
                    connection.glowLine.material.uniforms.color.value.setHex(0xffffff);
                    connection.glowLine.material.uniforms.opacity.value = 0.5;
                },
                onComplete: () => {
                    gsap.to(connection.line.material, {
                        duration: duration / 2,
                        opacity: originalOpacity,
                        onComplete: () => {
                            connection.line.material.color.copy(originalColor);
                            connection.glowLine.material.uniforms.color.value.copy(originalColor);
                            connection.glowLine.material.uniforms.opacity.value = 0.1;
                            resolve();
                        }
                    });
                }
            });
        });
    }

    async propagateLayerToLayer(fromLayer, toLayer, layerIndex) {
        const connections = this.connectionsByLayer[layerIndex];
        const activationPromises = [];

        // Activate all nodes in the current layer
        for (const node of fromLayer) {
            if (!node.isInactive) {
                activationPromises.push(this.activateNode(node, 0.5, 0x00ff00));
            }
        }
        await Promise.all(activationPromises);
        activationPromises.length = 0;

        // Activate connections and target nodes
        const relevantConnections = connections.filter(conn => 
            fromLayer.includes(conn.fromNode) && toLayer.includes(conn.toNode) &&
            !conn.fromNode.isInactive && !conn.toNode.isInactive
        );

        // Activate connections with trails
        for (const connection of relevantConnections) {
            activationPromises.push(this.activateConnection(connection, 0.5, true));
        }
        await Promise.all(activationPromises);
        activationPromises.length = 0;

        // Activate target nodes
        const targetNodes = new Set(relevantConnections.map(conn => conn.toNode));
        for (const node of targetNodes) {
            if (!node.isInactive) {
                activationPromises.push(this.activateNode(node, 0.5, 0x00ff00));
            }
        }
        await Promise.all(activationPromises);
    }

    async triggerPromptPropagation() {
        // Temporarily pause random activations
        clearInterval(this.randomActivationInterval);

        // Propagate through each layer
        for (let i = 0; i < this.nodes.length - 1; i++) {
            await this.propagateLayerToLayer(this.nodes[i], this.nodes[i + 1], i);
            await new Promise(resolve => setTimeout(resolve, 200)); // Small pause between layers
        }

        // Restart random activations
        this.startRandomActivations();
    }
    
    findConnectionsBetweenNodes(nodeA, nodeB) {
        // Search through all layer connections to find connections between these nodes
        for (const layerConnections of this.connectionsByLayer) {
            const connection = layerConnections.find(conn => 
                (conn.fromNode === nodeA && conn.toNode === nodeB) ||
                (conn.fromNode === nodeB && conn.toNode === nodeA)
            );
            if (connection) return connection;
        }
        return null;
    }

    findAllConnectedNodes(node) {
        const connectedNodes = new Set();
        
        this.connectionsByLayer.forEach(layerConnections => {
            layerConnections.forEach(conn => {
                if (conn.fromNode === node) {
                    connectedNodes.add(conn.toNode);
                } else if (conn.toNode === node) {
                    connectedNodes.add(conn.fromNode);
                }
            });
        });
        
        return Array.from(connectedNodes);
    }

    activateRandomNodes() {
        const numNodesToActivate = Math.floor(Math.random() * 3) + 2;
        const activeNodes = new Set();
        const activeConnections = new Set();
        
        // First, select random initial node that is not inactive
        let initialNode;
        do {
            const initialLayerIndex = Math.floor(Math.random() * this.nodes.length);
            const initialNodeIndex = Math.floor(Math.random() * this.nodes[initialLayerIndex].length);
            initialNode = this.nodes[initialLayerIndex][initialNodeIndex];
        } while (initialNode.isInactive);
        
        activeNodes.add(initialNode);

        // Then, preferentially select connected nodes that are not inactive
        while (activeNodes.size < numNodesToActivate) {
            const currentNode = Array.from(activeNodes)[activeNodes.size - 1];
            const connectedNodes = this.findAllConnectedNodes(currentNode)
                .filter(node => !node.isInactive);
            
            if (connectedNodes.length > 0 && Math.random() < 0.7) {
                const availableNodes = connectedNodes.filter(node => !activeNodes.has(node));
                if (availableNodes.length > 0) {
                    const nextNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
                    activeNodes.add(nextNode);
                    
                    const connection = this.findConnectionsBetweenNodes(currentNode, nextNode);
                    if (connection) {
                        activeConnections.add(connection);
                    }
                    continue;
                }
            }
            
            // If we couldn't select a connected node, select a random active one
            let attempts = 0;
            while (attempts < 10) {
                const layerIndex = Math.floor(Math.random() * this.nodes.length);
                const nodeIndex = Math.floor(Math.random() * this.nodes[layerIndex].length);
                const node = this.nodes[layerIndex][nodeIndex];
                
                if (!activeNodes.has(node) && !node.isInactive) {
                    activeNodes.add(node);
                    break;
                }
                attempts++;
            }
        }

        // Rest of the activation code remains the same
        const activationPromises = [];

        activeNodes.forEach(node => {
            activationPromises.push(this.activateNode(node, 1.0, 0xffffff));
        });

        activeConnections.forEach(connection => {
            const enhancedActivation = {
                line: connection.line,
                glowLine: connection.glowLine,
                fromNode: connection.fromNode,
                toNode: connection.toNode
            };
            
            gsap.to(connection.line.material, {
                opacity: 0.8,
                duration: 1.0,
                ease: "power2.inOut",
                yoyo: true,
                repeat: 1
            });

            gsap.to(connection.glowLine.material.uniforms.opacity, {
                value: 0.4,
                duration: 1.0,
                ease: "power2.inOut",
                yoyo: true,
                repeat: 1
            });

            activationPromises.push(this.activateConnection(enhancedActivation));
        });

        return Promise.all(activationPromises);
    }

    startRandomActivations() {
        if (this.randomActivationInterval) {
            clearInterval(this.randomActivationInterval);
        }
        this.randomActivationInterval = setInterval(async () => {
            await this.activateRandomNodes();
        }, 2000);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Rotate the globe
        this.globe.rotation.y += 0.001;
        this.globe.rotation.x += 0.0005;

        // Update and fade trails
        const currentTime = Date.now();
        this.trails = this.trails.filter(trail => {
            const age = currentTime - trail.createdAt;
            if (age > this.trailDuration) {
                // Remove old trails
                this.scene.remove(trail.line);
                return false;
            }
            
            // Calculate fade based on age
            const opacity = 1 - (age / this.trailDuration);
            trail.line.material.uniforms.opacity.value = opacity;
            
            return true;
        });

        // Animate connection glow
        const time = Date.now() * 0.001;
        this.connections.forEach((connection, index) => {
            if (connection.material.type === 'ShaderMaterial') {
                connection.material.uniforms.opacity.value = 
                    0.1 + 0.05 * Math.sin(time + index * 0.1);
            }
        });
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    setupPromptHandling() {
        const submitButton = document.getElementById('submit-prompt');
        const promptInput = document.getElementById('prompt-input');
        const outputDisplay = document.getElementById('output-display');

        submitButton.addEventListener('click', () => {
            const prompt = promptInput.value.trim();
            if (prompt) {
                this.simulatePrompt(prompt);
            }
        });

        promptInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const prompt = promptInput.value.trim();
                if (prompt) {
                    this.simulatePrompt(prompt);
                }
            }
        });
    }

    async simulatePrompt(prompt) {
        // Clear previous output
        const outputDisplay = document.getElementById('output-display');
        outputDisplay.textContent = '';

        // Temporarily pause random activations
        clearInterval(this.randomActivationInterval);

        // Activate input layer based on prompt length
        const inputLayer = this.nodes[0];
        const promptLength = Math.min(prompt.length, inputLayer.length);
        
        // Activate input nodes sequentially
        for (let i = 0; i < promptLength; i++) {
            const node = inputLayer[i];
            if (!node.isInactive) {
                await this.activateNode(node, 0.5, 0x00ff00);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Propagate through hidden layers
        for (let i = 0; i < this.nodes.length - 1; i++) {
            await this.propagateLayerToLayer(this.nodes[i], this.nodes[i + 1], i);
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Generate "output" based on prompt
        const output = this.generateSimulatedOutput(prompt);
        outputDisplay.textContent = output;

        // Highlight output nodes
        const outputLayer = this.nodes[this.nodes.length - 1];
        const promises = [];
        outputLayer.forEach(node => {
            if (!node.isInactive) {
                promises.push(this.activateNode(node, 1.0, 0xff3366));
            }
        });
        await Promise.all(promises);

        // Restart random activations
        this.startRandomActivations();
    }

    generateSimulatedOutput(prompt) {
        // Simple output generation for demonstration
        const responses = [
            "Processing complete",
            "Analysis finished",
            "Pattern recognized",
            "Neural pathway activated",
            "Signal processed"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    setupDrawing() {
        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        
        // Setup canvas
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        this.ctx.lineWidth = 15;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Prevent scrolling while drawing
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.startDrawing(this.getPointerPos(e));
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            e.preventDefault();
            if (this.isDrawing) {
                this.draw(this.getPointerPos(e));
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.stopDrawing();
            this.recognizeNumber();
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            if (this.isDrawing) {
                this.stopDrawing();
                this.recognizeNumber();
            }
        });

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(this.getPointerPos(touch));
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isDrawing) {
                const touch = e.touches[0];
                this.draw(this.getPointerPos(touch));
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.stopDrawing();
            this.recognizeNumber();
        });

        this.canvas.addEventListener('touchcancel', () => {
            this.stopDrawing();
            this.recognizeNumber();
        });

        // Clear and recognize buttons with touch optimization
        const clearBtn = document.getElementById('clear-canvas');
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.clearCanvas();
        });
        clearBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.clearCanvas();
        });

        const recognizeBtn = document.getElementById('recognize');
        recognizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.recognizeNumber();
        });
        recognizeBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.recognizeNumber();
        });

        // Handle canvas resize
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        window.addEventListener('orientationchange', () => {
            setTimeout(() => this.resizeCanvas(), 100);
        });
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: ((e.clientX || e.pageX) - rect.left) * scaleX,
            y: ((e.clientY || e.pageY) - rect.top) * scaleY
        };
    }

    startDrawing(pos) {
        this.isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    draw(pos) {
        if (!this.isDrawing) return;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.beginPath();
    }

    clearCanvas() {
        const size = this.canvas.width;
        this.ctx.clearRect(0, 0, size, size);
        
        // Reset prediction display
        document.getElementById('predicted-number').textContent = '-';
        document.getElementById('confidence-value').textContent = '0';
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const size = Math.min(280, window.innerWidth * 0.8);
        
        // Set canvas size
        this.canvas.width = size;
        this.canvas.height = size;
        
        // Restore canvas context properties after resize
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        this.ctx.lineWidth = Math.max(15, size / 20);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    async recognizeNumber() {
        // Get image data and process it
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const processed = this.processImageData(imageData);
        
        // Simulate recognition with random confidence for demo
        const prediction = Math.floor(Math.random() * 10);
        const confidence = Math.floor(Math.random() * 30) + 70; // 70-99%

        // Update display
        document.getElementById('predicted-number').textContent = prediction;
        document.getElementById('confidence-value').textContent = confidence;

        // Highlight the corresponding output node
        await this.highlightPrediction(prediction, confidence);
    }

    processImageData(imageData) {
        // In a real implementation, this would process the image data
        // For demo purposes, we'll just return the raw data
        return imageData;
    }

    async highlightPrediction(prediction, confidence) {
        // Clear any existing activations
        clearInterval(this.randomActivationInterval);

        // Activate input layer based on drawing
        const inputLayer = this.nodes[0];
        for (let i = 0; i < inputLayer.length; i++) {
            if (!inputLayer[i].isInactive) {
                await this.activateNode(inputLayer[i], 0.3, 0x00ff00);
            }
        }

        // Propagate through hidden layers
        for (let i = 0; i < this.nodes.length - 1; i++) {
            await this.propagateLayerToLayer(this.nodes[i], this.nodes[i + 1], i);
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Highlight the predicted number in the output layer
        const outputLayer = this.nodes[this.nodes.length - 1];
        const outputNode = outputLayer[prediction];
        
        if (outputNode && !outputNode.isInactive) {
            // Scale glow intensity with confidence
            const glowIntensity = confidence / 100;
            
            // Create emphasized glow effect
            const glowColor = 0xff3366;
            await this.activateNode(outputNode, 1.5, glowColor);
            
            // Add number label to the node
            if (!outputNode.label) {
                const sprite = this.createTextSprite(prediction.toString());
                outputNode.add(sprite);
                outputNode.label = sprite;
            }
        }

        // Restart random activations after a delay
        setTimeout(() => this.startRandomActivations(), 2000);
    }

    createTextSprite(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;

        ctx.fillStyle = 'rgba(255, 51, 102, 0.9)';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(0, 0, 0.2);
        
        return sprite;
    }
}

// Initialize the visualizer
new NeuralNetworkVisualizer(); 