import React from 'react';

function Navigation({ currentIndex, totalFiles, onNavigate, files }) {
  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalFiles - 1) {
      onNavigate(currentIndex + 1);
    }
  };

  const handleSelectChange = (e) => {
    const index = parseInt(e.target.value, 10);
    onNavigate(index);
  };

  return (
    <div className="navigation">
      <h3>Navigation</h3>

      <div className="nav-controls">
        <button
          className="nav-btn"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          Previous
        </button>

        <span className="nav-info">
          {currentIndex + 1} / {totalFiles}
        </span>

        <button
          className="nav-btn"
          onClick={handleNext}
          disabled={currentIndex >= totalFiles - 1}
        >
          Next
        </button>
      </div>

      {totalFiles > 1 && (
        <select
          className="file-select"
          value={currentIndex}
          onChange={handleSelectChange}
        >
          {files.map((file, idx) => (
            <option key={idx} value={idx}>
              {file.title || file.filename}
            </option>
          ))}
        </select>
      )}

      {files[currentIndex] && (
        <div
          style={{
            marginTop: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <p>
            <strong>File:</strong> {files[currentIndex].filename}
          </p>
          <p>
            <strong>Rows:</strong> {files[currentIndex].total_rows?.toLocaleString() || 'N/A'}
          </p>
          <p>
            <strong>Columns:</strong> {files[currentIndex].columns?.length || 0}
          </p>
        </div>
      )}
    </div>
  );
}

export default Navigation;
