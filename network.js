import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/postprocessing/UnrealBloomPass.js';

class NeuralVisualizer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.networkLayers = [];
        this.dataFlowParticles = [];
        
        this.init();
    }

    init() {
        // Scene setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x0a0a1a);
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x444488);
        const pointLight = new THREE.PointLight(0x88aaff, 50);
        pointLight.position.set(10, 10, 10);
        this.scene.add(ambientLight, pointLight);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.camera.position.z = 15;

        // Create initial network
        this.createNetwork([4, 6, 6, 2]);
        this.animate();

        // Post-processing setup
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // strength
            0.4, // radius
            0.8 // threshold
        );
        this.composer.addPass(bloomPass);
    }

    createNetwork(layers) {
        const layerSpacing = 8;
        this.networkLayers = layers.map((neuronCount, i) => {
            const layerGroup = new THREE.Group();
            const zPos = (i - (layers.length-1)/2) * layerSpacing;
            
            // Animated spherical formation
            const radius = neuronCount * 0.6;
            const neurons = Array.from({ length: neuronCount }).map((_, j) => {
                const geometry = new THREE.SphereGeometry(0.6, 32, 32);
                const material = new THREE.MeshPhongMaterial({
                    color: 0x00ffff,
                    emissive: 0x0066ff,
                    specular: 0x0099ff,
                    shininess: 100,
                    transparent: true,
                    opacity: 0.9
                });

                const neuron = new THREE.Mesh(geometry, material);
                
                // Store initial spherical coordinates
                neuron.userData.angle = {
                    phi: Math.acos(-1 + (2 * j) / neuronCount),
                    theta: Math.sqrt(neuronCount * Math.PI) * phi,
                    radius: radius + Math.random() * 0.5
                };

                layerGroup.add(neuron);
                return neuron;
            });

            // Animate layer rotation
            layerGroup.userData.rotationSpeed = new THREE.Vector3(
                Math.random() * 0.01 - 0.005,
                Math.random() * 0.01 - 0.005,
                Math.random() * 0.01 - 0.005
            );
            
            this.scene.add(layerGroup);
            return neurons;
        });

        // Create 3D connections
        for (let i = 0; i < this.networkLayers.length - 1; i++) {
            this.networkLayers[i].forEach(startNeuron => {
                this.networkLayers[i+1].forEach(endNeuron => {
                    const weight = Math.random();
                    this.createConnection(
                        startNeuron.position, 
                        endNeuron.position, 
                        weight
                    );
                });
            });
        }

        // Add depth effect to scene
        this.scene.fog = new THREE.Fog(0x0a0a1a, 15, 50);
    }

    createConnection(startPos, endPos, weight) {
        // Create animated spline curve
        const midPoint = new THREE.Vector3()
            .lerpVectors(startPos, endPos, 0.5)
            .add(new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3
            ));

        const curve = new THREE.CatmullRomCurve3([startPos, midPoint, endPos]);
        
        // Animated tube geometry
        const geometry = new THREE.TubeGeometry(curve, 64, weight/3, 12, false);
        const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color().lerpColors(
                new THREE.Color(0x00ffff),
                new THREE.Color(0x0000ff),
                weight
            ),
            metalness: 0.5,
            roughness: 0.5,
            transparent: true,
            opacity: 0.6
        });

        const connection = new THREE.Mesh(geometry, material);
        connection.userData.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.scene.add(connection);

        // Add data flow animation
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(100 * 3);
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.2,
            color: 0x00ffff,
            blending: THREE.AdditiveBlending
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.dataFlowParticles.push({ particles, curve, progress: 0 });
        this.scene.add(particles);
    }

    createNetwork(layerSizes) {
        // Implementation for creating the network visualization
        // This method should be implemented to create the neural network structure
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const time = Date.now() * 0.001;

        // Animate neurons
        this.networkLayers.forEach((layer, layerIndex) => {
            const layerGroup = layer[0].parent;
            
            // Rotate entire layer
            layerGroup.rotation.x += layerGroup.userData.rotationSpeed.x;
            layerGroup.rotation.y += layerGroup.userData.rotationSpeed.y;
            layerGroup.rotation.z += layerGroup.userData.rotationSpeed.z;

            // Animate individual neurons
            layer.forEach((neuron, neuronIndex) => {
                // Pulsating scale
                neuron.scale.setScalar(1 + Math.sin(time * 3 + neuronIndex) * 0.1);
                
                // Orbital movement
                const angle = neuron.userData.angle;
                neuron.position.setFromSphericalCoords(
                    angle.radius + Math.sin(time + neuronIndex) * 0.3,
                    angle.phi + Math.sin(time * 0.5) * 0.1,
                    angle.theta + time * 0.2
                );
            });
        });

        // Animate connections
        this.scene.children.filter(obj => obj.type === 'Mesh' && obj.geometry.type === 'TubeGeometry').forEach(conn => {
            conn.material.opacity = 0.5 + Math.sin(time * conn.userData.pulseSpeed) * 0.3;
            conn.scale.setScalar(1 + Math.sin(time * 2) * 0.1);
        });

        // Enhanced particle animation
        this.dataFlowParticles.forEach(particleData => {
            particleData.progress = (particleData.progress + particleData.speed) % 1;
            const positions = particleData.particles.geometry.attributes.position.array;
            
            for (let i = 0; i < positions.length; i += 3) {
                const t = (particleData.progress + (i/positions.length)) % 1;
                const pos = particleData.curve.getPoint(t);
                
                // Add noise to particle positions
                positions[i] = pos.x + Math.sin(time * 2 + i) * 0.2;
                positions[i + 1] = pos.y + Math.cos(time * 2 + i) * 0.2;
                positions[i + 2] = pos.z + Math.sin(time * 3 + i) * 0.2;
            }
            
            particleData.particles.geometry.attributes.position.needsUpdate = true;
        });

        // Update camera position
        this.camera.position.x = Math.sin(time * 0.3) * 20;
        this.camera.position.y = Math.cos(time * 0.2) * 10;
        this.camera.lookAt(this.scene.position);

        this.controls.update();
        this.composer.render();
    }
}

// Initialize the visualizer
const visualizer = new NeuralVisualizer();

// Handle window resizing
window.addEventListener('resize', () => {
    visualizer.camera.aspect = window.innerWidth / window.innerHeight;
    visualizer.camera.updateProjectionMatrix();
    visualizer.renderer.setSize(window.innerWidth, window.innerHeight);
}); 