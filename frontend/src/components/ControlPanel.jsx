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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onResetView,
}) {
  const [exportFormat, setExportFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('eshacharts_presets') || '{}');
    } catch { return {}; }
  });

  // Save current style as a preset
  const savePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) return;
    const preset = {
      showTitle: settings.showTitle,
      showAxisLabels: settings.showAxisLabels,
      xAxisFormat: settings.xAxisFormat,
      yAxisFormat: settings.yAxisFormat,
      showGrid: settings.showGrid,
      logScaleX: settings.logScaleX,
      logScaleY: settings.logScaleY,
      crosshair: settings.crosshair,
      bgColor: settings.bgColor,
      curves: settings.curves.map((c) => ({
        color: c.color,
        width: c.width,
        chartType: c.chartType,
      })),
    };
    const updated = { ...savedPresets, [name]: preset };
    setSavedPresets(updated);
    localStorage.setItem('eshacharts_presets', JSON.stringify(updated));
    setPresetName('');
  }, [presetName, settings, savedPresets]);

  // Load a preset
  const loadPreset = useCallback((name) => {
    const preset = savedPresets[name];
    if (!preset) return;
    const updates = { ...preset };
    // Merge curve styles
    const newCurves = settings.curves.map((c, idx) => ({
      ...c,
      ...(preset.curves[idx % preset.curves.length] || {}),
    }));
    updates.curves = newCurves;
    onUpdateSettings(updates);
  }, [savedPresets, settings, onUpdateSettings]);

  // Delete a preset
  const deletePreset = useCallback((name) => {
    const updated = { ...savedPresets };
    delete updated[name];
    setSavedPresets(updated);
    localStorage.setItem('eshacharts_presets', JSON.stringify(updated));
  }, [savedPresets]);

  // Export displayed data as CSV
  const exportCSV = useCallback(() => {
    if (!data) return;

    // Helper functions for transforms
    const applyTransformsLocal = (yArr, xArr, cs) => {
      let y = yArr.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
      const x = xArr.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));

      const window = cs.smoothing || 0;
      if (window > 1) {
        const smoothed = [];
        for (let i = 0; i < y.length; i++) {
          const start = Math.max(0, i - Math.floor(window / 2));
          const end = Math.min(y.length, i + Math.ceil(window / 2));
          let sum = 0;
          for (let j = start; j < end; j++) sum += y[j];
          smoothed.push(sum / (end - start));
        }
        y = smoothed;
      }

      const transform = cs.transform || 'none';
      if (transform === 'derivative') {
        const dy = [];
        for (let i = 0; i < y.length; i++) {
          if (i === 0) dy.push((y[1] - y[0]) / ((x[1] - x[0]) || 1));
          else if (i === y.length - 1) dy.push((y[i] - y[i - 1]) / ((x[i] - x[i - 1]) || 1));
          else dy.push((y[i + 1] - y[i - 1]) / ((x[i + 1] - x[i - 1]) || 1));
        }
        y = dy;
      } else if (transform === 'integral') {
        const integral = [0];
        for (let i = 1; i < y.length; i++) {
          const dx = x[i] - x[i - 1];
          integral.push(integral[i - 1] + (y[i] + y[i - 1]) * 0.5 * dx);
        }
        y = integral;
      }

      const mult = cs.multiply ?? 1;
      const off = cs.offset ?? 0;
      if (mult !== 1 || off !== 0) y = y.map((v) => v * mult + off);

      if (settings.invertData) y = y.map((v) => -v);

      return y;
    };

    let xValues = data.x_data;
    if (settings.normalizeX) {
      const nums = xValues.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
      const min = Math.min(...nums);
      xValues = nums.map((v) => v - min);
    }

    const visibleCurves = data.y_data
      .map((yData, idx) => ({ yData, cs: settings.curves[idx] || {} }))
      .filter(({ cs }) => cs.visible !== false);

    const header = [data.x_name || 'X', ...visibleCurves.map(({ yData }) => yData.name)].join(',');
    const rows = [];
    for (let i = 0; i < xValues.length; i++) {
      const row = [xValues[i]];
      visibleCurves.forEach(({ yData, cs }) => {
        const transformed = applyTransformsLocal(yData.data, data.x_data, cs);
        row.push(transformed[i]);
      });
      rows.push(row.join(','));
    }

    const csv = header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title || 'data'}_modified.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, settings]);

  // Copy graph to clipboard as PNG
  const copyToClipboard = useCallback(async () => {
    const plotDiv = window.currentPlotDiv;
    if (!plotDiv) return;

    try {
      const dataUrl = await Plotly.toImage(plotDiv, { format: 'png', height: 800, width: 1200, scale: 2 });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy to clipboard failed:', err);
      alert('Copy to clipboard failed. Your browser may not support this feature.');
    }
  }, []);

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

        // Helper to get Plotly trace properties from chart type
        const getChartTypeProps = (chartType, color, width) => {
          switch (chartType) {
            case 'bar':
              return { type: 'bar', marker: { color } };
            case 'scatter':
              return { type: 'scatter', mode: 'markers', marker: { color, size: width * 3 }, line: undefined };
            case 'area':
              return { type: 'scatter', mode: 'lines', fill: 'tozeroy', line: { color, width } };
            case 'step':
              return { type: 'scatter', mode: 'lines', line: { color, width, shape: 'hv' } };
            case 'line':
            default:
              return { type: 'scatter', mode: 'lines', line: { color, width } };
          }
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

          const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

          return {
            x: xVals,
            y: yVals,
            ...typeProps,
            name: yData.name,
            visible: curveSettings.visible ? true : 'legendonly',
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

      {/* Undo/Redo */}
      <div className="control-section" style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          className="export-btn secondary"
          onClick={onUndo}
          disabled={!canUndo}
          style={{ flex: 1, opacity: canUndo ? 1 : 0.4 }}
        >
          Undo
        </button>
        <button
          className="export-btn secondary"
          onClick={onRedo}
          disabled={!canRedo}
          style={{ flex: 1, opacity: canRedo ? 1 : 0.4 }}
        >
          Redo
        </button>
        <button
          className="export-btn secondary"
          onClick={onResetView}
          title="Reset zoom and pan to default view"
          style={{ flex: 1 }}
        >
          Reset View
        </button>
      </div>

      {/* Presets */}
      <div className="control-section">
        <h4>Style Presets</h4>
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name..."
            style={{
              flex: 1,
              padding: '0.375rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          />
          <button
            className="export-btn"
            onClick={savePreset}
            disabled={!presetName.trim()}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}
          >
            Save
          </button>
        </div>
        {Object.keys(savedPresets).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {Object.keys(savedPresets).map((name) => (
              <div key={name} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <button
                  className="export-btn secondary"
                  onClick={() => loadPreset(name)}
                  style={{ flex: 1, fontSize: '0.8rem', padding: '0.25rem' }}
                >
                  {name}
                </button>
                <button
                  onClick={() => deletePreset(name)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                  title="Delete preset"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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

        <div className="control-row">
          <label>Show Grid</label>
          <input
            type="checkbox"
            checked={settings.showGrid !== false}
            onChange={(e) => onUpdateSettings({ showGrid: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Log Scale X</label>
          <input
            type="checkbox"
            checked={settings.logScaleX || false}
            onChange={(e) => onUpdateSettings({ logScaleX: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Log Scale Y</label>
          <input
            type="checkbox"
            checked={settings.logScaleY || false}
            onChange={(e) => onUpdateSettings({ logScaleY: e.target.checked })}
          />
        </div>

        <div className="control-row">
          <label>Crosshair</label>
          <input
            type="checkbox"
            checked={settings.crosshair || false}
            onChange={(e) => onUpdateSettings({ crosshair: e.target.checked })}
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

              <div className="control-row">
                <label>Type</label>
                <select
                  value={curveSettings.chartType || 'line'}
                  onChange={(e) => onUpdateCurve(idx, { chartType: e.target.value })}
                >
                  <option value="line">Line</option>
                  <option value="bar">Bar</option>
                  <option value="scatter">Scatter</option>
                  <option value="area">Area</option>
                  <option value="step">Step</option>
                </select>
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

              <div className="control-row">
                <label>Multiply</label>
                <input
                  type="number"
                  step="any"
                  value={curveSettings.multiply ?? 1}
                  onChange={(e) => onUpdateCurve(idx, { multiply: parseFloat(e.target.value) || 1 })}
                  style={{
                    width: '70px',
                    padding: '0.25rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div className="control-row">
                <label>Offset</label>
                <input
                  type="number"
                  step="any"
                  value={curveSettings.offset ?? 0}
                  onChange={(e) => onUpdateCurve(idx, { offset: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '70px',
                    padding: '0.25rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              <div className="control-row">
                <label>Transform</label>
                <select
                  value={curveSettings.transform || 'none'}
                  onChange={(e) => onUpdateCurve(idx, { transform: e.target.value })}
                >
                  <option value="none">None</option>
                  <option value="derivative">Derivative</option>
                  <option value="integral">Integral</option>
                </select>
              </div>

              <div className="control-row">
                <label>Smooth ({curveSettings.smoothing || 0})</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={curveSettings.smoothing || 0}
                  onChange={(e) =>
                    onUpdateCurve(idx, { smoothing: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="control-row">
                <label>Peaks</label>
                <input
                  type="checkbox"
                  checked={curveSettings.showPeaks || false}
                  onChange={(e) => onUpdateCurve(idx, { showPeaks: e.target.checked })}
                  title="Show peaks and valleys"
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

          <button
            className="export-btn secondary"
            onClick={copyToClipboard}
            style={{ marginTop: '0.5rem' }}
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>

          <button
            className="export-btn secondary"
            onClick={exportCSV}
            style={{ marginTop: '0.5rem' }}
          >
            Export CSV (with transforms)
          </button>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
