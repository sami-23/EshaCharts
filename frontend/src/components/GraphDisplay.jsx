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

  // Generate plot traces
  const traces = useMemo(() => {
    // Compare mode: generate traces from all files
    if (isCompareMode && compareData && compareCurveSettings) {
      const allTraces = [];

      compareData.forEach((fileData, fileIdx) => {
        const fileName = fileData.filename || fileData.title || `File ${fileIdx + 1}`;

        fileData.y_data.forEach((yData, curveIdx) => {
          const curveKey = `${fileData._compareFileIndex}-${curveIdx}`;
          const curveSettings = compareCurveSettings[curveKey] || {
            visible: true,
            color: '#1f77b4',
            width: 2,
          };

          allTraces.push({
            x: fileData.x_data,
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
      const xValues = settings.swapAxes ? yData.data : data.x_data;
      const yValues = settings.swapAxes ? data.x_data : yData.data;

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
  }, [data, settings, isCompareMode, compareData, compareCurveSettings]);

  // Generate layout
  const layout = useMemo(() => {
    const isDark = theme === 'dark';

    // Axis format configuration
    const getTickFormat = (format) => {
      switch (format) {
        case 'scientific':
          return '.2e';
        case 'normal':
        default:
          return '';
      }
    };

    // Compare mode layout
    if (isCompareMode && compareData && compareSettings) {
      const firstFile = compareData[0];
      const title = compareSettings.customTitle || 'Comparison';

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
                text: firstFile?.x_name || 'X',
                font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
              }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: getTickFormat(compareSettings.xAxisFormat),
          exponentformat: compareSettings.xAxisFormat === 'scientific' ? 'e' : 'none',
        },
        yaxis: {
          title: compareSettings.showAxisLabels
            ? {
                text: 'Value',
                font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' },
              }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: getTickFormat(compareSettings.yAxisFormat),
          exponentformat: compareSettings.yAxisFormat === 'scientific' ? 'e' : 'none',
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {
          family: 'Inter, sans-serif',
          color: isDark ? '#e8e8e8' : '#212529',
        },
        margin: { l: 60, r: 30, t: compareSettings.showTitle ? 60 : 30, b: 50 },
        showlegend: true,
        legend: {
          orientation: 'h',
          yanchor: 'bottom',
          y: 1.02,
          xanchor: 'right',
          x: 1,
          font: { size: 11, color: isDark ? '#e8e8e8' : '#212529' },
          bgcolor: 'transparent',
        },
        hovermode: 'closest',
        dragmode: 'zoom',
      };
    }

    // Single file mode layout
    const xAxisName = settings.swapAxes
      ? (data.y_data[0]?.name || 'Y')
      : data.x_name;
    const yAxisName = settings.swapAxes
      ? data.x_name
      : (data.y_data.length === 1 ? data.y_data[0].name : 'Value');

    return {
      title: settings.showTitle
        ? {
            text: data.title,
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
        tickformat: getTickFormat(settings.xAxisFormat),
        exponentformat: settings.xAxisFormat === 'scientific' ? 'e' : 'none',
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
        tickformat: getTickFormat(settings.yAxisFormat),
        exponentformat: settings.yAxisFormat === 'scientific' ? 'e' : 'none',
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
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
