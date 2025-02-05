import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { gsap } from 'gsap';

class NeuralNetworkVisualizer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#visualization'),
            antialias: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.camera.position.z = 15;
        
        // Create controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Create container cube
        this.createContainerCube();
        
        // Create neural network
        this.nodes = [];
        this.connections = [];
        this.createNeuralNetwork();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start animation
        this.animate();
        
        // Start random node activation
        this.startRandomActivations();
    }
    
    createContainerCube() {
        const geometry = new THREE.BoxGeometry(10, 10, 10);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true,
            transparent: true,
            opacity: 0.1
        });
        this.cube = new THREE.Mesh(geometry, material);
        this.scene.add(this.cube);
    }
    
    createNeuralNetwork() {
        const layerCount = 5;
        const nodesPerLayer = 8;
        const nodeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        
        // Create nodes
        for (let layer = 0; layer < layerCount; layer++) {
            const layerNodes = [];
            for (let i = 0; i < nodesPerLayer; i++) {
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
                const x = (layer - (layerCount - 1) / 2) * 2;
                const y = (i - (nodesPerLayer - 1) / 2) * 1;
                const z = (Math.random() - 0.5) * 2;
                node.position.set(x, y, z);
                this.scene.add(node);
                layerNodes.push(node);
            }
            this.nodes.push(layerNodes);
        }
        
        // Create connections
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.3
        });
        
        for (let layer = 0; layer < layerCount - 1; layer++) {
            for (let i = 0; i < nodesPerLayer; i++) {
                for (let j = 0; j < nodesPerLayer; j++) {
                    if (Math.random() < 0.3) { // 30% chance of connection
                        const geometry = new THREE.BufferGeometry().setFromPoints([
                            this.nodes[layer][i].position,
                            this.nodes[layer + 1][j].position
                        ]);
                        const line = new THREE.Line(geometry, lineMaterial.clone());
                        this.scene.add(line);
                        this.connections.push(line);
                    }
                }
            }
        }
    }
    
    activateRandomNodes() {
        const numNodesToActivate = Math.floor(Math.random() * 5) + 3;
        const activeNodes = new Set();
        
        while (activeNodes.size < numNodesToActivate) {
            const layerIndex = Math.floor(Math.random() * this.nodes.length);
            const nodeIndex = Math.floor(Math.random() * this.nodes[layerIndex].length);
            const node = this.nodes[layerIndex][nodeIndex];
            
            if (!activeNodes.has(node)) {
                activeNodes.add(node);
                const originalColor = node.material.color.clone();
                
                gsap.to(node.material, {
                    duration: 0.5,
                    opacity: 1,
                    onStart: () => {
                        node.material.color.setHex(0xffffff);
                    },
                    onComplete: () => {
                        gsap.to(node.material, {
                            duration: 0.5,
                            opacity: 0.8,
                            onComplete: () => {
                                node.material.color.copy(originalColor);
                            }
                        });
                    }
                });
            }
        }
    }
    
    startRandomActivations() {
        setInterval(() => this.activateRandomNodes(), 2000);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.cube.rotation.x += 0.001;
        this.cube.rotation.y += 0.001;
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the visualizer
new NeuralNetworkVisualizer(); 