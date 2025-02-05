const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

function analyzeImage(input) {
  const size = 28;
  // Convert flat array to 2D for easier analysis
  const image = [];
  for (let i = 0; i < size; i++) {
    image[i] = input.slice(i * size, (i + 1) * size);
  }

  // Find the bounding box of the drawing
  let minX = size, maxX = 0, minY = size, maxY = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (image[y][x] > 0.1) { // Threshold for considering a pixel as part of the drawing
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // If no drawing found
  if (minX === size || maxX === 0) {
    return { prediction: 0, confidence: 0 };
  }

  // Calculate drawing properties
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const aspectRatio = width / height;
  
  // Count active pixels
  let activePixels = 0;
  let totalIntensity = 0;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (image[y][x] > 0.1) {
        activePixels++;
        totalIntensity += image[y][x];
      }
    }
  }

  // Calculate density (filled area compared to bounding box area)
  const density = activePixels / (width * height);
  
  // Calculate average intensity of active pixels
  const avgIntensity = totalIntensity / activePixels;

  // Make prediction based on drawing characteristics
  let prediction;
  let confidence;

  // Simple heuristic based on drawing properties
  if (width < size / 4) { // Thin drawing - likely 1
    prediction = 1;
    confidence = Math.min(95, 70 + (1 - aspectRatio) * 25);
  } else if (density > 0.7) { // Very filled - likely larger number
    prediction = Math.min(100, Math.floor(density * 100));
    confidence = Math.min(90, 60 + density * 30);
  } else {
    // Estimate based on the amount of space used and density
    prediction = Math.min(100, Math.max(1, Math.floor((width * height * density) / (size * size) * 100)));
    confidence = Math.min(85, 50 + density * 35);
  }

  return {
    prediction,
    confidence: Math.round(confidence)
  };
}

app.post('/api/predict', async (req, res) => {
  try {
    const { input } = req.body;
    
    if (!input || !Array.isArray(input) || input.length !== 784) { // 28x28 = 784
      return res.status(400).json({ error: 'Invalid input format' });
    }
    
    // Analyze the drawing and make a prediction
    const result = analyzeImage(input);
    
    res.json(result);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 