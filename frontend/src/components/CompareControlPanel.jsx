import React, { useCallback, useState, useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';

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

function CompareControlPanel({
  compareData,
  compareSettings,
  compareCurveSettings,
  onUpdateSettings,
  onUpdateCurve,
  theme,
}) {
  const [exportFormat, setExportFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);

  // Group curves by source file
  const curvesByFile = useMemo(() => {
    const groups = [];

    compareData.forEach((fileData) => {
      const fileIndex = fileData._compareFileIndex;
      const fileName = fileData.filename || fileData.title || `File ${fileIndex + 1}`;

      const curves = fileData.y_data.map((curve, curveIdx) => {
        const curveKey = `${fileIndex}-${curveIdx}`;
        return {
          curveKey,
          curveName: curve.name,
          settings: compareCurveSettings[curveKey] || {
            visible: true,
            color: '#1f77b4',
            width: 2,
          },
        };
      });

      groups.push({
        fileIndex,
        fileName,
        curves,
      });
    });

    return groups;
  }, [compareData, compareCurveSettings]);

  // Export comparison graph
  const exportGraph = useCallback(async () => {
    const plotDiv = window.currentPlotDiv;
    if (!plotDiv) {
      alert('Graph not ready for export');
      return;
    }

    setIsExporting(true);
    try {
      const filename = compareSettings.customTitle || 'comparison';
      const options = {
        format: exportFormat,
        filename: filename,
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
  }, [exportFormat, compareSettings.customTitle]);

  return (
    <div className="control-panel">
      <h3>Comparison Controls</h3>

      {/* Display Options */}
      <div className="control-section">
        <h4>Display Options</h4>

        <div className="control-row">
          <label>Show Title</label>
          <input
            type="checkbox"
            checked={compareSettings.showTitle}
            onChange={(e) => onUpdateSettings({ showTitle: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Show Axis Labels</label>
          <input
            type="checkbox"
            checked={compareSettings.showAxisLabels}
            onChange={(e) => onUpdateSettings({ showAxisLabels: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>X Start from 0</label>
          <input
            type="checkbox"
            checked={compareSettings.normalizeX || false}
            onChange={(e) => onUpdateSettings({ normalizeX: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Invert Data</label>
          <input
            type="checkbox"
            checked={compareSettings.invertData || false}
            onChange={(e) => onUpdateSettings({ invertData: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Layout</label>
          <select
            value={compareSettings.compareLayout || 'overlay'}
            onChange={(e) => onUpdateSettings({ compareLayout: e.target.value })}
          >
            <option value="overlay">Overlay</option>
            <option value="sequential">Sequential</option>
          </select>
        </div>

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
          <label>Custom Title</label>
          <input
            type="text"
            value={compareSettings.customTitle}
            onChange={(e) => onUpdateSettings({ customTitle: e.target.value })}
            placeholder="Enter comparison title..."
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
          <label>X-Axis Label</label>
          <input
            type="text"
            value={compareSettings.customXLabel || ''}
            onChange={(e) => onUpdateSettings({ customXLabel: e.target.value })}
            placeholder={compareData[0]?.x_name || 'X'}
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
            value={compareSettings.customYLabel || ''}
            onChange={(e) => onUpdateSettings({ customYLabel: e.target.value })}
            placeholder="Value"
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

        <div className="control-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label>Background Color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="color"
                value={compareSettings.bgColor || '#ffffff'}
                onChange={(e) => onUpdateSettings({ bgColor: e.target.value })}
              />
              {compareSettings.bgColor && (
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
          <ColorSwatches value={compareSettings.bgColor} onChange={(c) => onUpdateSettings({ bgColor: c })} />
        </div>
      </div>

      {/* Axis Format */}
      <div className="control-section">
        <h4>Axis Number Format</h4>

        <div className="control-row">
          <label>X-Axis Format</label>
          <select
            value={compareSettings.xAxisFormat}
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
            value={compareSettings.yAxisFormat}
            onChange={(e) => onUpdateSettings({ yAxisFormat: e.target.value })}
          >
            <option value="normal">Normal</option>
            <option value="scientific">Scientific</option>
            <option value="exponential">Exponential (10^x)</option>
          </select>
        </div>
      </div>

      {/* Curves grouped by file */}
      <div className="control-section">
        <h4>Curves</h4>

        {curvesByFile.map((fileGroup) => (
          <div key={fileGroup.fileIndex} className="file-curves-group">
            <div className="file-curves-header">
              {fileGroup.fileName}
            </div>

            {fileGroup.curves.map(({ curveKey, curveName, settings }) => (
              <div key={curveKey} className="curve-editor">
                <div className="curve-header">
                  <span className="curve-name" title={curveName}>
                    {curveName}
                  </span>
                  <div className="curve-controls">
                    <input
                      type="checkbox"
                      checked={settings.visible}
                      onChange={(e) =>
                        onUpdateCurve(curveKey, { visible: e.target.checked })
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
                      value={settings.color}
                      onChange={(e) => onUpdateCurve(curveKey, { color: e.target.value })}
                    />
                  </div>
                  <ColorSwatches value={settings.color} onChange={(c) => onUpdateCurve(curveKey, { color: c })} />
                </div>

                <div className="control-row">
                  <label>Width ({settings.width}px)</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={settings.width}
                    onChange={(e) =>
                      onUpdateCurve(curveKey, { width: parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
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
            onClick={exportGraph}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export Comparison'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompareControlPanel;
