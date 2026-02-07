import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import GraphDisplay from './components/GraphDisplay';
import ControlPanel from './components/ControlPanel';
import CompareControlPanel from './components/CompareControlPanel';
import Navigation from './components/Navigation';
import AxisSelector from './components/AxisSelector';
import FileSelectorModal from './components/FileSelectorModal';
import './App.css';

// Use environment variable for API URL, fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Default graph settings
const getDefaultSettings = () => ({
  showTitle: true,
  showAxisLabels: true,
  swapAxes: false,
  customTitle: '',
  customXLabel: '',
  customYLabel: '',
  xAxisFormat: 'exponential', // 'normal', 'scientific', or 'exponential'
  yAxisFormat: 'exponential',
  normalizeX: false, // subtract min x so axis starts from 0
  bgColor: '', // empty means transparent/default
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

  // Compare mode state
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareFileIndices, setCompareFileIndices] = useState([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [compareSettings, setCompareSettings] = useState({
    showTitle: true,
    showAxisLabels: true,
    customTitle: '',
    customXLabel: '',
    customYLabel: '',
    xAxisFormat: 'exponential',
    yAxisFormat: 'exponential',
    normalizeX: false,
    bgColor: '',
    compareLayout: 'overlay', // 'overlay' or 'sequential'
  });
  const [compareCurveSettings, setCompareCurveSettings] = useState({});

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

  // Apply current graph's design settings to all other graphs
  const applySettingsToAll = useCallback(() => {
    const source = graphSettings[currentIndex];
    if (!source) return;

    setGraphSettings((prev) => {
      const updated = { ...prev };
      for (let i = 0; i < files.length; i++) {
        if (i === currentIndex) continue;
        const targetFile = files[i];
        // Copy display settings and formats, but adapt curves to target file's curve count
        const targetCurves = targetFile.y_data.map((_, curveIdx) => {
          const sourceCurve = source.curves[curveIdx % source.curves.length];
          return {
            ...(updated[i]?.curves?.[curveIdx] || {}),
            color: sourceCurve?.color || '#1f77b4',
            width: sourceCurve?.width || 2,
          };
        });
        updated[i] = {
          ...updated[i],
          showTitle: source.showTitle,
          showAxisLabels: source.showAxisLabels,
          xAxisFormat: source.xAxisFormat,
          yAxisFormat: source.yAxisFormat,
          bgColor: source.bgColor,
          curves: targetCurves,
        };
      }
      return updated;
    });
  }, [currentIndex, graphSettings, files]);

  // File colors for compare mode - each file gets a distinct base color
  const fileColors = [
    '#1f77b4', // Blue
    '#ff7f0e', // Orange
    '#2ca02c', // Green
    '#d62728', // Red
    '#9467bd', // Purple
    '#8c564b', // Brown
    '#e377c2', // Pink
    '#7f7f7f', // Gray
  ];

  // Enter compare mode - opens file selector modal
  const enterCompareMode = useCallback(() => {
    setShowFileSelector(true);
  }, []);

  // Confirm compare selection - validates and initializes compare mode
  const confirmCompareSelection = useCallback((selectedIndices) => {
    if (selectedIndices.length < 2) {
      return; // Need at least 2 files
    }

    // Initialize curve settings for all selected files
    const newCurveSettings = {};
    selectedIndices.forEach((fileIndex, fileColorIdx) => {
      const file = files[fileIndex];
      const baseColor = fileColors[fileColorIdx % fileColors.length];

      file.y_data.forEach((curve, curveIdx) => {
        const curveKey = `${fileIndex}-${curveIdx}`;
        newCurveSettings[curveKey] = {
          visible: true,
          color: baseColor,
          width: 2,
          name: curve.name,
          fileName: file.filename || file.title,
        };
      });
    });

    setCompareCurveSettings(newCurveSettings);
    setCompareFileIndices(selectedIndices);
    setShowFileSelector(false);
    setIsCompareMode(true);
  }, [files, fileColors]);

  // Exit compare mode
  const exitCompareMode = useCallback(() => {
    setIsCompareMode(false);
    setCompareFileIndices([]);
    setCompareCurveSettings({});
    setCompareSettings({
      showTitle: true,
      showAxisLabels: true,
      customTitle: '',
      customXLabel: '',
      customYLabel: '',
      xAxisFormat: 'exponential',
      yAxisFormat: 'exponential',
      normalizeX: false,
      bgColor: '',
      compareLayout: 'overlay',
    });
  }, []);

  // Update compare display settings
  const updateCompareSettings = useCallback((updates) => {
    setCompareSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update individual curve in compare mode
  const updateCompareCurve = useCallback((curveKey, updates) => {
    setCompareCurveSettings((prev) => ({
      ...prev,
      [curveKey]: { ...prev[curveKey], ...updates },
    }));
  }, []);

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
    // Exit compare mode on reset
    setIsCompareMode(false);
    setCompareFileIndices([]);
    setCompareCurveSettings({});
    setShowFileSelector(false);
  }, [sessionId]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const currentSettings = graphSettings[currentIndex] || getDefaultSettings();

  // Prepare compare data with file indices
  const compareData = isCompareMode
    ? compareFileIndices.map((fileIndex) => ({
        ...files[fileIndex],
        _compareFileIndex: fileIndex,
      }))
    : [];

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
              ) : isCompareMode ? (
                <GraphDisplay
                  data={null}
                  settings={currentSettings}
                  theme={theme}
                  isCompareMode={true}
                  compareData={compareData}
                  compareCurveSettings={compareCurveSettings}
                  compareSettings={compareSettings}
                />
              ) : currentData ? (
                <GraphDisplay
                  data={currentData}
                  settings={currentSettings}
                  theme={theme}
                  isCompareMode={false}
                />
              ) : null}
            </div>

            <div className="sidebar">
              <Navigation
                currentIndex={currentIndex}
                totalFiles={files.length}
                onNavigate={navigateToFile}
                files={files}
                isCompareMode={isCompareMode}
                onEnterCompare={enterCompareMode}
                onExitCompare={exitCompareMode}
                compareFileCount={compareFileIndices.length}
              />

              {isCompareMode ? (
                <CompareControlPanel
                  compareData={compareData}
                  compareSettings={compareSettings}
                  compareCurveSettings={compareCurveSettings}
                  onUpdateSettings={updateCompareSettings}
                  onUpdateCurve={updateCompareCurve}
                  theme={theme}
                />
              ) : currentData && (
                <ControlPanel
                  data={currentData}
                  settings={currentSettings}
                  onUpdateSettings={updateSettings}
                  onUpdateCurve={updateCurveSettings}
                  sessionId={sessionId}
                  allFiles={files}
                  allSettings={graphSettings}
                  theme={theme}
                  onApplyToAll={applySettingsToAll}
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

      {showFileSelector && (
        <FileSelectorModal
          files={files}
          onConfirm={confirmCompareSelection}
          onCancel={() => setShowFileSelector(false)}
        />
      )}
    </div>
  );
}

export default App;
