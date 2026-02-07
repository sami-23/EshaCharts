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
}) {
  const plotRef = useRef(null);

  // Helper to normalize x-data to start from 0
  const normalizeXData = (xData) => {
    const numericX = xData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
    const xMin = Math.min(...numericX);
    return numericX.map((v) => v - xMin);
  };

  // Generate plot traces
  const traces = useMemo(() => {
    // Compare mode: generate traces from all files
    if (isCompareMode && compareData && compareCurveSettings) {
      const allTraces = [];
      const isSequential = compareSettings?.compareLayout === 'sequential';
      const shouldNormalize = compareSettings?.normalizeX;

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

            allTraces.push({
              x: offsetXData,
              y: yData.data,
              type: 'scatter',
              mode: 'lines',
              name: `${fileName} - ${yData.name}`,
              visible: curveSettings.visible ? true : 'legendonly',
              line: {
                color: curveSettings.color,
                width: curveSettings.width,
              },
              hovertemplate: `${fileName}<br>${yData.name}<br>%{x}<br>%{y}<extra></extra>`,
            });
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

            allTraces.push({
              x: xData,
              y: yData.data,
              type: 'scatter',
              mode: 'lines',
              name: `${fileName} - ${yData.name}`,
              visible: curveSettings.visible ? true : 'legendonly',
              line: {
                color: curveSettings.color,
                width: curveSettings.width,
              },
              hovertemplate: `${fileName}<br>${yData.name}<br>%{x}<br>%{y}<extra></extra>`,
            });
          });
        });
      }

      return allTraces;
    }

    // Single file mode
    if (!data || !settings.curves) return [];

    return data.y_data.map((yData, idx) => {
      const curveSettings = settings.curves[idx] || {
        visible: true,
        color: '#1f77b4',
        width: 2,
      };

      // Handle axis swap
      let xValues = settings.swapAxes ? yData.data : data.x_data;
      const yValues = settings.swapAxes ? data.x_data : yData.data;

      // Normalize X to start from 0 if enabled
      if (settings.normalizeX) {
        xValues = normalizeXData(xValues);
      }

      return {
        x: xValues,
        y: yValues,
        type: 'scatter',
        mode: 'lines',
        name: yData.name,
        visible: curveSettings.visible ? true : 'legendonly',
        line: {
          color: curveSettings.color,
          width: curveSettings.width,
        },
        hovertemplate: '%{x}<br>%{y}<extra></extra>',
      };
    });
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
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: xFormat.tickformat,
          exponentformat: xFormat.exponentformat,
          minexponent: xFormat.minexponent,
        },
        yaxis: {
          title: compareSettings.showAxisLabels
            ? {
                text: compareSettings.customYLabel || 'Value',
                font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
              }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: yFormat.tickformat,
          exponentformat: yFormat.exponentformat,
          minexponent: yFormat.minexponent,
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
        hovermode: 'closest',
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
        gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
        zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
        tickformat: xFormat.tickformat,
        exponentformat: xFormat.exponentformat,
        minexponent: xFormat.minexponent,
      },
      yaxis: {
        title: settings.showAxisLabels
          ? {
              text: yAxisName,
              font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
            }
          : null,
        tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
        gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
        zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
        tickformat: yFormat.tickformat,
        exponentformat: yFormat.exponentformat,
        minexponent: yFormat.minexponent,
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
      hovermode: 'closest',
      dragmode: 'zoom', // Enable zoom by default
    };
  }, [data, settings, theme, isCompareMode, compareData, compareSettings]);

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
          // Store zoom state for potential use
          if (e['xaxis.range[0]'] !== undefined) {
            console.log('Zoom applied:', e);
          }
        }}
      />
    </div>
  );
}

export default GraphDisplay;
