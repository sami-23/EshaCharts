import React, { useState } from 'react';

function FileSelectorModal({ files, onConfirm, onCancel }) {
  const [selectedIndices, setSelectedIndices] = useState(() => files.map((_, idx) => idx));

  const toggleFile = (index) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  };

  const selectAll = () => {
    setSelectedIndices(files.map((_, idx) => idx));
  };

  const deselectAll = () => {
    setSelectedIndices([]);
  };

  const handleConfirm = () => {
    if (selectedIndices.length >= 2) {
      // Sort indices to maintain consistent order
      onConfirm([...selectedIndices].sort((a, b) => a - b));
    }
  };

  return (
    <div className="file-selector-overlay">
      <div className="file-selector-modal">
        <h2>Compare Files</h2>
        <p className="file-selector-subtitle">
          Select 2 or more files to compare on a single graph
        </p>

        <div className="file-selector-actions-top">
          <button className="file-selector-btn secondary" onClick={selectAll}>
            Select All
          </button>
          <button className="file-selector-btn secondary" onClick={deselectAll}>
            Deselect All
          </button>
        </div>

        <div className="file-list">
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`file-option ${selectedIndices.includes(idx) ? 'selected' : ''}`}
              onClick={() => toggleFile(idx)}
            >
              <input
                type="checkbox"
                checked={selectedIndices.includes(idx)}
                onChange={() => toggleFile(idx)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="file-option-info">
                <span className="file-option-name">
                  {file.filename || file.title}
                </span>
                <span className="file-option-meta">
                  {file.y_data?.length || 0} curve{file.y_data?.length !== 1 ? 's' : ''} &middot;{' '}
                  {file.total_rows?.toLocaleString() || 'N/A'} rows
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="file-selector-footer">
          <span className="selection-count">
            {selectedIndices.length} file{selectedIndices.length !== 1 ? 's' : ''} selected
          </span>
          <div className="file-selector-actions">
            <button className="file-selector-btn secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="file-selector-btn primary"
              onClick={handleConfirm}
              disabled={selectedIndices.length < 2}
            >
              Compare Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileSelectorModal;
