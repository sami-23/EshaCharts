import React, { useCallback, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

function ControlPanel({
  data,
  settings,
  onUpdateSettings,
  onUpdateCurve,
  sessionId,
  allFiles,
  allSettings,
  theme,
}) {
  const [exportFormat, setExportFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);

  // Export current graph
  const exportCurrentGraph = useCallback(async () => {
    const plotDiv = window.currentPlotDiv;
    if (!plotDiv) {
      alert('Graph not ready for export');
      return;
    }

    setIsExporting(true);
    try {
      const options = {
        format: exportFormat,
        filename: data.title,
        height: 800,
        width: 1200,
        scale: 2,
      };

      await Plotly.downloadImage(plotDiv, options);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [exportFormat, data.title]);

  // Batch export all graphs
  const exportAllGraphs = useCallback(async () => {
    if (!allFiles || allFiles.length === 0) return;

    setIsExporting(true);
    try {
      const zip = new JSZip();
      const isDark = theme === 'dark';

      for (let i = 0; i < allFiles.length; i++) {
        const fileData = allFiles[i];
        const fileSettings = allSettings[i] || {
          showTitle: true,
          showAxisLabels: true,
          swapAxes: false,
          xAxisFormat: 'normal',
          yAxisFormat: 'normal',
          curves: fileData.y_data.map((_, idx) => ({
            visible: true,
            color: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'][idx % 5],
            width: 2,
          })),
        };

        // Create traces
        const traces = fileData.y_data.map((yData, idx) => {
          const curveSettings = fileSettings.curves[idx] || {
            visible: true,
            color: '#1f77b4',
            width: 2,
          };

          return {
            x: fileSettings.swapAxes ? yData.data : fileData.x_data,
            y: fileSettings.swapAxes ? fileData.x_data : yData.data,
            type: 'scatter',
            mode: 'lines',
            name: yData.name,
            visible: curveSettings.visible ? true : 'legendonly',
            line: {
              color: curveSettings.color,
              width: curveSettings.width,
            },
          };
        });

        // Create layout
        const xAxisName = fileSettings.swapAxes
          ? (fileData.y_data[0]?.name || 'Y')
          : fileData.x_name;
        const yAxisName = fileSettings.swapAxes
          ? fileData.x_name
          : (fileData.y_data.length === 1 ? fileData.y_data[0].name : 'Value');

        const getTickFormat = (format) => {
          switch (format) {
            case 'scientific': return '.2e';
            default: return '';
          }
        };

        const layout = {
          title: fileSettings.showTitle ? { text: fileData.title } : null,
          xaxis: {
            title: fileSettings.showAxisLabels ? { text: xAxisName } : null,
            tickformat: getTickFormat(fileSettings.xAxisFormat),
          },
          yaxis: {
            title: fileSettings.showAxisLabels ? { text: yAxisName } : null,
            tickformat: getTickFormat(fileSettings.yAxisFormat),
          },
          paper_bgcolor: isDark ? '#1a1a2e' : '#ffffff',
          plot_bgcolor: isDark ? '#16213e' : '#ffffff',
          font: { color: isDark ? '#e8e8e8' : '#212529' },
          showlegend: fileData.y_data.length > 1,
        };

        // Create temporary div for rendering
        const tempDiv = document.createElement('div');
        tempDiv.style.width = '1200px';
        tempDiv.style.height = '800px';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        await Plotly.newPlot(tempDiv, traces, layout);

        const imgData = await Plotly.toImage(tempDiv, {
          format: exportFormat,
          height: 800,
          width: 1200,
          scale: 2,
        });

        // Convert base64 to blob
        const base64Data = imgData.split(',')[1];
        zip.file(`${fileData.title}.${exportFormat}`, base64Data, { base64: true });

        // Cleanup
        Plotly.purge(tempDiv);
        document.body.removeChild(tempDiv);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `eshacharts_export_${Date.now()}.zip`);
    } catch (err) {
      console.error('Batch export failed:', err);
      alert('Batch export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [allFiles, allSettings, exportFormat, theme]);

  return (
    <div className="control-panel">
      <h3>Graph Controls</h3>

      {/* Display Options */}
      <div className="control-section">
        <h4>Display Options</h4>

        <div className="control-row">
          <label>Show Title</label>
          <input
            type="checkbox"
            checked={settings.showTitle}
            onChange={(e) => onUpdateSettings({ showTitle: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Show Axis Labels</label>
          <input
            type="checkbox"
            checked={settings.showAxisLabels}
            onChange={(e) => onUpdateSettings({ showAxisLabels: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Swap X/Y Axes</label>
          <input
            type="checkbox"
            checked={settings.swapAxes}
            onChange={(e) => onUpdateSettings({ swapAxes: e.target.checked })}
          />
        </div>
      </div>

      {/* Axis Format */}
      <div className="control-section">
        <h4>Axis Number Format</h4>

        <div className="control-row">
          <label>X-Axis Format</label>
          <select
            value={settings.xAxisFormat}
            onChange={(e) => onUpdateSettings({ xAxisFormat: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="scientific">Scientific</option>
          </select>
        </div>

        <div className="control-row">
          <label>Y-Axis Format</label>
          <select
            value={settings.yAxisFormat}
            onChange={(e) => onUpdateSettings({ yAxisFormat: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="scientific">Scientific</option>
          </select>
        </div>
      </div>

      {/* Curve Settings */}
      <div className="control-section">
        <h4>Curves ({data.y_data.length})</h4>

        {data.y_data.map((curve, idx) => {
          const curveSettings = settings.curves[idx] || {
            visible: true,
            color: '#1f77b4',
            width: 2,
          };

          return (
            <div key={idx} className="curve-editor">
              <div className="curve-header">
                <span className="curve-name" title={curve.name}>
                  {curve.name}
                </span>
                <div className="curve-controls">
                  <input
                    type="checkbox"
                    checked={curveSettings.visible}
                    onChange={(e) =>
                      onUpdateCurve(idx, { visible: e.target.checked })
                    }
                    title="Toggle visibility"
                  />
                </div>
              </div>

              <div className="control-row">
                <label>Color</label>
                <input
                  type="color"
                  value={curveSettings.color}
                  onChange={(e) => onUpdateCurve(idx, { color: e.target.value })}
                />
              </div>

              <div className="control-row">
                <label>Width ({curveSettings.width}px)</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={curveSettings.width}
                  onChange={(e) =>
                    onUpdateCurve(idx, { width: parseFloat(e.target.value) })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom Instructions */}
      <div className="control-section">
        <h4>Zoom & Pan</h4>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <p style={{ marginBottom: '0.25rem' }}>
            <strong>Zoom:</strong> Click and drag to select region
          </p>
          <p style={{ marginBottom: '0.25rem' }}>
            <strong>Pan:</strong> Hold Shift + drag
          </p>
          <p style={{ marginBottom: '0.25rem' }}>
            <strong>Scroll Zoom:</strong> Use mouse wheel
          </p>
          <p>
            <strong>Reset:</strong> Double-click or use toolbar
          </p>
        </div>
      </div>

      {/* Export */}
      <div className="control-section">
        <h4>Export</h4>

        <div className="control-row">
          <label>Format</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="svg">SVG</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="export-section">
          <button
            className="export-btn"
            onClick={exportCurrentGraph}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export Current Graph'}
          </button>

          {allFiles && allFiles.length > 1 && (
            <button
              className="export-btn secondary"
              onClick={exportAllGraphs}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : `Export All (${allFiles.length} graphs)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
