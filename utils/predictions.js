// Limit possible predictions to numbers 1-10
const POSSIBLE_OUTCOMES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function predictNextValue(chain) {
  // ... existing logic ...
  // Sample from possible outcomes only
  return sampleFromProbabilityDistribution(POSSIBLE_OUTCOMES, temperature=0.5);
} 