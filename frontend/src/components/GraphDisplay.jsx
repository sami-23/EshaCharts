import React, { useMemo, useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

const Plot = createPlotlyComponent(Plotly);

function GraphDisplay({
  data,
  settings,
  theme,
  isCompareMode,
  compareData,
  compareCurveSettings,
  compareSettings,
  zoomState,
  onZoomChange,
  onTitleEdit,
}) {
  const plotRef = useRef(null);

  // Helper to normalize x-data to start from 0
  const normalizeXData = (xData) => {
    const numericX = xData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
    const xMin = Math.min(...numericX);
    return numericX.map((v) => v - xMin);
  };

  // Helper to invert y-data (negate all values)
  const invertYData = (yData) => {
    return yData.map((v) => (typeof v === 'number' ? -v : -(parseFloat(v) || 0)));
  };

  // Helper to apply per-curve math transformations
  const applyTransforms = (yData, xData, curveSettings) => {
    let y = yData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
    const x = xData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));

    // Apply smoothing (moving average) first
    const window = curveSettings.smoothing || 0;
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

    // Apply transform (derivative or integral)
    const transform = curveSettings.transform || 'none';
    if (transform === 'derivative') {
      const dy = [];
      for (let i = 0; i < y.length; i++) {
        if (i === 0) {
          dy.push((y[1] - y[0]) / ((x[1] - x[0]) || 1));
        } else if (i === y.length - 1) {
          dy.push((y[i] - y[i - 1]) / ((x[i] - x[i - 1]) || 1));
        } else {
          dy.push((y[i + 1] - y[i - 1]) / ((x[i + 1] - x[i - 1]) || 1));
        }
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

    // Apply multiply and offset
    const mult = curveSettings.multiply ?? 1;
    const off = curveSettings.offset ?? 0;
    if (mult !== 1 || off !== 0) {
      y = y.map((v) => v * mult + off);
    }

    return y;
  };

  // Helper to detect peaks (local maxima) and valleys (local minima)
  const detectPeaks = (xData, yData) => {
    const peaks = { x: [], y: [], labels: [] };
    const valleys = { x: [], y: [], labels: [] };
    const y = yData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));

    for (let i = 1; i < y.length - 1; i++) {
      if (y[i] > y[i - 1] && y[i] > y[i + 1]) {
        peaks.x.push(xData[i]);
        peaks.y.push(y[i]);
      } else if (y[i] < y[i - 1] && y[i] < y[i + 1]) {
        valleys.x.push(xData[i]);
        valleys.y.push(y[i]);
      }
    }
    return { peaks, valleys };
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

  // Generate plot traces
  const traces = useMemo(() => {
    // Compare mode: generate traces from all files
    if (isCompareMode && compareData && compareCurveSettings) {
      const allTraces = [];
      const isSequential = compareSettings?.compareLayout === 'sequential';
      const shouldNormalize = compareSettings?.normalizeX;
      const shouldInvert = compareSettings?.invertData;

      if (isSequential) {
        // Sequential mode: place each file's data one after another (no gap)
        let xOffset = 0;

        compareData.forEach((fileData, fileIdx) => {
          const fileName = fileData.filename || fileData.title || `File ${fileIdx + 1}`;
          const xData = fileData.x_data.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
          const xMin = Math.min(...xData);
          const xMax = Math.max(...xData);
          const xRange = xMax - xMin;

          fileData.y_data.forEach((yData, curveIdx) => {
            const curveKey = `${fileData._compareFileIndex}-${curveIdx}`;
            const curveSettings = compareCurveSettings[curveKey] || {
              visible: true,
              color: '#1f77b4',
              width: 2,
            };

            const offsetXData = xData.map((v) => v - xMin + xOffset);
            let yValues = applyTransforms(yData.data, xData, curveSettings);
            if (shouldInvert) yValues = invertYData(yValues);
            const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

            allTraces.push({
              x: offsetXData,
              y: yValues,
              ...typeProps,
              name: `${fileName} - ${yData.name}`,
              visible: curveSettings.visible ? true : 'legendonly',
              hovertemplate: `${fileName}<br>${yData.name}<br>%{x}<br>%{y}<extra></extra>`,
            });

            if (curveSettings.showPeaks) {
              const { peaks, valleys } = detectPeaks(offsetXData, yValues);
              if (peaks.x.length > 0) {
                allTraces.push({
                  x: peaks.x, y: peaks.y, type: 'scatter', mode: 'markers',
                  name: `${fileName} - ${yData.name} peaks`,
                  marker: { color: '#ff0000', size: 8, symbol: 'triangle-up' },
                  visible: curveSettings.visible ? true : 'legendonly',
                  showlegend: false, hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
                });
              }
              if (valleys.x.length > 0) {
                allTraces.push({
                  x: valleys.x, y: valleys.y, type: 'scatter', mode: 'markers',
                  name: `${fileName} - ${yData.name} valleys`,
                  marker: { color: '#0000ff', size: 8, symbol: 'triangle-down' },
                  visible: curveSettings.visible ? true : 'legendonly',
                  showlegend: false, hovertemplate: 'Valley<br>%{x}<br>%{y}<extra></extra>',
                });
              }
            }
          });

          // No gap - files are placed directly adjacent
          xOffset += xRange;
        });
      } else {
        // Overlay mode: all files share the same x-axis
        compareData.forEach((fileData, fileIdx) => {
          const fileName = fileData.filename || fileData.title || `File ${fileIdx + 1}`;
          const xData = shouldNormalize ? normalizeXData(fileData.x_data) : fileData.x_data;

          fileData.y_data.forEach((yData, curveIdx) => {
            const curveKey = `${fileData._compareFileIndex}-${curveIdx}`;
            const curveSettings = compareCurveSettings[curveKey] || {
              visible: true,
              color: '#1f77b4',
              width: 2,
            };

            let yValues = applyTransforms(yData.data, fileData.x_data, curveSettings);
            if (shouldInvert) yValues = invertYData(yValues);
            const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

            allTraces.push({
              x: xData,
              y: yValues,
              ...typeProps,
              name: `${fileName} - ${yData.name}`,
              visible: curveSettings.visible ? true : 'legendonly',
              hovertemplate: `${fileName}<br>${yData.name}<br>%{x}<br>%{y}<extra></extra>`,
            });

            if (curveSettings.showPeaks) {
              const { peaks, valleys } = detectPeaks(xData, yValues);
              if (peaks.x.length > 0) {
                allTraces.push({
                  x: peaks.x, y: peaks.y, type: 'scatter', mode: 'markers',
                  name: `${fileName} - ${yData.name} peaks`,
                  marker: { color: '#ff0000', size: 8, symbol: 'triangle-up' },
                  visible: curveSettings.visible ? true : 'legendonly',
                  showlegend: false, hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
                });
              }
              if (valleys.x.length > 0) {
                allTraces.push({
                  x: valleys.x, y: valleys.y, type: 'scatter', mode: 'markers',
                  name: `${fileName} - ${yData.name} valleys`,
                  marker: { color: '#0000ff', size: 8, symbol: 'triangle-down' },
                  visible: curveSettings.visible ? true : 'legendonly',
                  showlegend: false, hovertemplate: 'Valley<br>%{x}<br>%{y}<extra></extra>',
                });
              }
            }
          });
        });
      }

      return allTraces;
    }

    // Single file mode
    if (!data || !settings.curves) return [];

    const singleTraces = [];
    data.y_data.forEach((yData, idx) => {
      const curveSettings = settings.curves[idx] || {
        visible: true,
        color: '#1f77b4',
        width: 2,
      };

      // Handle axis swap
      let xValues = settings.swapAxes ? yData.data : data.x_data;
      let yValues = settings.swapAxes ? data.x_data : yData.data;

      // Normalize X to start from 0 if enabled
      if (settings.normalizeX) {
        xValues = normalizeXData(xValues);
      }

      // Apply per-curve transforms (smoothing, derivative/integral, multiply, offset)
      yValues = applyTransforms(yValues, xValues, curveSettings);

      // Invert Y data if enabled
      if (settings.invertData) {
        yValues = invertYData(yValues);
      }

      const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

      singleTraces.push({
        x: xValues,
        y: yValues,
        ...typeProps,
        name: yData.name,
        visible: curveSettings.visible ? true : 'legendonly',
        hovertemplate: '%{x}<br>%{y}<extra></extra>',
      });

      // Add peak/valley markers if enabled
      if (curveSettings.showPeaks) {
        const { peaks, valleys } = detectPeaks(xValues, yValues);
        if (peaks.x.length > 0) {
          singleTraces.push({
            x: peaks.x,
            y: peaks.y,
            type: 'scatter',
            mode: 'markers',
            name: `${yData.name} peaks`,
            marker: { color: '#ff0000', size: 8, symbol: 'triangle-up' },
            visible: curveSettings.visible ? true : 'legendonly',
            showlegend: false,
            hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
          });
        }
        if (valleys.x.length > 0) {
          singleTraces.push({
            x: valleys.x,
            y: valleys.y,
            type: 'scatter',
            mode: 'markers',
            name: `${yData.name} valleys`,
            marker: { color: '#0000ff', size: 8, symbol: 'triangle-down' },
            visible: curveSettings.visible ? true : 'legendonly',
            showlegend: false,
            hovertemplate: 'Valley<br>%{x}<br>%{y}<extra></extra>',
          });
        }
      }
    });

    return singleTraces;
  }, [data, settings, isCompareMode, compareData, compareCurveSettings, compareSettings]);

  // Generate layout
  const layout = useMemo(() => {
    const isDark = theme === 'dark';

    // Axis format configuration
    const getAxisFormatConfig = (format) => {
      switch (format) {
        case 'scientific':
          return { tickformat: '.2e', exponentformat: 'e', minexponent: 0 };
        case 'exponential':
          return { tickformat: '', exponentformat: 'power', minexponent: 0 };
        case 'normal':
        default:
          return { tickformat: '', exponentformat: 'none', minexponent: 3 };
      }
    };

    // Compare mode layout
    if (isCompareMode && compareData && compareSettings) {
      const firstFile = compareData[0];
      const title = compareSettings.customTitle || 'Comparison';
      const xFormat = getAxisFormatConfig(compareSettings.xAxisFormat);
      const yFormat = getAxisFormatConfig(compareSettings.yAxisFormat);
      const bgColor = compareSettings.bgColor || 'transparent';
      const isSequential = compareSettings.compareLayout === 'sequential';

      // Build separator lines and annotations for sequential mode
      const shapes = [];
      const annotations = [];
      if (isSequential && compareData.length > 1) {
        let xOffset = 0;
        compareData.forEach((fileData, fileIdx) => {
          const xData = fileData.x_data.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
          const xMin = Math.min(...xData);
          const xMax = Math.max(...xData);
          const xRange = xMax - xMin;
          const segStart = xOffset;
          const segEnd = xOffset + xRange;

          // Add annotation for file name at center of segment
          const fileName = fileData.filename || fileData.title || `File ${fileIdx + 1}`;
          annotations.push({
            x: (segStart + segEnd) / 2,
            y: 1.06,
            xref: 'x',
            yref: 'paper',
            text: fileName,
            showarrow: false,
            font: { size: 10, color: isDark ? '#a0a0a0' : '#6c757d' },
          });

          // Add vertical separator line between files (except before first)
          if (fileIdx > 0) {
            shapes.push({
              type: 'line',
              x0: segStart,
              x1: segStart,
              y0: 0,
              y1: 1,
              yref: 'paper',
              line: { color: isDark ? '#5a5a7a' : '#adb5bd', width: 1, dash: 'dash' },
            });
          }

          // No gap between files
          xOffset += xRange;
        });
      }

      return {
        title: compareSettings.showTitle
          ? {
              text: title,
              font: {
                size: 18,
                color: isDark ? '#e8e8e8' : '#212529',
              },
            }
          : null,
        xaxis: {
          title: compareSettings.showAxisLabels
            ? {
                text: compareSettings.customXLabel || firstFile?.x_name || 'X',
                font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
              }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          showgrid: compareSettings.showGrid !== false,
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: xFormat.tickformat,
          exponentformat: xFormat.exponentformat,
          minexponent: xFormat.minexponent,
          type: compareSettings.logScaleX ? 'log' : 'linear',
          ...(zoomState?.xRange ? { range: zoomState.xRange, autorange: false } : { autorange: true }),
        },
        yaxis: {
          title: compareSettings.showAxisLabels
            ? {
                text: compareSettings.customYLabel || 'Value',
                font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
              }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          showgrid: compareSettings.showGrid !== false,
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: yFormat.tickformat,
          exponentformat: yFormat.exponentformat,
          minexponent: yFormat.minexponent,
          type: compareSettings.logScaleY ? 'log' : 'linear',
          ...(zoomState?.yRange ? { range: zoomState.yRange, autorange: false } : { autorange: true }),
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: bgColor,
        font: {
          family: 'Inter, sans-serif',
          color: isDark ? '#e8e8e8' : '#212529',
        },
        margin: { l: 60, r: 30, t: compareSettings.showTitle ? 60 : 30, b: 50 },
        showlegend: true,
        legend: {
          orientation: 'h',
          yanchor: 'bottom',
          y: isSequential ? 1.12 : 1.02,
          xanchor: 'right',
          x: 1,
          font: { size: 11, color: isDark ? '#e8e8e8' : '#212529' },
          bgcolor: 'transparent',
        },
        hovermode: compareSettings.crosshair ? 'x unified' : 'closest',
        dragmode: 'zoom',
        shapes: shapes,
        annotations: annotations,
      };
    }

    // Single file mode layout
    const defaultXName = settings.swapAxes
      ? (data.y_data[0]?.name || 'Y')
      : data.x_name;
    const defaultYName = settings.swapAxes
      ? data.x_name
      : (data.y_data.length === 1 ? data.y_data[0].name : 'Value');
    const xAxisName = settings.customXLabel || defaultXName;
    const yAxisName = settings.customYLabel || defaultYName;
    const xFormat = getAxisFormatConfig(settings.xAxisFormat);
    const yFormat = getAxisFormatConfig(settings.yAxisFormat);
    const titleText = settings.customTitle || data.title;
    const bgColor = settings.bgColor || 'transparent';

    return {
      title: settings.showTitle
        ? {
            text: titleText,
            font: {
              size: 18,
              color: isDark ? '#e8e8e8' : '#212529',
            },
          }
        : null,
      xaxis: {
        title: settings.showAxisLabels
          ? {
              text: xAxisName,
              font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
            }
          : null,
        tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
        showgrid: settings.showGrid !== false,
        gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
        zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
        tickformat: xFormat.tickformat,
        exponentformat: xFormat.exponentformat,
        minexponent: xFormat.minexponent,
        type: settings.logScaleX ? 'log' : 'linear',
        ...(zoomState?.xRange ? { range: zoomState.xRange, autorange: false } : { autorange: true }),
      },
      yaxis: {
        title: settings.showAxisLabels
          ? {
              text: yAxisName,
              font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
            }
          : null,
        tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
        showgrid: settings.showGrid !== false,
        gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
        zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
        tickformat: yFormat.tickformat,
        exponentformat: yFormat.exponentformat,
        minexponent: yFormat.minexponent,
        type: settings.logScaleY ? 'log' : 'linear',
        ...(zoomState?.yRange ? { range: zoomState.yRange, autorange: false } : { autorange: true }),
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: bgColor,
      font: {
        family: 'Inter, sans-serif',
        color: isDark ? '#e8e8e8' : '#212529',
      },
      margin: { l: 60, r: 30, t: settings.showTitle ? 60 : 30, b: 50 },
      showlegend: data.y_data.length > 1,
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1,
        font: { size: 12, color: isDark ? '#e8e8e8' : '#212529' },
        bgcolor: 'transparent',
      },
      hovermode: settings.crosshair ? 'x unified' : 'closest',
      dragmode: 'zoom', // Enable zoom by default
    };
  }, [data, settings, theme, isCompareMode, compareData, compareSettings, zoomState]);

  // Determine filename for export
  const exportFilename = useMemo(() => {
    if (isCompareMode && compareSettings) {
      return compareSettings.customTitle || 'comparison';
    }
    return data?.title || 'graph';
  }, [isCompareMode, compareSettings, data]);

  // Plot configuration
  const config = useMemo(
    () => ({
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToAdd: [
        {
          name: 'Reset Axes',
          icon: {
            width: 500,
            height: 600,
            path: 'M256 56c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m0-56C119.033 0 8 111.033 8 248s111.033 248 248 248 248-111.033 248-248S392.967 0 256 0zm0 168c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80z',
          },
          click: function (gd) {
            onZoomChange?.(null);
            window.Plotly.relayout(gd, {
              'xaxis.autorange': true,
              'yaxis.autorange': true,
            });
          },
        },
      ],
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud'],
      toImageButtonOptions: {
        format: 'png',
        filename: exportFilename,
        height: 800,
        width: 1200,
        scale: 2,
      },
      scrollZoom: true, // Enable scroll to zoom
    }),
    [exportFilename]
  );

  // Store reference to plot div for export
  useEffect(() => {
    if (plotRef.current) {
      window.currentPlotDiv = plotRef.current.el;
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Plot
        ref={plotRef}
        data={traces}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
        onRelayout={(e) => {
          // Capture zoom/pan ranges
          if (e['xaxis.range[0]'] !== undefined || e['yaxis.range[0]'] !== undefined) {
            const newZoom = { ...(zoomState || {}) };
            if (e['xaxis.range[0]'] !== undefined) newZoom.xRange = [e['xaxis.range[0]'], e['xaxis.range[1]']];
            if (e['yaxis.range[0]'] !== undefined) newZoom.yRange = [e['yaxis.range[0]'], e['yaxis.range[1]']];
            onZoomChange?.(newZoom);
          } else if (e['xaxis.autorange'] === true || e['yaxis.autorange'] === true) {
            // User reset axes via Plotly toolbar
            onZoomChange?.(null);
          }
          // Capture inline title edits (double-click on title/axis labels in Plotly)
          const titleUpdates = {};
          if (e['title.text'] !== undefined) titleUpdates.customTitle = e['title.text'];
          if (e['xaxis.title.text'] !== undefined) titleUpdates.customXLabel = e['xaxis.title.text'];
          if (e['yaxis.title.text'] !== undefined) titleUpdates.customYLabel = e['yaxis.title.text'];
          if (Object.keys(titleUpdates).length > 0) onTitleEdit?.(titleUpdates);
        }}
      />
    </div>
  );
}

export default GraphDisplay;
