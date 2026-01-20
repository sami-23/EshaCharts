import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import GraphDisplay from './components/GraphDisplay';
import ControlPanel from './components/ControlPanel';
import Navigation from './components/Navigation';
import AxisSelector from './components/AxisSelector';
import './App.css';

// Use environment variable for API URL, fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Default graph settings
const getDefaultSettings = () => ({
  showTitle: true,
  showAxisLabels: true,
  swapAxes: false,
  xAxisFormat: 'normal', // 'normal' or 'scientific'
  yAxisFormat: 'normal',
  curves: [], // Will be populated with curve-specific settings
});

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentData, setCurrentData] = useState(null);
  const [graphSettings, setGraphSettings] = useState({}); // Per-file settings
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'

  // Axis selection state
  const [pendingFiles, setPendingFiles] = useState([]); // Files waiting for axis confirmation
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [axisSelectIndex, setAxisSelectIndex] = useState(0); // Current file being configured
  const [showAxisSelector, setShowAxisSelector] = useState(false);

  // Initialize curve settings for a file based on its y_data
  const initializeCurveSettings = useCallback((data) => {
    const defaultColors = [
      '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
      '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];

    return data.y_data.map((curve, idx) => ({
      name: curve.name,
      visible: true,
      color: defaultColors[idx % defaultColors.length],
      width: 2,
    }));
  }, []);

  // Apply custom axis configuration to file data
  const applyAxisConfig = useCallback((fileData, axisConfig) => {
    // Use all_column_data from backend for axis reconfiguration
    // Note: JSON keys are always strings, so we need to access with string keys
    const columnData = fileData.all_column_data || {};

    // Helper to get column data (handles both string and int keys)
    const getColumnData = (idx) => columnData[String(idx)] || columnData[idx] || [];

    // Create new y_data based on selected y_indices
    const newYData = axisConfig.y_indices.map((yIdx) => ({
      name: fileData.columns[yIdx],
      data: getColumnData(yIdx),
    }));

    // Get x_data from selected column
    const newXData = getColumnData(axisConfig.x_index);

    return {
      ...fileData,
      x_name: axisConfig.x_name,
      x_data: newXData,
      y_data: newYData,
      axes_config: axisConfig,
    };
  }, []);

  // Handle file upload - now shows axis selector first
  const handleUpload = useCallback(async (uploadedFiles) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      const isMultiple = uploadedFiles.length > 1;

      if (isMultiple) {
        uploadedFiles.forEach((file) => {
          formData.append('files', file);
        });
      } else {
        formData.append('file', uploadedFiles[0]);
      }

      const endpoint = isMultiple ? '/upload/multiple' : '/upload/single';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();

      // Fetch all files if multiple
      let allFiles;
      if (isMultiple) {
        const allFilesResponse = await fetch(`${API_URL}/session/${result.session_id}/all`);
        const allFilesData = await allFilesResponse.json();
        allFiles = allFilesData.files;
      } else {
        allFiles = [result.data];
      }

      // Show axis selector for first file
      // Backend now provides all_column_data for axis reconfiguration
      setPendingFiles(allFiles);
      setPendingSessionId(result.session_id);
      setAxisSelectIndex(0);
      setShowAxisSelector(true);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle axis confirmation for current file
  const handleAxisConfirm = useCallback((axisConfig) => {
    const currentFile = pendingFiles[axisSelectIndex];
    const updatedFile = applyAxisConfig(currentFile, axisConfig);

    // Update the file in pending list
    const newPendingFiles = [...pendingFiles];
    newPendingFiles[axisSelectIndex] = updatedFile;
    setPendingFiles(newPendingFiles);

    // Move to next file or finalize
    if (axisSelectIndex < pendingFiles.length - 1) {
      setAxisSelectIndex(axisSelectIndex + 1);
    } else {
      // All files configured, finalize session
      finalizeSession(newPendingFiles, pendingSessionId);
    }
  }, [pendingFiles, axisSelectIndex, pendingSessionId, applyAxisConfig]);

  // Finalize session after all axes are configured
  const finalizeSession = useCallback((configuredFiles, sessId) => {
    setSessionId(sessId);
    setFiles(configuredFiles);
    setCurrentIndex(0);
    setCurrentData(configuredFiles[0]);

    // Initialize settings for all files
    const newSettings = {};
    configuredFiles.forEach((file, idx) => {
      newSettings[idx] = {
        ...getDefaultSettings(),
        curves: initializeCurveSettings(file),
      };
    });
    setGraphSettings(newSettings);

    // Clear pending state
    setPendingFiles([]);
    setPendingSessionId(null);
    setAxisSelectIndex(0);
    setShowAxisSelector(false);
  }, [initializeCurveSettings]);

  // Handle axis selector cancel
  const handleAxisCancel = useCallback(async () => {
    // Delete the session since user cancelled
    if (pendingSessionId) {
      try {
        await fetch(`${API_URL}/session/${pendingSessionId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }

    // Clear pending state
    setPendingFiles([]);
    setPendingSessionId(null);
    setAxisSelectIndex(0);
    setShowAxisSelector(false);
  }, [pendingSessionId]);

  // Skip axis selection and use auto-detected (for convenience)
  const handleUseAutoDetected = useCallback(() => {
    // Use all files as-is with their auto-detected axes
    finalizeSession(pendingFiles, pendingSessionId);
  }, [pendingFiles, pendingSessionId, finalizeSession]);

  // Navigate to specific file
  const navigateToFile = useCallback(async (index) => {
    if (!sessionId || index < 0 || index >= files.length) return;

    setCurrentIndex(index);
    setCurrentData(files[index]);

    // Initialize settings if not exists
    if (!graphSettings[index]) {
      setGraphSettings((prev) => ({
        ...prev,
        [index]: {
          ...getDefaultSettings(),
          curves: initializeCurveSettings(files[index]),
        },
      }));
    }
  }, [sessionId, files, graphSettings, initializeCurveSettings]);

  // Update settings for current graph
  const updateSettings = useCallback((updates) => {
    setGraphSettings((prev) => ({
      ...prev,
      [currentIndex]: {
        ...prev[currentIndex],
        ...updates,
      },
    }));
  }, [currentIndex]);

  // Update specific curve settings
  const updateCurveSettings = useCallback((curveIndex, updates) => {
    setGraphSettings((prev) => {
      const currentSettings = prev[currentIndex];
      const newCurves = [...currentSettings.curves];
      newCurves[curveIndex] = { ...newCurves[curveIndex], ...updates };

      return {
        ...prev,
        [currentIndex]: {
          ...currentSettings,
          curves: newCurves,
        },
      };
    });
  }, [currentIndex]);

  // Reset session
  const handleReset = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${API_URL}/session/${sessionId}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    }
    setSessionId(null);
    setFiles([]);
    setCurrentIndex(0);
    setCurrentData(null);
    setGraphSettings({});
    setError(null);
  }, [sessionId]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const currentSettings = graphSettings[currentIndex] || getDefaultSettings();

  return (
    <div className={`app ${theme}`}>
      <header className="app-header">
        <h1>EshaCharts</h1>
        <div className="header-controls">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {sessionId && (
            <button className="reset-btn" onClick={handleReset}>
              New Session
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {!sessionId && !showAxisSelector ? (
          <FileUpload onUpload={handleUpload} isLoading={isLoading} />
        ) : showAxisSelector ? (
          <div className="axis-selector-wrapper">
            <AxisSelector
              data={pendingFiles[axisSelectIndex]}
              onConfirm={handleAxisConfirm}
              onCancel={handleAxisCancel}
            />
            <div className="axis-selector-footer">
              <p>
                Configuring file {axisSelectIndex + 1} of {pendingFiles.length}
              </p>
              {pendingFiles.length > 1 && (
                <button
                  className="skip-all-btn"
                  onClick={handleUseAutoDetected}
                >
                  Use Auto-Detected for All Files
                </button>
              )}
              {pendingFiles.length === 1 && (
                <button
                  className="skip-all-btn"
                  onClick={handleUseAutoDetected}
                >
                  Use Auto-Detected
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="graph-container">
              {isLoading ? (
                <div className="loading">Loading...</div>
              ) : error ? (
                <div className="error">{error}</div>
              ) : currentData ? (
                <GraphDisplay
                  data={currentData}
                  settings={currentSettings}
                  theme={theme}
                />
              ) : null}
            </div>

            <div className="sidebar">
              <Navigation
                currentIndex={currentIndex}
                totalFiles={files.length}
                onNavigate={navigateToFile}
                files={files}
              />

              {currentData && (
                <ControlPanel
                  data={currentData}
                  settings={currentSettings}
                  onUpdateSettings={updateSettings}
                  onUpdateCurve={updateCurveSettings}
                  sessionId={sessionId}
                  allFiles={files}
                  allSettings={graphSettings}
                  theme={theme}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="toast error-toast">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
