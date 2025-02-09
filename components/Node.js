function Node({ x, y, value, nextX, nextY }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Connection line to next node */}
      {nextX && (
        <line
          x1="50"
          y1="50"
          x2={nextX - x}
          y2={nextY - y}
          stroke="#666"
          strokeWidth="2"
        />
      )}
      {/* Node circle */}
      <circle cx="50" cy="50" r="40" fill="#fff" stroke="#666" strokeWidth="2"/>
      {/* ... existing value display code ... */}
    </g>
  );
} 