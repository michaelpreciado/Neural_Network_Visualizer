import React, { useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import NeuralNetwork from './components/NeuralNetwork';
import DrawingCanvas from './components/DrawingCanvas';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    -webkit-tap-highlight-color: transparent;
  }

  body {
    font-family: 'JetBrains Mono', monospace;
    background: black;
    color: #00ffff;
    overflow: hidden;
  }
`;

const Title = styled.h1`
  position: fixed;
  top: 20px;
  left: 20px;
  color: rgba(0, 255, 255, 0.9);
  font-size: min(24px, 6vw);
  font-weight: 300;
  z-index: 2;
  text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
  pointer-events: none;
`;

const Subtitle = styled.p`
  position: fixed;
  top: 60px;
  left: 20px;
  color: rgba(0, 255, 255, 0.7);
  font-size: min(16px, 4.5vw);
  z-index: 2;
  pointer-events: none;
`;

const NetworkStats = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 10px;
  padding: 15px;
  max-width: 250px;
  backdrop-filter: blur(5px);

  @media (max-width: 768px) {
    display: none;
  }
`;

const StatItem = styled.div`
  margin: 5px 0;
  font-size: 14px;
`;

const App = () => {
  const [prediction, setPrediction] = useState(null);

  const handleRecognize = () => {
    // Implement number recognition logic here
    const randomPrediction = Math.floor(Math.random() * 101);
    setPrediction(randomPrediction);
  };

  return (
    <>
      <GlobalStyle />
      <Title>Neural Network Number Recognition</Title>
      <Subtitle>Draw a number (0-100) to see the network process it</Subtitle>
      
      <NetworkStats>
        <StatItem>Input Layer: 64 nodes</StatItem>
        <StatItem>Hidden Layer 1: 128 nodes</StatItem>
        <StatItem>Hidden Layer 2: 256 nodes</StatItem>
        <StatItem>Hidden Layer 3: 512 nodes</StatItem>
        <StatItem>Hidden Layer 4: 256 nodes</StatItem>
        <StatItem>Hidden Layer 5: 128 nodes</StatItem>
        <StatItem>Hidden Layer 6: 64 nodes</StatItem>
        <StatItem>Output Layer: 101 nodes (0-100)</StatItem>
      </NetworkStats>

      <NeuralNetwork prediction={prediction} />
      <DrawingCanvas onRecognize={handleRecognize} />
    </>
  );
};

export default App; 