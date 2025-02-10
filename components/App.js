function App() {
  return (
    <div className="app">
      {/* ... existing SVG and controls ... */}
      
      {/* Add instructions */}
      <div className="instructions">
        <p>🔢 Guess a number between 1 and 10!</p>
        <p>The AI will try to predict your next number based on the sequence pattern.</p>
      </div>
    </div>
  );
}

// Add styles
<style>{`
  .instructions {
    text-align: center;
    margin: 2rem;
    font-size: 1.2rem;
    color: #444;
  }
  .instructions p:first-child {
    font-weight: bold;
    font-size: 1.4rem;
    color: #2c3e50;
  }
`}</style> 