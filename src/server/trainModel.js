const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;

async function createAndTrainModel() {
  // Create synthetic training data for numbers 0-100
  const numSamples = 10000;
  const imageSize = 28;
  const numClasses = 101; // 0-100

  // Generate synthetic data
  const trainImages = new Float32Array(numSamples * imageSize * imageSize);
  const trainLabels = new Float32Array(numSamples * numClasses);

  for (let i = 0; i < numSamples; i++) {
    // Generate a random number 0-100
    const label = Math.floor(Math.random() * numClasses);
    
    // Create a simple representation of the number
    const row = Math.floor(Math.random() * imageSize);
    const colStart = Math.floor(Math.random() * (imageSize - Math.min(label + 1, imageSize)));
    
    // Draw the number as a horizontal line
    for (let j = 0; j < Math.min(label + 1, imageSize); j++) {
      const idx = i * (imageSize * imageSize) + row * imageSize + (colStart + j);
      trainImages[idx] = 1;
    }
    
    // One-hot encode the label
    trainLabels[i * numClasses + label] = 1;
  }

  // Convert to tensors with proper shape
  const xs = tf.tensor4d(trainImages, [numSamples, imageSize, imageSize, 1]);
  const ys = tf.tensor2d(trainLabels, [numSamples, numClasses]);

  // Create the model
  const model = tf.sequential();
  
  // Convolutional layers
  model.add(tf.layers.conv2d({
    inputShape: [imageSize, imageSize, 1],
    filters: 32,
    kernelSize: 3,
    activation: 'relu',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  
  model.add(tf.layers.conv2d({
    filters: 64,
    kernelSize: 3,
    activation: 'relu',
  }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  
  // Dense layers
  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.5 }));
  model.add(tf.layers.dense({ units: numClasses, activation: 'softmax' }));

  // Compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  // Train the model
  await model.fit(xs, ys, {
    epochs: 10,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
      }
    }
  });

  // Create model directory if it doesn't exist
  const modelDir = './model';
  try {
    await fs.mkdir(modelDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }

  // Save the model
  await model.save('file://./model');
  console.log('Model trained and saved successfully');
}

createAndTrainModel().catch(console.error); 