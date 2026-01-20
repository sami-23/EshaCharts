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
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSingleClick}
      >
        {isLoading ? (
          <>
            <h2>Processing...</h2>
            <p>Please wait while your files are being processed</p>
          </>
        ) : (
          <>
            <h2>Upload CSV Files</h2>
            <p>Drag and drop CSV files here</p>
            <p>or click to browse</p>

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

      <div className="upload-info">
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          Supported format: CSV files with 2 or more columns
        </p>
      </div>
    </div>
  );
}

export default FileUpload;
