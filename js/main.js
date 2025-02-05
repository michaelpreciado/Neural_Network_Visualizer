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
        this.setupScene();
        this.setupDrawing();
        this.setupEventListeners();
        this.animate();
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Wider field of view and adjusted camera position
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(40, 25, 40); // Moved camera further out
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('visualization'),
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Adjusted controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.1; // Slower rotation
        this.controls.minDistance = 30; // Prevent zooming too close
        this.controls.maxDistance = 100; // Allow zooming out further

        this.createTensorSpace();
        this.createNeuralNetwork();

        // Enhanced lighting for better depth perception
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0x00ffff, 1.5);
        mainLight.position.set(1, 1, 1);
        this.scene.add(mainLight);

        const backLight = new THREE.DirectionalLight(0x00ffff, 0.5);
        backLight.position.set(-1, -1, -1);
        this.scene.add(backLight);

        // Optimized resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }, 100);
        });
    }

    createTensorSpace() {
        // Create globe tensor space with larger radius
        const globeRadius = 25;
        const globeGeometry = new THREE.SphereGeometry(globeRadius, 32, 32);
        const globeMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            opacity: 0.02,  // Reduced from 0.05
            transparent: true,
            wireframe: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.tensorSpace = new THREE.Mesh(globeGeometry, globeMaterial);
        this.scene.add(this.tensorSpace);

        // Add equatorial ring with reduced visibility
        const ringGeometry = new THREE.TorusGeometry(globeRadius * 0.8, 0.1, 16, 100);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ffff,
            opacity: 0.06,  // Reduced from 0.15
            transparent: true,
            emissive: 0x00ffff,
            emissiveIntensity: 0.05,  // Reduced from 0.1
            depthWrite: false
        });
        this.equatorialRing = new THREE.Mesh(ringGeometry, ringMaterial);
        this.equatorialRing.rotation.x = Math.PI / 2;
        this.scene.add(this.equatorialRing);

        // Add latitude rings with minimal visibility
        for (let i = 1; i <= 3; i++) {
            const latitude = (Math.PI / 8) * i;
            const radius = Math.cos(latitude) * globeRadius * 0.8;
            const y = Math.sin(latitude) * globeRadius * 0.8;

            const latRingGeometry = new THREE.TorusGeometry(radius, 0.05, 16, 100);
            const latRingMaterial = new THREE.MeshPhongMaterial({
                color: 0x00ffff,
                opacity: 0.03,  // Reduced from 0.08
                transparent: true,
                depthWrite: false
            });
            
            // North hemisphere ring
            const northRing = new THREE.Mesh(latRingGeometry, latRingMaterial);
            northRing.position.y = y;
            northRing.rotation.x = Math.PI / 2;
            this.scene.add(northRing);

            // South hemisphere ring
            const southRing = new THREE.Mesh(latRingGeometry, latRingMaterial);
            southRing.position.y = -y;
            southRing.rotation.x = Math.PI / 2;
            this.scene.add(southRing);
        }

        // Add meridian lines with reduced visibility
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const curve = new THREE.EllipseCurve(
                0, 0,
                globeRadius * 0.8, globeRadius * 0.8,
                0, Math.PI * 2,
                false,
                0
            );
            
            const points = curve.getPoints(50);
            const meridianGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const meridianMaterial = new THREE.LineBasicMaterial({
                color: 0x00ffff,
                opacity: 0.03,  // Reduced from 0.08
                transparent: true,
                depthWrite: false
            });
            
            const meridian = new THREE.Line(meridianGeometry, meridianMaterial);
            meridian.rotation.y = angle;
            this.scene.add(meridian);
        }

        // Add a very subtle glow effect
        const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.02, 32, 32);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color(0x00ffff) },
                opacity: { value: 0.01 }  // Reduced from 0.02
            },
            vertexShader: glowLineVertexShader,
            fragmentShader: glowLineFragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(glowMesh);
    }

    createNeuralNetwork() {
        const layerConfig = [
            64,     // Input layer
            128,    // First hidden layer - Feature extraction
            256,    // Second hidden layer - Pattern recognition
            512,    // Third hidden layer - Higher-level features
            256,    // Fourth hidden layer - Feature combination
            128,    // Fifth hidden layer - Feature refinement
            64,     // Sixth hidden layer - Dimensionality reduction
            101     // Output layer (0-100)
        ];
        
        const spacing = Math.PI / (layerConfig.length - 1); // Spread layers across hemisphere
        this.nodes = [];
        this.connections = [];

        layerConfig.forEach((nodeCount, layerIndex) => {
            const layer = [];
            const phi = spacing * layerIndex - Math.PI / 2; // Angle from -π/2 to π/2
            const radius = 15; // Increased radius for circular arrangement
            const verticalOffset = radius * Math.sin(phi); // Vertical positioning

            // Adjust skip factor based on layer size
            const skipFactor = Math.ceil(nodeCount / (layerIndex === 0 || layerIndex === layerConfig.length - 1 ? 25 : 30));
            
            for (let i = 0; i < nodeCount; i += skipFactor) {
                const isInput = layerIndex === 0;
                const isOutput = layerIndex === layerConfig.length - 1;
                const isMiddle = layerIndex === Math.floor(layerConfig.length / 2);
                
                // Adjust node sizes based on layer position
                const nodeSize = isInput || isOutput ? 0.4 : 
                               isMiddle ? 0.3 :
                               0.2;
                
                const geometry = new THREE.SphereGeometry(nodeSize, 16, 16);
                
                // Color gradient through layers
                const layerProgress = layerIndex / (layerConfig.length - 1);
                const color = isInput ? 0x00ff00 : 
                            isOutput ? 0xff3366 :
                            new THREE.Color(0x00ffff)
                                .lerp(new THREE.Color(0xff3366), layerProgress);
                
                const material = new THREE.MeshPhongMaterial({
                    color: color,
                    opacity: 0.9,
                    transparent: true,
                    emissive: color,
                    emissiveIntensity: 0.5,
                    shininess: 30
                });

                const node = new THREE.Mesh(geometry, material);
                const visibleNodes = Math.ceil(nodeCount / skipFactor);
                
                // Position nodes in a complete circle
                const angle = (i / skipFactor) * (Math.PI * 2) / visibleNodes;
                const horizontalRadius = radius * Math.cos(phi);
                
                node.position.x = horizontalRadius * Math.cos(angle);
                node.position.y = verticalOffset;
                node.position.z = horizontalRadius * Math.sin(angle);
                
                this.scene.add(node);
                layer.push(node);

                // Enhanced connection logic
                if (layerIndex > 0) {
                    const prevLayer = this.nodes[layerIndex - 1];
                    const connectionCount = Math.min(
                        prevLayer.length,
                        isOutput ? 8 : // More connections to output
                        isInput ? 4 : // Fewer connections from input
                        6 // Standard connections for hidden layers
                    );
                    
                    // Connect to nearest nodes in previous layer
                    for (let j = 0; j < connectionCount; j++) {
                        const prevNodeIndex = Math.floor((j * prevLayer.length / connectionCount + 
                            (i / skipFactor * prevLayer.length / visibleNodes)) % prevLayer.length);
                        const prevNode = prevLayer[prevNodeIndex];
                        
                        const connectionGeometry = new THREE.BufferGeometry();
                        const points = [prevNode.position, node.position];
                        connectionGeometry.setFromPoints(points);
                        
                        // Gradient color for connections
                        const connectionColor = new THREE.Color(0x00ffff)
                            .lerp(new THREE.Color(0xff3366), layerProgress);
                        
                        const connectionMaterial = new THREE.LineBasicMaterial({
                            color: connectionColor,
                            opacity: 0.15,
                            transparent: true
                        });
                        const connection = new THREE.Line(connectionGeometry, connectionMaterial);
                        this.scene.add(connection);
                        this.connections.push({
                            line: connection,
                            start: prevNode,
                            end: node,
                            material: connectionMaterial
                        });
                    }
                }
            }
            this.nodes.push(layer);
        });

        // Adjust camera for the cylindrical network
        this.camera.position.set(35, 25, 35);
        this.camera.lookAt(0, 0, 0);
    }

    setupDrawing() {
        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        const size = Math.min(280, window.innerWidth * 0.8);
        this.canvas.width = size;
        this.canvas.height = size;
        
        // Set drawing style
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 20;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
    }

    setupEventListeners() {
        // Drawing events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));

        // Touch events
        const handleTouch = (e) => {
            e.preventDefault();
            const touches = e.touches;
            
            // Single touch - rotate
            if (touches.length === 1) {
                // Update camera rotation
            }
            
            // Two touches - zoom
            if (touches.length === 2) {
                // Handle pinch zoom
            }
        };

        this.canvas.addEventListener('touchstart', handleTouch);
        this.canvas.addEventListener('touchmove', handleTouch);
        this.canvas.addEventListener('touchend', handleTouch);

        // Button events
        document.getElementById('clear-canvas').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('recognize').addEventListener('click', this.recognizeNumber.bind(this));
    }

    startDrawing(e) {
        e.preventDefault();
        this.isDrawing = true;
        const pos = this.getPointerPos(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    draw(e) {
        e.preventDefault();
        if (!this.isDrawing) return;

        const pos = this.getPointerPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        this.lastX = pos.x;
        this.lastY = pos.y;
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        return { x, y };
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.resetVisualization();
        document.getElementById('prediction').textContent = 'Draw a number to begin';
        document.getElementById('confidence').textContent = 'Confidence: --';
        document.getElementById('confidence-progress').style.width = '0%';
    }

    async recognizeNumber() {
        const loadingContainer = document.getElementById('loading-container');
        const loadingProgress = document.querySelector('.loading-progress');
        loadingContainer.style.display = 'flex';
        
        // Reset previous state
        this.resetVisualization();
        
        // Get drawn number characteristics
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const characteristics = this.analyzeDrawing(imageData);
        
        // Update loading text
        const loadingDetails = document.querySelector('.loading-details');
        loadingDetails.textContent = 'Analyzing input pattern...';
        
        // Simulate input processing
        await this.animateProgress(loadingProgress, 0, 30);
        
        // Generate prediction based on drawing characteristics
        await this.visualizePredictionProcess(characteristics);
        
        loadingContainer.style.display = 'none';
    }

    analyzeDrawing(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        let pixelCount = 0;
        let centerX = 0;
        let centerY = 0;

        // Analyze the drawing
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                // Check if pixel is drawn (non-black)
                if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                    centerX += x;
                    centerY += y;
                    pixelCount++;
                }
            }
        }

        if (pixelCount === 0) return null;

        // Calculate characteristics
        centerX /= pixelCount;
        centerY /= pixelCount;
        const width_ratio = (maxX - minX) / width;
        const height_ratio = (maxY - minY) / height;
        const density = pixelCount / ((maxX - minX + 1) * (maxY - minY + 1));

        return {
            width_ratio,
            height_ratio,
            density,
            pixelCount,
            centerX: centerX / width,
            centerY: centerY / height
        };
    }

    predictFromCharacteristics(characteristics) {
        if (!characteristics) return { prediction: 0, confidence: 0 };

        // Normalize the characteristics
        const { width_ratio, height_ratio, density, centerX, centerY } = characteristics;

        // Simple heuristic-based prediction
        let prediction = 0;
        let confidence = 0;

        if (density > 0.6) {
            // Dense numbers like 0, 8
            prediction = width_ratio > height_ratio ? 0 : 8;
            confidence = 85;
        } else if (width_ratio < 0.3) {
            // Thin numbers like 1
            prediction = 1;
            confidence = 90;
        } else if (height_ratio < 0.4) {
            // Short numbers like 7
            prediction = 7;
            confidence = 80;
        } else if (density < 0.3) {
            // Sparse numbers like 2, 3
            prediction = centerY > 0.5 ? 2 : 3;
            confidence = 75;
        } else {
            // Map other characteristics to remaining numbers
            const value = (centerX + centerY + density) * 33;
            prediction = Math.max(0, Math.min(100, Math.floor(value)));
            confidence = 70;
        }

        return { prediction, confidence };
    }

    async visualizePredictionProcess(characteristics) {
        // Step 1: Input Layer Activation
        document.querySelector('.loading-details').textContent = 'Processing input features...';
        await this.activateLayerWithEffect(0, 1000);
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 2: Process through hidden layers
        for (let i = 1; i < this.nodes.length - 1; i++) {
            document.querySelector('.loading-details').textContent = `Analyzing pattern in hidden layer ${i}...`;
            await this.activateLayerWithEffect(i, 1000);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Step 3: Generate Prediction
        document.querySelector('.loading-details').textContent = 'Generating prediction...';
        await this.activateLayerWithEffect(this.nodes.length - 1, 1000);

        // Make prediction based on drawing characteristics
        const { prediction, confidence } = this.predictFromCharacteristics(characteristics);

        // Highlight the winning node
        await this.highlightPredictionNode(prediction);

        // Update prediction display with animation
        await this.updatePredictionDisplay(prediction, confidence);
    }

    async highlightPredictionNode(prediction) {
        const outputLayer = this.nodes[this.nodes.length - 1];
        const nodeIndex = Math.floor((prediction / 101) * outputLayer.length);
        const winningNode = outputLayer[Math.min(nodeIndex, outputLayer.length - 1)];

        // Create highlight effect
        const highlightGeometry = new THREE.SphereGeometry(0.6, 32, 32);
        const highlightMaterial = new THREE.MeshPhongMaterial({
            color: 0xff3366,
            opacity: 0.3,
            transparent: true,
            emissive: 0xff3366,
            emissiveIntensity: 0.5
        });

        const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlight.position.copy(winningNode.position);
        this.scene.add(highlight);

        // Create data flow effect from input to output
        const inputLayer = this.nodes[0];
        const midPoint = new THREE.Vector3();
        midPoint.addVectors(inputLayer[0].position, winningNode.position).multiplyScalar(0.5);

        const curve = new THREE.QuadraticBezierCurve3(
            inputLayer[0].position,
            midPoint,
            winningNode.position
        );

        const points = curve.getPoints(50);
        const flowGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const flowMaterial = new THREE.LineBasicMaterial({
            color: 0xff3366,
            opacity: 0,
            transparent: true
        });

        const flow = new THREE.Line(flowGeometry, flowMaterial);
        this.scene.add(flow);

        // Animate flow and highlight
        gsap.to(flowMaterial, {
            opacity: 0.8,
            duration: 1,
            ease: "power2.out",
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                this.scene.remove(flow);
            }
        });

        gsap.to(highlightMaterial, {
            opacity: 0,
            duration: 2,
            ease: "power2.out",
            onComplete: () => {
                this.scene.remove(highlight);
            }
        });

        // Pulse winning node
        gsap.to(winningNode.material, {
            emissiveIntensity: 2,
            duration: 0.5,
            yoyo: true,
            repeat: 3
        });
    }

    async activateLayerWithEffect(layerIndex, duration) {
        const layer = this.nodes[layerIndex];
        const isOutput = layerIndex === this.nodes.length - 1;
        
        // Activate nodes with wave effect
        for (let i = 0; i < layer.length; i++) {
            const node = layer[i];
            
            // Create activation wave
            const waveGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const waveMaterial = new THREE.MeshPhongMaterial({
                color: isOutput ? 0xff3366 : 0x00ffff,
                opacity: 0.3,
                transparent: true,
                emissive: isOutput ? 0xff3366 : 0x00ffff,
                emissiveIntensity: 0.5
            });

            const wave = new THREE.Mesh(waveGeometry, waveMaterial);
            wave.position.copy(node.position);
            this.scene.add(wave);

            // Animate wave and node
            gsap.to(wave.scale, {
                x: 2,
                y: 2,
                z: 2,
                duration: 1,
                ease: "power2.out"
            });

            gsap.to(waveMaterial, {
                opacity: 0,
                duration: 1,
                ease: "power2.out",
                onComplete: () => {
                    this.scene.remove(wave);
                }
            });

            gsap.to(node.material, {
                emissiveIntensity: 1.5,
                opacity: 1,
                duration: 0.3,
                yoyo: true,
                repeat: 1
            });

            // Activate connections
            if (layerIndex < this.nodes.length - 1) {
                this.connections.forEach(conn => {
                    if (conn.start === node) {
                        gsap.to(conn.material, {
                            opacity: 0.8,
                            duration: 0.3,
                            yoyo: true,
                            repeat: 1
                        });
                    }
                });
            }

            await new Promise(resolve => setTimeout(resolve, duration / layer.length));
        }
    }

    async updatePredictionDisplay(prediction, confidence) {
        // Animate confidence bar
        const confidenceProgress = document.getElementById('confidence-progress');
        gsap.to(confidenceProgress, {
            width: `${confidence}%`,
            duration: 1,
            ease: "power2.out"
        });

        // Update text with typewriter effect
        const predictionElement = document.getElementById('prediction');
        const confidenceElement = document.getElementById('confidence');
        
        predictionElement.textContent = '';
        const predictionText = `Predicted Number: ${prediction}`;
        
        for (let i = 0; i < predictionText.length; i++) {
            predictionElement.textContent += predictionText[i];
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        confidenceElement.textContent = `Confidence: ${confidence}%`;
    }

    async animateProgress(element, start = 0, end = 100) {
        return new Promise(resolve => {
            let progress = start;
            const interval = setInterval(() => {
                progress += 1;
                element.style.width = `${progress}%`;
                if (progress >= end) {
                    clearInterval(interval);
                    resolve();
                }
            }, 30);
        });
    }

    resetVisualization() {
        // Reset all nodes
        this.nodes.forEach(layer => {
            layer.forEach(node => {
                node.material.emissiveIntensity = 0.5;
                node.material.opacity = 0.9;
            });
        });

        // Reset all connections
        this.connections.forEach(conn => {
            conn.material.opacity = 0.4;
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        // Update controls
        this.controls.update();

        // Rotate globe very slowly
        this.tensorSpace.rotation.y += 0.0002;
        if (this.equatorialRing) {
            this.equatorialRing.rotation.z += 0.0002;
        }

        this.renderer.render(this.scene, this.camera);
    }

    // Add visibility change listener
    visibilityChange() {
        if (document.visibilityState === 'hidden') {
            this.renderer.dispose();
            this.scene.traverse(obj => {
                if (obj.material) {
                    obj.material.dispose();
                }
                if (obj.geometry) {
                    obj.geometry.dispose();
                }
            });
        } else {
            this.initThreeJS();
        }
    }
}

// Initialize the visualizer when the page loads
window.addEventListener('load', () => {
    new NeuralNetworkVisualizer();
});

const handleResize = () => {
    const isMobile = window.innerWidth <= 768;
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    if (isMobile) {
        canvasWrapper.style.transform = 'scale(0.9)';
        canvasWrapper.style.margin = '-5px 0';
    } else {
        canvasWrapper.style.transform = 'scale(1)';
        canvasWrapper.style.margin = '0';
    }
};

// Initial call
handleResize();

// Add resize listener
window.addEventListener('resize', handleResize);

const updateVisualizerSize = () => {
    const visualizer = document.getElementById('visualization');
    const isMobile = window.innerWidth <= 768;
    
    if(isMobile) {
        visualizer.style.width = `${Math.min(400, window.innerWidth * 0.9)}px`;
        visualizer.style.height = `${Math.min(400, window.innerHeight * 0.5)}px`;
        visualizer.style.transition = 'all 0.3s ease';
    } else {
        visualizer.style.width = '100%';
        visualizer.style.height = '100vh';
    }
};

// Run on resize and initial load
window.addEventListener('resize', updateVisualizerSize);
updateVisualizerSize(); 