import React, { useCallback, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const PRESET_COLORS = [
  '#000000', '#ffffff', '#ff0000', '#00cc00', '#0000ff',
  '#ff8800', '#8800cc', '#00aadd', '#ff00aa', '#888888',
  '#ffdd00', '#00cc88',
];

const ColorSwatches = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
    {PRESET_COLORS.map((color) => (
      <button
        key={color}
        onClick={() => onChange(color)}
        style={{
          width: '18px',
          height: '18px',
          borderRadius: '3px',
          border: value === color ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
          backgroundColor: color,
          cursor: 'pointer',
          padding: 0,
        }}
        title={color}
      />
    ))}
  </div>
);

function ControlPanel({
  data,
  settings,
  onUpdateSettings,
  onUpdateCurve,
  sessionId,
  allFiles,
  allSettings,
  theme,
  onApplyToAll,
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

        // Helper to normalize x-data to start from 0
        const normalizeXData = (xArr) => {
          const nums = xArr.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
          const min = Math.min(...nums);
          return nums.map((v) => v - min);
        };

        // Helper to invert y-data
        const invertYData = (yArr) => {
          return yArr.map((v) => (typeof v === 'number' ? -v : -(parseFloat(v) || 0)));
        };

        // Create traces
        const traces = fileData.y_data.map((yData, idx) => {
          const curveSettings = fileSettings.curves[idx] || {
            visible: true,
            color: '#1f77b4',
            width: 2,
          };

          let xVals = fileSettings.swapAxes ? yData.data : fileData.x_data;
          if (fileSettings.normalizeX) {
            xVals = normalizeXData(xVals);
          }

          let yVals = fileSettings.swapAxes ? fileData.x_data : yData.data;
          if (fileSettings.invertData) {
            yVals = invertYData(yVals);
          }

          return {
            x: xVals,
            y: yVals,
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
        const defaultXName = fileSettings.swapAxes
          ? (fileData.y_data[0]?.name || 'Y')
          : fileData.x_name;
        const defaultYName = fileSettings.swapAxes
          ? fileData.x_name
          : (fileData.y_data.length === 1 ? fileData.y_data[0].name : 'Value');
        const xAxisName = fileSettings.customXLabel || defaultXName;
        const yAxisName = fileSettings.customYLabel || defaultYName;

        const getAxisFormatConfig = (format) => {
          switch (format) {
            case 'scientific': return { tickformat: '.2e', exponentformat: 'e', minexponent: 0 };
            case 'exponential': return { tickformat: '', exponentformat: 'power', minexponent: 0 };
            default: return { tickformat: '', exponentformat: 'none', minexponent: 3 };
          }
        };
        const xFmt = getAxisFormatConfig(fileSettings.xAxisFormat);
        const yFmt = getAxisFormatConfig(fileSettings.yAxisFormat);
        const fileBgColor = fileSettings.bgColor || (isDark ? '#16213e' : '#ffffff');
        const titleText = fileSettings.customTitle || fileData.title;

        const layout = {
          title: fileSettings.showTitle ? { text: titleText } : null,
          xaxis: {
            title: fileSettings.showAxisLabels ? { text: xAxisName } : null,
            tickformat: xFmt.tickformat,
            exponentformat: xFmt.exponentformat,
            minexponent: xFmt.minexponent,
          },
          yaxis: {
            title: fileSettings.showAxisLabels ? { text: yAxisName } : null,
            tickformat: yFmt.tickformat,
            exponentformat: yFmt.exponentformat,
            minexponent: yFmt.minexponent,
          },
          paper_bgcolor: isDark ? '#1a1a2e' : '#ffffff',
          plot_bgcolor: fileBgColor,
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

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
          <label>Graph Title</label>
          <input
            type="text"
            value={settings.customTitle || ''}
            onChange={(e) => onUpdateSettings({ customTitle: e.target.value })}
            placeholder={data.title}
            style={{
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
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

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
          <label>X-Axis Label</label>
          <input
            type="text"
            value={settings.customXLabel || ''}
            onChange={(e) => onUpdateSettings({ customXLabel: e.target.value })}
            placeholder={data.x_name || 'X'}
            style={{
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
          <label>Y-Axis Label</label>
          <input
            type="text"
            value={settings.customYLabel || ''}
            onChange={(e) => onUpdateSettings({ customYLabel: e.target.value })}
            placeholder={data.y_data.length === 1 ? data.y_data[0].name : 'Value'}
            style={{
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
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

        <div className="control-row">
          <label>X Start from 0</label>
          <input
            type="checkbox"
            checked={settings.normalizeX || false}
            onChange={(e) => onUpdateSettings({ normalizeX: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Invert Data</label>
          <input
            type="checkbox"
            checked={settings.invertData || false}
            onChange={(e) => onUpdateSettings({ invertData: e.target.checked })}
          />
        </div>

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label>Background Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                value={settings.bgColor || '#ffffff'}
                onChange={(e) => onUpdateSettings({ bgColor: e.target.value })}
              />
              {settings.bgColor && (
                <button
                  onClick={() => onUpdateSettings({ bgColor: '' })}
                  style={{
                    padding: '0.125rem 0.375rem',
                    fontSize: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <ColorSwatches value={settings.bgColor} onChange={(c) => onUpdateSettings({ bgColor: c })} />
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
            <option value="exponential">Exponential (10^x)</option>
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
            <option value="exponential">Exponential (10^x)</option>
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

              <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label>Color</label>
                  <input
                    type="color"
                    value={curveSettings.color}
                    onChange={(e) => onUpdateCurve(idx, { color: e.target.value })}
                  />
                </div>
                <ColorSwatches value={curveSettings.color} onChange={(c) => onUpdateCurve(idx, { color: c })} />
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

      {/* Save for All */}
      {allFiles && allFiles.length > 1 && (
        <div className="control-section">
          <button
            className="export-btn"
            onClick={onApplyToAll}
            style={{
              width: '100%',
              backgroundColor: 'var(--accent-color)',
            }}
          >
            Save for All ({allFiles.length} graphs)
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
            Apply current design settings to all graphs
          </p>
        </div>
      )}

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
