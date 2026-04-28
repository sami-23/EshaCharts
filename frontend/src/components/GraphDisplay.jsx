import React, { useMemo, useRef, useEffect } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

const Plot = createPlotlyComponent(Plotly);

const RESET_AXES_ICON = {
  width: 500,
  height: 600,
  path: 'M256 56c110.532 0 200 89.451 200 200 0 110.532-89.451 200-200 200-110.532 0-200-89.451-200-200 0-110.532 89.451-200 200-200m0-56C119.033 0 8 111.033 8 248s111.033 248 248 248 248-111.033 248-248S392.967 0 256 0zm0 168c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80z',
};

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
  compareZoomStates,
  onCompareZoomChange,
  onTitleEdit,
}) {
  const plotRef = useRef(null);
  const compareRefs = useRef([]);

  const normalizeXData = (xData) => {
    const numericX = xData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
    const xMin = Math.min(...numericX);
    return numericX.map((v) => v - xMin);
  };

  const invertYData = (yData) => {
    return yData.map((v) => (typeof v === 'number' ? -v : -(parseFloat(v) || 0)));
  };

  const applyTransforms = (yData, xData, curveSettings) => {
    let y = yData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));
    const x = xData.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));

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

    const mult = curveSettings.multiply ?? 1;
    const off = curveSettings.offset ?? 0;
    if (mult !== 1 || off !== 0) {
      y = y.map((v) => v * mult + off);
    }

    return y;
  };

  const detectPeaks = (xData, yData) => {
    const peaks = { x: [], y: [] };
    const valleys = { x: [], y: [] };
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

  // Single-file traces
  const traces = useMemo(() => {
    if (isCompareMode) return [];
    if (!data || !settings.curves) return [];

    const singleTraces = [];
    data.y_data.forEach((yData, idx) => {
      const curveSettings = settings.curves[idx] || { visible: true, color: '#1f77b4', width: 2 };

      let xValues = settings.swapAxes ? yData.data : data.x_data;
      let yValues = settings.swapAxes ? data.x_data : yData.data;

      if (settings.normalizeX) xValues = normalizeXData(xValues);
      yValues = applyTransforms(yValues, xValues, curveSettings);
      if (settings.invertData) yValues = invertYData(yValues);

      const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

      singleTraces.push({
        x: xValues,
        y: yValues,
        ...typeProps,
        name: yData.name,
        visible: curveSettings.visible ? true : 'legendonly',
        hovertemplate: '%{x}<br>%{y}<extra></extra>',
      });

      if (curveSettings.showPeaks) {
        const { peaks, valleys } = detectPeaks(xValues, yValues);
        if (peaks.x.length > 0) {
          singleTraces.push({
            x: peaks.x, y: peaks.y, type: 'scatter', mode: 'markers',
            name: `${yData.name} peaks`,
            marker: { color: '#ff0000', size: 8, symbol: 'triangle-up' },
            visible: curveSettings.visible ? true : 'legendonly',
            showlegend: false, hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
          });
        }
        if (valleys.x.length > 0) {
          singleTraces.push({
            x: valleys.x, y: valleys.y, type: 'scatter', mode: 'markers',
            name: `${yData.name} valleys`,
            marker: { color: '#0000ff', size: 8, symbol: 'triangle-down' },
            visible: curveSettings.visible ? true : 'legendonly',
            showlegend: false, hovertemplate: 'Valley<br>%{x}<br>%{y}<extra></extra>',
          });
        }
      }
    });

    return singleTraces;
  }, [data, settings, isCompareMode]);

  // Per-file traces for compare mode
  const compareTracesPerFile = useMemo(() => {
    if (!isCompareMode || !compareData || !compareCurveSettings) return [];

    const shouldNormalize = compareSettings?.normalizeX;
    const shouldInvert = compareSettings?.invertData;

    return compareData.map((fileData) => {
      const xData = shouldNormalize
        ? normalizeXData(fileData.x_data)
        : fileData.x_data.map((v) => (typeof v === 'number' ? v : parseFloat(v) || 0));

      const fileTraces = [];

      fileData.y_data.forEach((yData, curveIdx) => {
        const curveKey = `${fileData._compareFileIndex}-${curveIdx}`;
        const curveSettings = compareCurveSettings[curveKey] || { visible: true, color: '#1f77b4', width: 2 };

        let yValues = applyTransforms(yData.data, fileData.x_data, curveSettings);
        if (shouldInvert) yValues = invertYData(yValues);
        const typeProps = getChartTypeProps(curveSettings.chartType, curveSettings.color, curveSettings.width);

        fileTraces.push({
          x: xData,
          y: yValues,
          ...typeProps,
          name: yData.name,
          visible: curveSettings.visible ? true : 'legendonly',
          hovertemplate: `${yData.name}<br>%{x}<br>%{y}<extra></extra>`,
        });

        if (curveSettings.showPeaks) {
          const { peaks, valleys } = detectPeaks(xData, yValues);
          if (peaks.x.length > 0) {
            fileTraces.push({
              x: peaks.x, y: peaks.y, type: 'scatter', mode: 'markers',
              name: `${yData.name} peaks`,
              marker: { color: '#ff0000', size: 8, symbol: 'triangle-up' },
              visible: curveSettings.visible ? true : 'legendonly',
              showlegend: false, hovertemplate: 'Peak<br>%{x}<br>%{y}<extra></extra>',
            });
          }
          if (valleys.x.length > 0) {
            fileTraces.push({
              x: valleys.x, y: valleys.y, type: 'scatter', mode: 'markers',
              name: `${yData.name} valleys`,
              marker: { color: '#0000ff', size: 8, symbol: 'triangle-down' },
              visible: curveSettings.visible ? true : 'legendonly',
              showlegend: false, hovertemplate: 'Valley<br>%{x}<br>%{y}<extra></extra>',
            });
          }
        }
      });

      return fileTraces;
    });
  }, [isCompareMode, compareData, compareCurveSettings, compareSettings]);

  // Per-file layouts for compare mode
  const compareLayouts = useMemo(() => {
    if (!isCompareMode || !compareData || !compareSettings) return [];

    const isDark = theme === 'dark';
    const xFormat = getAxisFormatConfig(compareSettings.xAxisFormat);
    const yFormat = getAxisFormatConfig(compareSettings.yAxisFormat);
    const bgColor = compareSettings.bgColor || 'transparent';

    return compareData.map((fileData, fileIdx) => {
      const fileName = fileData.filename || fileData.title || `File ${fileIdx + 1}`;
      const fileIndex = fileData._compareFileIndex;
      const fileZoom = compareZoomStates?.[fileIndex];

      return {
        title: compareSettings.showTitle
          ? { text: fileName, font: { size: 14, color: isDark ? '#e8e8e8' : '#212529' } }
          : null,
        xaxis: {
          title: compareSettings.showAxisLabels
            ? { text: compareSettings.customXLabel || fileData.x_name || 'X', font: { size: 13, color: isDark ? '#a0a0a0' : '#6c757d' } }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          showgrid: compareSettings.showGrid !== false,
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: xFormat.tickformat,
          exponentformat: xFormat.exponentformat,
          minexponent: xFormat.minexponent,
          type: compareSettings.logScaleX ? 'log' : 'linear',
          ...(fileZoom?.xRange ? { range: fileZoom.xRange, autorange: false } : { autorange: true }),
        },
        yaxis: {
          title: compareSettings.showAxisLabels
            ? { text: compareSettings.customYLabel || 'Value', font: { size: 13, color: isDark ? '#a0a0a0' : '#6c757d' } }
            : null,
          tickfont: { color: isDark ? '#e8e8e8' : '#212529' },
          showgrid: compareSettings.showGrid !== false,
          gridcolor: isDark ? '#3a3a5a' : '#e9ecef',
          zerolinecolor: isDark ? '#3a3a5a' : '#dee2e6',
          tickformat: yFormat.tickformat,
          exponentformat: yFormat.exponentformat,
          minexponent: yFormat.minexponent,
          type: compareSettings.logScaleY ? 'log' : 'linear',
          ...(fileZoom?.yRange ? { range: fileZoom.yRange, autorange: false } : { autorange: true }),
        },
        paper_bgcolor: 'transparent',
        plot_bgcolor: bgColor,
        font: { family: 'Inter, sans-serif', color: isDark ? '#e8e8e8' : '#212529' },
        margin: { l: 60, r: 30, t: compareSettings.showTitle ? 45 : 20, b: 50 },
        showlegend: fileData.y_data.length > 1,
        legend: {
          orientation: 'h',
          yanchor: 'bottom',
          y: 1.02,
          xanchor: 'right',
          x: 1,
          font: { size: 11, color: isDark ? '#e8e8e8' : '#212529' },
          bgcolor: 'transparent',
        },
        hovermode: compareSettings.crosshair ? 'x unified' : 'closest',
        dragmode: 'zoom',
      };
    });
  }, [isCompareMode, compareData, compareSettings, theme, compareZoomStates]);

  // Single-file layout
  const layout = useMemo(() => {
    if (isCompareMode || !data) return {};

    const isDark = theme === 'dark';
    const getAxisFormatConfigInner = (format) => {
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

    const defaultXName = settings.swapAxes ? (data.y_data[0]?.name || 'Y') : data.x_name;
    const defaultYName = settings.swapAxes ? data.x_name : (data.y_data.length === 1 ? data.y_data[0].name : 'Value');
    const xAxisName = settings.customXLabel || defaultXName;
    const yAxisName = settings.customYLabel || defaultYName;
    const xFormat = getAxisFormatConfigInner(settings.xAxisFormat);
    const yFormat = getAxisFormatConfigInner(settings.yAxisFormat);
    const titleText = settings.customTitle || data.title;
    const bgColor = settings.bgColor || 'transparent';

    return {
      title: settings.showTitle
        ? { text: titleText, font: { size: 18, color: isDark ? '#e8e8e8' : '#212529' } }
        : null,
      xaxis: {
        title: settings.showAxisLabels
          ? { text: xAxisName, font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' } }
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
          ? { text: yAxisName, font: { size: 14, color: isDark ? '#a0a0a0' : '#6c757d' } }
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
      font: { family: 'Inter, sans-serif', color: isDark ? '#e8e8e8' : '#212529' },
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
      dragmode: 'zoom',
    };
  }, [data, settings, theme, isCompareMode, zoomState]);

  const exportFilename = useMemo(() => {
    if (isCompareMode && compareSettings) return compareSettings.customTitle || 'comparison';
    return data?.title || 'graph';
  }, [isCompareMode, compareSettings, data]);

  const config = useMemo(
    () => ({
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToAdd: [
        {
          name: 'Reset Axes',
          icon: RESET_AXES_ICON,
          click: function (gd) {
            onZoomChange?.(null);
            window.Plotly.relayout(gd, { 'xaxis.autorange': true, 'yaxis.autorange': true });
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
      scrollZoom: true,
    }),
    [exportFilename, onZoomChange]
  );

  useEffect(() => {
    if (plotRef.current) {
      window.currentPlotDiv = plotRef.current.el;
    }
  }, []);

  // Compare mode: one plot per file, independently zoomable
  if (isCompareMode && compareData && compareSettings) {
    const isHorizontal = compareSettings.compareLayout === 'horizontal';

    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        gap: '12px',
        overflowY: isHorizontal ? 'hidden' : 'auto',
        overflowX: isHorizontal ? 'auto' : 'hidden',
      }}>
        {compareData.map((fileData, i) => {
          const fileIndex = fileData._compareFileIndex;
          const fileName = fileData.filename || fileData.title || `File ${i + 1}`;
          const fileConfig = {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToAdd: [
              {
                name: 'Reset Axes',
                icon: RESET_AXES_ICON,
                click: function (gd) {
                  onCompareZoomChange?.(fileIndex, null);
                  window.Plotly.relayout(gd, { 'xaxis.autorange': true, 'yaxis.autorange': true });
                },
              },
            ],
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'sendDataToCloud'],
            toImageButtonOptions: {
              format: 'png',
              filename: fileName,
              height: 800,
              width: 1200,
              scale: 2,
            },
            scrollZoom: true,
          };

          return (
            <div
              key={fileIndex}
              style={{
                flex: isHorizontal ? '1 1 0' : '0 0 auto',
                width: isHorizontal ? 0 : '100%',
                height: isHorizontal ? '100%' : '430px',
                minWidth: isHorizontal ? '350px' : 'auto',
              }}
            >
              <Plot
                ref={(ref) => {
                  compareRefs.current[i] = ref;
                  if (i === 0) window.currentPlotDiv = ref?.el;
                }}
                data={compareTracesPerFile[i] || []}
                layout={compareLayouts[i] || {}}
                config={fileConfig}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
                onRelayout={(e) => {
                  if (e['xaxis.range[0]'] !== undefined || e['yaxis.range[0]'] !== undefined) {
                    const newZoom = { ...(compareZoomStates?.[fileIndex] || {}) };
                    if (e['xaxis.range[0]'] !== undefined) newZoom.xRange = [e['xaxis.range[0]'], e['xaxis.range[1]']];
                    if (e['yaxis.range[0]'] !== undefined) newZoom.yRange = [e['yaxis.range[0]'], e['yaxis.range[1]']];
                    onCompareZoomChange?.(fileIndex, newZoom);
                  } else if (e['xaxis.autorange'] === true || e['yaxis.autorange'] === true) {
                    onCompareZoomChange?.(fileIndex, null);
                  }
                  const titleUpdates = {};
                  if (e['xaxis.title.text'] !== undefined) titleUpdates.customXLabel = e['xaxis.title.text'];
                  if (e['yaxis.title.text'] !== undefined) titleUpdates.customYLabel = e['yaxis.title.text'];
                  if (Object.keys(titleUpdates).length > 0) onTitleEdit?.(titleUpdates);
                }}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Single-file mode
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
          if (e['xaxis.range[0]'] !== undefined || e['yaxis.range[0]'] !== undefined) {
            const newZoom = { ...(zoomState || {}) };
            if (e['xaxis.range[0]'] !== undefined) newZoom.xRange = [e['xaxis.range[0]'], e['xaxis.range[1]']];
            if (e['yaxis.range[0]'] !== undefined) newZoom.yRange = [e['yaxis.range[0]'], e['yaxis.range[1]']];
            onZoomChange?.(newZoom);
          } else if (e['xaxis.autorange'] === true || e['yaxis.autorange'] === true) {
            onZoomChange?.(null);
          }
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
