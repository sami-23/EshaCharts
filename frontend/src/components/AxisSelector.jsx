import React, { useState, useEffect } from 'react';

function AxisSelector({ data, onConfirm, onCancel, currentFileIndex, totalFiles }) {
  const [xAxis, setXAxis] = useState(0);
  const [yAxes, setYAxes] = useState([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Initialize with auto-detected values
  useEffect(() => {
    if (data) {
      // Use axes_config from backend if available
      if (data.axes_config) {
        // If backend detected "Index" as X, default to first column instead
        const detectedX = data.axes_config.x_index;
        setXAxis(detectedX >= 0 ? detectedX : 0);
        setYAxes(data.axes_config.y_indices || []);
      } else {
        // Fallback: Find the x-axis index from the data
        const xIndex = data.columns.indexOf(data.x_name);
        // Always use a real column, not row index
        setXAxis(xIndex >= 0 ? xIndex : 0);

        // Set y-axes from the detected y_data
        const yIndices = data.y_data.map((y) => data.columns.indexOf(y.name));
        setYAxes(yIndices.filter((i) => i >= 0));
      }
    }
  }, [data]);

  const handleXAxisChange = (e) => {
    const newX = parseInt(e.target.value, 10);
    setXAxis(newX);

    // Remove from Y if it was selected there
    if (newX >= 0) {
      setYAxes((prev) => prev.filter((y) => y !== newX));
    }
  };

  const handleYAxisToggle = (index) => {
    if (index === xAxis) return; // Can't select X-axis column as Y

    setYAxes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((y) => y !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleConfirm = () => {
    if (xAxis === null || xAxis < 0) {
      alert('Please select an X-axis column');
      return;
    }
    if (yAxes.length === 0) {
      alert('Please select at least one Y-axis column');
      return;
    }

    const newConfig = {
      x_index: xAxis,
      x_name: data.columns[xAxis],
      y_indices: yAxes,
      y_names: yAxes.map((i) => data.columns[i]),
    };

    setIsConfirmed(true);
    setTimeout(() => onConfirm(newConfig), 380);
  };

  if (!data) return null;

  return (
    <div className="axis-selector-overlay">
      <div className="axis-selector-modal">
        <h2>Configure Axes</h2>
        <p className="axis-selector-subtitle">
          File: <strong>{data.filename}</strong>
        </p>

        {totalFiles > 1 && (
          <div className="axis-progress">
            {Array.from({ length: totalFiles }, (_, i) => (
              <div
                key={i}
                className={`axis-progress-dot ${i < currentFileIndex ? 'done' : i === currentFileIndex ? 'active' : ''}`}
                title={`File ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="axis-selector-info">
          <p>
            Auto-detected: <strong>{data.x_name}</strong> as X-axis
          </p>
          <p>Confirm or select different columns below:</p>
        </div>

        <div className="axis-selector-content">
          {/* X-Axis Selection */}
          <div className="axis-section">
            <h3>X-Axis (Independent Variable)</h3>
            <select
              value={xAxis}
              onChange={handleXAxisChange}
              className="axis-select"
            >
              {data.columns.map((col, idx) => (
                <option key={idx} value={idx}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axes Selection */}
          <div className="axis-section">
            <h3>Y-Axis (Dependent Variables)</h3>
            <p className="axis-hint">Select one or more columns:</p>
            <div className="y-axis-list">
              {data.columns.map((col, idx) => {
                const isXAxis = idx === xAxis;
                const isSelected = yAxes.includes(idx);

                return (
                  <label
                    key={idx}
                    className={`y-axis-option ${isXAxis ? 'disabled' : ''} ${
                      isSelected ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isXAxis}
                      onChange={() => handleYAxisToggle(idx)}
                    />
                    <span className="column-name">{col}</span>
                    {isXAxis && <span className="x-badge">X</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="axis-preview">
          <p>
            <strong>Preview:</strong> X = {data.columns[xAxis] || '(select)'}
            {' → '}Y = {yAxes.length > 0 ? yAxes.map((i) => data.columns[i]).join(', ') : '(none selected)'}
          </p>
        </div>

        {/* Actions */}
        <div className="axis-selector-actions">
          <button className="axis-btn secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`axis-btn primary${isConfirmed ? ' confirmed' : ''}`}
            onClick={handleConfirm}
            disabled={yAxes.length === 0 || isConfirmed}
          >
            {isConfirmed ? '✓ Confirmed!' : 'Confirm & Plot'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AxisSelector;
