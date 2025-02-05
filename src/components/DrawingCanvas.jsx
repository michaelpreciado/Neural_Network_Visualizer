import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import { modelService } from '../services/modelService';

const DrawingContainer = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  min-height: 200px;
  backdrop-filter: blur(10px);

  @media (max-width: 768px) {
    min-height: 100px;
    padding: 6px;
    padding-bottom: max(6px, env(safe-area-inset-bottom, 6px));
    flex-direction: row;
    gap: 6px;
    align-items: center;
    justify-content: space-around;
  }
`;

const CanvasWrapper = styled.div`
  position: relative;
  width: min(160px, 20vw);
  height: min(160px, 20vw);
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 10px;
  border: 1px solid rgba(0, 255, 255, 0.3);
  box-shadow: 0 0 20px rgba(0, 255, 255, 0.1);
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(0, 255, 255, 0.9);
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
  }

  @media (max-width: 768px) {
    width: min(100px, 25vw);
    height: min(100px, 25vw);
    padding: 3px;
    margin-right: 2px;
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;

  @media (max-width: 768px) {
    flex: 0 0 auto;
    gap: 6px;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 10px;

  @media (max-width: 768px) {
    gap: 4px;
    margin-top: 4px;
    flex-direction: row;
  }
`;

const Button = styled.button`
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 255, 0.3);
  color: #00ffff;
  font-family: 'JetBrains Mono', monospace;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 12px;
  min-width: 90px;

  &:hover {
    border-color: rgba(0, 255, 255, 0.9);
    box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(1px);
  }

  @media (max-width: 768px) {
    min-width: 40px;
    padding: 3px 6px;
    font-size: 9px;
    letter-spacing: 0.3px;
  }
`;

const PredictionDisplay = styled.div`
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 8px;
  padding: 10px;
  color: #00ffff;
  text-align: center;
  min-width: 140px;
  backdrop-filter: blur(5px);
  font-size: 14px;

  @media (max-width: 768px) {
    min-width: 60px;
    padding: 4px;
    font-size: 10px;
  }
`;

const ConfidenceBar = styled.div`
  width: 100%;
  height: 3px;
  background: rgba(0, 255, 255, 0.1);
  border-radius: 2px;
  margin: 8px 0;
  overflow: hidden;
`;

const ConfidenceProgress = styled.div`
  width: ${props => props.$confidence}%;
  height: 100%;
  background: #00ffff;
  transition: width 0.5s ease;
`;

const StyledCanvas = styled.canvas`
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 6px;
`;

const AlternativePredictions = styled.div`
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
  
  @media (max-width: 768px) {
    font-size: 8px;
  }
`;

const DrawingCanvas = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [alternatives, setAlternatives] = useState([]);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const initCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const wrapper = canvas.parentElement;
      
      // Get the actual dimensions of the wrapper
      const rect = wrapper.getBoundingClientRect();
      
      // Set both CSS and canvas dimensions to the same size
      const size = Math.min(rect.width, rect.height);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = size;
      canvas.height = size;
      
      // Set drawing style
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = Math.max(2, size / 15); // Responsive line width
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const getDrawingPosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    // Direct pixel mapping since canvas dimensions match display dimensions
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const pos = getDrawingPosition(e);
    setIsDrawing(true);
    lastPos.current = pos;

    // Draw a single point
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffff';
    ctx.fill();
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const pos = getDrawingPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    lastPos.current = pos;
  };

  const stopDrawing = (e) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPrediction(null);
    setConfidence(0);
    setAlternatives([]);
  };

  const preprocessCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Get the current drawing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Create a temporary canvas for preprocessing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = 28; // Standard size for digit recognition
    tempCanvas.height = 28;
    
    // Draw current canvas content onto temp canvas (this scales it to 28x28)
    tempCtx.fillStyle = 'black';
    tempCtx.fillRect(0, 0, 28, 28);
    tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, 28, 28);
    
    // Get the scaled image data
    const scaledData = tempCtx.getImageData(0, 0, 28, 28);
    const input = new Float32Array(28 * 28);
    
    // Convert to grayscale and normalize to [0, 1]
    for (let i = 0; i < scaledData.data.length; i += 4) {
      const grayscale = scaledData.data[i + 3] / 255; // Use alpha channel since we're drawing in cyan
      input[i / 4] = grayscale;
    }
    
    return input;
  };

  const findBoundingBox = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    
    // Find the bounding box of the drawing
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const alpha = data[((y * canvas.width) + x) * 4 + 3];
        if (alpha > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    return { minX, minY, maxX, maxY };
  };

  const centerDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Find the current bounding box
    const bbox = findBoundingBox();
    if (bbox.minX === canvas.width) return; // No drawing found
    
    // Calculate dimensions and center offset
    const width = bbox.maxX - bbox.minX;
    const height = bbox.maxY - bbox.minY;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Get current drawing
    const imageData = ctx.getImageData(bbox.minX, bbox.minY, width, height);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw centered
    ctx.putImageData(
      imageData,
      centerX - width / 2,
      centerY - height / 2
    );
  };

  const handleRecognize = async () => {
    try {
      // Center the drawing first
      centerDrawing();
      
      // Preprocess the canvas data
      const input = preprocessCanvas();
      
      // Get prediction from AI model
      const result = await modelService.predict(input);
      
      setPrediction(result.prediction);
      setConfidence(result.confidence);
      setAlternatives(result.alternatives);
    } catch (error) {
      console.error('Prediction error:', error);
      setPrediction(null);
      setConfidence(0);
      setAlternatives([]);
    }
  };

  return (
    <DrawingContainer>
      <ControlsContainer>
        <CanvasWrapper>
          <StyledCanvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
          />
        </CanvasWrapper>
        <Controls>
          <Button onClick={clearCanvas}>Clear</Button>
          <Button onClick={handleRecognize}>Recognize</Button>
        </Controls>
      </ControlsContainer>
      
      <PredictionDisplay>
        <div>Number: {prediction !== null ? prediction : '--'}</div>
        <ConfidenceBar>
          <ConfidenceProgress $confidence={confidence} />
        </ConfidenceBar>
        <div>{confidence}%</div>
        {alternatives.length > 0 && (
          <AlternativePredictions>
            Also could be: {alternatives.map(alt => 
              `${alt.digit} (${alt.confidence}%)`
            ).join(', ')}
          </AlternativePredictions>
        )}
      </PredictionDisplay>
    </DrawingContainer>
  );
};

export default DrawingCanvas; 