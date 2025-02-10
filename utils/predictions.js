// Use numbers instead of strings
const POSSIBLE_OUTCOMES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function predictNextValue(chain) {
  // ... existing logic ...
  // Sample from possible outcomes only
  let prediction = sampleFromProbabilityDistribution(POSSIBLE_OUTCOMES, temperature=0.5);
  
  // Force final prediction to be between 1-10
  prediction = Math.max(1, Math.min(10, prediction)); // Clamp value
  
  console.log('Sanitized prediction:', prediction); // Debug logging
  return prediction;
}

function sampleFromProbabilityDistribution(possibleOutcomes, temperature = 0.5) {
  // Ensure we only use numbers 1-10
  const validNumbers = possibleOutcomes.filter(n => typeof n === 'number' && n >= 1 && n <= 10);
  
  // Simple random selection from validated numbers
  const randomIndex = Math.floor(Math.random() * validNumbers.length);
  return validNumbers[randomIndex];
} 