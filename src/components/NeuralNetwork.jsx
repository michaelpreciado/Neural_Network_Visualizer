import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const NetworkContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 0;
  width: 100%;
  height: 70vh;
  transform: translateY(-50%);
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;

  @media (max-width: 768px) {
    height: 60vh;
    transform: translateY(-50%);
  }
`;

const NetworkCanvas = styled.canvas`
  width: 100%;
  height: 100%;
  opacity: 0.8;
  transition: opacity 0.3s ease;
  pointer-events: auto;

  @media (max-width: 768px) {
    transform: scale(0.8);
  }
`;

const layerConfig = [
  64,    // Input layer
  128,   // Hidden layer 1
  256,   // Hidden layer 2
  512,   // Hidden layer 3
  256,   // Hidden layer 4
  128,   // Hidden layer 5
  64,    // Hidden layer 6
  101    // Output layer
];

// Shader for glowing lines
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

const NeuralNetwork = ({ prediction }) => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const nodesRef = useRef([]);
  const connectionsRef = useRef([]);
  const tensorSpaceRef = useRef(null);
  const equatorialRingRef = useRef(null);
  const animationFrameRef = useRef();

  useEffect(() => {
    const setupScene = () => {
      const canvas = canvasRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
      camera.position.set(40, 25, 40);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;

      // Controls setup
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.1;
      controls.minDistance = 30;
      controls.maxDistance = 100;
      controlsRef.current = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      scene.add(ambientLight);

      const mainLight = new THREE.DirectionalLight(0x00ffff, 1.5);
      mainLight.position.set(1, 1, 1);
      scene.add(mainLight);

      const backLight = new THREE.DirectionalLight(0x00ffff, 0.5);
      backLight.position.set(-1, -1, -1);
      scene.add(backLight);

      createTensorSpace();
      createNeuralNetwork();
    };

    const createTensorSpace = () => {
      const scene = sceneRef.current;
      const globeRadius = 25;

      // Create globe tensor space
      const globeGeometry = new THREE.SphereGeometry(globeRadius, 32, 32);
      const globeMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        opacity: 0.02,
        transparent: true,
        wireframe: true,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const tensorSpace = new THREE.Mesh(globeGeometry, globeMaterial);
      scene.add(tensorSpace);
      tensorSpaceRef.current = tensorSpace;

      // Add equatorial ring
      const ringGeometry = new THREE.TorusGeometry(globeRadius * 0.8, 0.1, 16, 100);
      const ringMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ffff,
        opacity: 0.06,
        transparent: true,
        emissive: 0x00ffff,
        emissiveIntensity: 0.05,
        depthWrite: false
      });
      const equatorialRing = new THREE.Mesh(ringGeometry, ringMaterial);
      equatorialRing.rotation.x = Math.PI / 2;
      scene.add(equatorialRing);
      equatorialRingRef.current = equatorialRing;

      // Add latitude rings
      for (let i = 1; i <= 3; i++) {
        const latitude = (Math.PI / 8) * i;
        const radius = Math.cos(latitude) * globeRadius * 0.8;
        const y = Math.sin(latitude) * globeRadius * 0.8;

        const latRingGeometry = new THREE.TorusGeometry(radius, 0.05, 16, 100);
        const latRingMaterial = new THREE.MeshPhongMaterial({
          color: 0x00ffff,
          opacity: 0.03,
          transparent: true,
          depthWrite: false
        });

        // North hemisphere ring
        const northRing = new THREE.Mesh(latRingGeometry, latRingMaterial);
        northRing.position.y = y;
        northRing.rotation.x = Math.PI / 2;
        scene.add(northRing);

        // South hemisphere ring
        const southRing = new THREE.Mesh(latRingGeometry, latRingMaterial);
        southRing.position.y = -y;
        southRing.rotation.x = Math.PI / 2;
        scene.add(southRing);
      }

      // Add meridian lines
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
          opacity: 0.03,
          transparent: true,
          depthWrite: false
        });

        const meridian = new THREE.Line(meridianGeometry, meridianMaterial);
        meridian.rotation.y = angle;
        scene.add(meridian);
      }

      // Add glow effect
      const glowGeometry = new THREE.SphereGeometry(globeRadius * 1.02, 32, 32);
      const glowMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x00ffff) },
          opacity: { value: 0.01 }
        },
        vertexShader: glowLineVertexShader,
        fragmentShader: glowLineFragmentShader,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      scene.add(glowMesh);
    };

    const createNeuralNetwork = () => {
      const scene = sceneRef.current;
      const spacing = Math.PI / (layerConfig.length - 1);
      const nodes = [];
      const connections = [];

      layerConfig.forEach((nodeCount, layerIndex) => {
        const layer = [];
        const phi = spacing * layerIndex - Math.PI / 2;
        const radius = 15;
        const verticalOffset = radius * Math.sin(phi);

        const skipFactor = Math.ceil(nodeCount / (layerIndex === 0 || layerIndex === layerConfig.length - 1 ? 25 : 30));

        for (let i = 0; i < nodeCount; i += skipFactor) {
          const isInput = layerIndex === 0;
          const isOutput = layerIndex === layerConfig.length - 1;
          const isMiddle = layerIndex === Math.floor(layerConfig.length / 2);

          const nodeSize = isInput || isOutput ? 0.4 : 
                         isMiddle ? 0.3 :
                         0.2;

          const geometry = new THREE.SphereGeometry(nodeSize, 16, 16);

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

          const angle = (i / skipFactor) * (Math.PI * 2) / visibleNodes;
          const horizontalRadius = radius * Math.cos(phi);

          node.position.x = horizontalRadius * Math.cos(angle);
          node.position.y = verticalOffset;
          node.position.z = horizontalRadius * Math.sin(angle);

          scene.add(node);
          layer.push(node);

          if (layerIndex > 0) {
            const prevLayer = nodes[layerIndex - 1];
            const connectionCount = Math.min(
              prevLayer.length,
              isOutput ? 8 :
              isInput ? 4 :
              6
            );

            for (let j = 0; j < connectionCount; j++) {
              const prevNodeIndex = Math.floor((j * prevLayer.length / connectionCount + 
                (i / skipFactor * prevLayer.length / visibleNodes)) % prevLayer.length);
              const prevNode = prevLayer[prevNodeIndex];

              const connectionGeometry = new THREE.BufferGeometry();
              const points = [prevNode.position, node.position];
              connectionGeometry.setFromPoints(points);

              const connectionColor = new THREE.Color(0x00ffff)
                .lerp(new THREE.Color(0xff3366), layerProgress);

              const connectionMaterial = new THREE.LineBasicMaterial({
                color: connectionColor,
                opacity: 0.15,
                transparent: true
              });
              const connection = new THREE.Line(connectionGeometry, connectionMaterial);
              scene.add(connection);
              connections.push({
                line: connection,
                start: prevNode,
                end: node,
                material: connectionMaterial
              });
            }
          }
        }
        nodes.push(layer);
      });

      nodesRef.current = nodes;
      connectionsRef.current = connections;
    };

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      animationFrameRef.current = requestAnimationFrame(animate);
      controlsRef.current.update();

      // Rotate tensor space
      if (tensorSpaceRef.current) {
        tensorSpaceRef.current.rotation.y += 0.0002;
      }
      if (equatorialRingRef.current) {
        equatorialRingRef.current.rotation.z += 0.0002;
      }

      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;

      const width = window.innerWidth;
      const height = window.innerHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    setupScene();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (prediction !== null && nodesRef.current.length > 0) {
      highlightPredictionNode(prediction);
    }
  }, [prediction]);

  const highlightPredictionNode = (prediction) => {
    const outputLayer = nodesRef.current[nodesRef.current.length - 1];
    const nodeIndex = Math.floor((prediction / 101) * outputLayer.length);
    const winningNode = outputLayer[Math.min(nodeIndex, outputLayer.length - 1)];

    // Reset previous highlights
    nodesRef.current.forEach(layer => {
      layer.forEach(node => {
        node.material.emissiveIntensity = 0.5;
        node.material.opacity = 0.9;
      });
    });

    connectionsRef.current.forEach(conn => {
      conn.material.opacity = 0.15;
    });

    // Highlight winning node
    winningNode.material.emissiveIntensity = 2;
    winningNode.material.opacity = 1;

    // Highlight connections to winning node
    connectionsRef.current.forEach(conn => {
      if (conn.end === winningNode) {
        conn.material.opacity = 0.8;
      }
    });
  };

  return (
    <NetworkContainer>
      <NetworkCanvas ref={canvasRef} />
    </NetworkContainer>
  );
};

export default NeuralNetwork; 