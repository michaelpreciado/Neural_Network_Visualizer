import * as tf from '@tensorflow/tfjs';

class ModelService {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.loadModel();
  }

  async loadModel() {
    if (this.model || this.isLoading) return;
    
    try {
      this.isLoading = true;
      // Load pre-trained MNIST model
      this.model = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mnist_transfer_cnn_v1/model.json');
      console.log('AI model loaded successfully');
    } catch (error) {
      console.error('Error loading AI model:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async predict(input) {
    if (!this.model) {
      await this.loadModel();
      if (!this.model) throw new Error('Model not available');
    }

    // Preprocess input to match MNIST format
    const tensor = tf.tensor(input)
      .reshape([1, 28, 28, 1])
      .div(255); // Normalize to [0, 1]

    // Get prediction
    const predictions = await this.model.predict(tensor).array();
    const result = predictions[0];

    // Get top 3 predictions
    const indices = Array.from(result.keys());
    indices.sort((a, b) => result[b] - result[a]);

    const topPredictions = indices.slice(0, 3).map(index => ({
      digit: index,
      confidence: Math.round(result[index] * 100)
    }));

    // Clean up tensor
    tensor.dispose();

    return {
      prediction: topPredictions[0].digit,
      confidence: topPredictions[0].confidence,
      alternatives: topPredictions.slice(1)
    };
  }
}

export const modelService = new ModelService(); 