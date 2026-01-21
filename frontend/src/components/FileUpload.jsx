import React, { useRef, useState, useCallback } from 'react';

function FileUpload({ onUpload, isLoading }) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.toLowerCase().endsWith('.csv')
    );

    if (files.length > 0) {
      onUpload(files);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files).filter(
      (file) => file.name.toLowerCase().endsWith('.csv')
    );

    if (files.length > 0) {
      onUpload(files);
    }
  }, [onUpload]);

  const handleSingleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFolderClick = () => {
    folderInputRef.current?.click();
  };

  return (
    <div className="file-upload">
      {/* Hero Section */}
      <div className="hero-section">
        <h2 className="hero-title">Visualize Your Data Instantly</h2>
        <p className="hero-subtitle">
          Transform CSV files into beautiful, interactive charts with just a few clicks
        </p>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSingleClick}
      >
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <h3>Processing your files...</h3>
            <p>This may take a moment for large datasets</p>
          </div>
        ) : (
          <>
            <div className="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3>Drop your CSV files here</h3>
            <p>or click anywhere to browse</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileSelect}
            />

            <input
              ref={folderInputRef}
              type="file"
              accept=".csv"
              webkitdirectory=""
              directory=""
              multiple
              onChange={handleFileSelect}
            />

            <div className="upload-buttons" onClick={(e) => e.stopPropagation()}>
              <button className="upload-btn" onClick={handleSingleClick}>
                Select Files
              </button>
              <button className="upload-btn secondary" onClick={handleFolderClick}>
                Select Folder
              </button>
            </div>
          </>
        )}
      </div>

      {/* Features Section */}
      <div className="features-section">
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h4>Interactive Charts</h4>
          <p>Zoom, pan, and hover for detailed insights</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h4>Batch Processing</h4>
          <p>Upload multiple files or entire folders</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h4>Easy Export</h4>
          <p>Download charts as PNG or SVG</p>
        </div>
      </div>

      {/* Supported Formats */}
      <div className="format-info">
        <p>Supports CSV files with 2 or more columns. Auto-detects time-based data.</p>
      </div>
    </div>
  );
}

export default FileUpload;
