import '../../imports';

import {
  createChart as LcCreateChart,
  CandlestickSeries,
  HistogramSeries,
  // type CandlestickData,
} from 'lightweight-charts/standalone';
// import BigNumber from 'bignumber.js';

// const LightweightCharts = window.LightweightCharts;

import { getRuntimeInfo, postMessageToRN } from '../../utils/webview-runtime';
import {
  type ChartColors,
  type ChartDescription,
  type TPSLPriceLines,
} from './types';
import {
  createChartState,
  updateTPSLPriceLines as updateTPSLPriceLinesLogic,
  updatePriceLines,
  formatPrice,
  formatNumber,
  formatTime,
} from './chart-logic';
import { ThemeColors2024 } from '@rabby-wallet/base-utils/src/isomorphic/theme-colors';

function getChartColors(
  isLight: boolean = !getRuntimeInfo().isDark,
): ChartColors {
  const colors2024 = isLight ? ThemeColors2024.light : ThemeColors2024.dark;

  return {
    background: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
    text: colors2024['neutral-title-1'],
    border: colors2024['neutral-bg-5'],
    greenLineColor: 'rgba(42, 187, 127, 1)',
    redLineColor: 'rgba(227, 73, 53, 1)',
    highPriceLineColor: colors2024['neutral-body'],
    lowPriceLineColor: colors2024['neutral-body'],
    tooltip: {
      bg: isLight ? colors2024['neutral-bg-1'] : colors2024['neutral-bg-2'],
      title: colors2024['neutral-body'],
      value: colors2024['neutral-title-1'],
    },
  };
}

// Default descriptions (will be overridden by RN messages)
const defaultDescription: ChartDescription = {
  tp: 'TP',
  entry: 'Entry',
  sl: 'SL',
  liq: 'Liq',
  high: 'High',
  low: 'Low',
  time: 'Time',
  open: 'Open',
  close: 'Close',
  chg: 'Chg',
  chgPercent: 'Chg%',
  volume: 'Volume',
};

// Chart state
const chartState = createChartState();
chartState.colors = { ...getChartColors() };
chartState.description = { ...defaultDescription };

// DOM Elements
const containerEl = document.getElementById('container') as HTMLDivElement;
containerEl.style.position = 'relative';

let hasRenderableData = false;

const loadingOverlay = document.createElement('div');
loadingOverlay.style.position = 'absolute';
loadingOverlay.style.inset = '0';
loadingOverlay.style.display = 'flex';
loadingOverlay.style.alignItems = 'stretch';
loadingOverlay.style.justifyContent = 'stretch';
loadingOverlay.style.pointerEvents = 'none';
loadingOverlay.style.background = chartState.colors.background;
loadingOverlay.style.zIndex = '20';

const loadingChart = document.createElement('div');
loadingChart.style.width = '100%';
loadingChart.style.height = '100%';
loadingChart.style.borderRadius = '20px';
loadingChart.style.background = chartState.colors.border;
loadingChart.style.position = 'relative';
loadingChart.style.overflow = 'hidden';

const loadingLogo = document.createElement('div');
loadingLogo.style.position = 'absolute';
loadingLogo.style.left = '12px';
loadingLogo.style.bottom = '12px';
loadingLogo.style.width = '88px';
loadingLogo.style.height = '20px';
loadingLogo.style.borderRadius = '10px';
loadingLogo.style.background = chartState.colors.border;
loadingLogo.style.boxShadow = `0 0 0 1px ${chartState.colors.background} inset`;

loadingChart.appendChild(loadingLogo);
loadingOverlay.appendChild(loadingChart);
containerEl.appendChild(loadingOverlay);

function updateLoadingSkeletonTheme(colors: ChartColors) {
  loadingOverlay.style.background = colors.background;
  loadingChart.style.background = colors.border;
  loadingLogo.style.background = colors.border;
  loadingLogo.style.boxShadow = `0 0 0 1px ${colors.background} inset`;
}

function setLoadingOverlayVisible(visible: boolean) {
  loadingOverlay.style.display = visible ? 'flex' : 'none';
  if (visible && chartState.tooltip) {
    chartState.tooltip.style.display = 'none';
  }
}

function resetPriceLines() {
  if (chartState.candlestickSeries) {
    Object.values(chartState.priceLineContainers).forEach(line => {
      if (line) {
        chartState.candlestickSeries!.removePriceLine(line);
      }
    });
  }

  chartState.priceLineContainers = {
    tp: null,
    sl: null,
    liquidation: null,
    entry: null,
  };
}

function clearChartData() {
  chartState.currentData = [];
  chartState.isInitialDataLoad = true;
  chartState.lastDataKey = null;
  chartState.currentExtremes = null;

  if (chartState.clearMarkers) {
    chartState.clearMarkers.setMarkers([]);
    chartState.clearMarkers = null;
  }

  resetPriceLines();

  if (chartState.candlestickSeries) {
    chartState.candlestickSeries.setData([]);
    chartState.candlestickSeries.priceScale().applyOptions({
      scaleMargins: { top: 0, bottom: 0 },
    });
  }

  if (chartState.volumeSeries) {
    chartState.volumeSeries.setData([]);
  }
}

// Create tooltip element
const tooltip = document.createElement('div');
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.pointerEvents = 'none';
tooltip.style.background = chartState.colors.tooltip.bg;
tooltip.style.color = '#D1D4DC';
tooltip.style.padding = '8px 9px';
tooltip.style.borderRadius = '8px';
tooltip.style.fontSize = '12px';
tooltip.style.lineHeight = '1.4';
tooltip.style.zIndex = '1000';
containerEl.appendChild(tooltip);
chartState.tooltip = tooltip;

// Update tooltip content
function updateTooltipContent(param: any) {
  if (!chartState.tooltip || !chartState.colors || !chartState.description)
    return;

  const tooltipEl = chartState.tooltip;
  const point = param.point;

  if (!point || param.time === undefined) {
    tooltipEl.style.display = 'none';
    return;
  }

  const candleData = chartState.candlestickSeries
    ? param.seriesData.get(chartState.candlestickSeries)
    : undefined;
  const volumeDataPoint = chartState.volumeSeries
    ? param.seriesData.get(chartState.volumeSeries)
    : undefined;

  if (!candleData) {
    tooltipEl.style.display = 'none';
    return;
  }

  const open = candleData.open;
  const high = candleData.high;
  const low = candleData.low;
  const close = candleData.close;
  const volume = volumeDataPoint?.value;

  const change = close - open;
  const changePercent = open !== 0 ? (change / open) * 100 : 0;
  const isPositive = change >= 0;

  // Build tooltip HTML
  let tooltipHTML = '';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.time +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatTime(param.time, chartState.noTime) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.open +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(open) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.high +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(high) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.low +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(low) +
    '</span>';
  tooltipHTML += '</div>';
  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.close +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.value +
    '; font-size: 10px; font-weight: 600;">' +
    formatPrice(close) +
    '</span>';
  tooltipHTML += '</div>';

  if (typeof volume === 'number') {
    tooltipHTML +=
      '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
    tooltipHTML +=
      '<span style="color: ' +
      chartState.colors.tooltip.title +
      '; font-size: 10px;">' +
      chartState.description.volume +
      ':</span>';
    tooltipHTML +=
      '<span style="color: ' +
      chartState.colors.tooltip.value +
      '; font-size: 10px; font-weight: 600;">' +
      formatNumber(volume) +
      '</span>';
    tooltipHTML += '</div>';
  }

  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.chg +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    (isPositive
      ? chartState.colors.greenLineColor
      : chartState.colors.redLineColor) +
    '; font-size: 10px; font-weight: 600;">' +
    (isPositive ? '+' : '') +
    formatPrice(change) +
    '</span>';
  tooltipHTML += '</div>';

  tooltipHTML +=
    '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
  tooltipHTML +=
    '<span style="color: ' +
    chartState.colors.tooltip.title +
    '; font-size: 10px;">' +
    chartState.description.chgPercent +
    ':</span>';
  tooltipHTML +=
    '<span style="color: ' +
    (isPositive
      ? chartState.colors.greenLineColor
      : chartState.colors.redLineColor) +
    '; font-size: 10px; font-weight: 600;">' +
    (isPositive ? '+' : '') +
    changePercent.toFixed(2) +
    '%</span>';
  tooltipHTML += '</div>';

  tooltipEl.innerHTML = tooltipHTML;

  const containerRect = containerEl.getBoundingClientRect();
  const isLeftSide = point.x < containerRect.width / 2;
  tooltipEl.style.top = '8px';
  if (isLeftSide) {
    tooltipEl.style.right = '8px';
    tooltipEl.style.left = 'auto';
  } else {
    tooltipEl.style.left = '8px';
    tooltipEl.style.right = 'auto';
  }
  tooltipEl.style.display = 'block';
}

// Create chart
function createChart() {
  if (!containerEl) {
    console.error('TradingView: Container not found');
    return;
  }

  const colors = chartState.colors || getChartColors();

  chartState.chart = LcCreateChart(containerEl, {
    width: window.innerWidth,
    height: window.innerHeight,
    layout: {
      background: {
        color: colors.background,
      },
      textColor: colors.text,
      attributionLogo: true,
    },
    localization: {
      priceFormatter: formatPrice,
      timeFormatter: (t: number) => formatTime(t, chartState.noTime),
    },
    grid: {
      vertLines: { color: colors.border },
      horzLines: { color: colors.border },
    },
    timeScale: {
      barSpacing: 10,
      timeVisible: true,
      secondsVisible: false,
      borderColor: 'transparent',
      tickMarkFormatter: (t: number, tickMarkType: number) => {
        const MONTHS = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const d = new Date(t * 1000);
        const mon = MONTHS[d.getMonth()];
        const day = String(d.getDate()).padStart(2, '0');
        const yr = String(d.getFullYear()).slice(-2);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        if (tickMarkType === 0) return String(d.getFullYear());
        if (tickMarkType === 1) return mon + " '" + yr;
        if (tickMarkType === 2) return day + ' ' + mon;
        if (tickMarkType >= 3) return hours + ':' + minutes;
        return day + ' ' + mon;
      },
      minBarSpacing: 2,
      maxBarSpacing: 30,
      fixLeftEdge: true,
      fixRightEdge: true,
    },
    trackingMode: {
      exitMode: 0,
    },
    rightPriceScale: {
      borderColor: 'transparent',
      borderVisible: false,
      minimumWidth: 50,
      scaleMargins: {
        top: 0,
        bottom: 0,
      },
    },
    leftPriceScale: {
      borderColor: 'transparent',
    },
  });

  // Setup logo hijack
  setTimeout(() => {
    const el = document.getElementById('tv-attr-logo');
    if (el) {
      el.addEventListener(
        'click',
        function (e) {
          try {
            e.preventDefault();
            e.stopPropagation();
          } catch (error: any) {}
          if ((window as any).ReactNativeWebView) {
            postMessageToRN({
              type: 'ATTR_LOGO_CLICK',
              timestamp: Date.now(),
            });
          }
          return false;
        },
        true,
      );
    }
  }, 500);

  // Subscribe to crosshair move
  chartState.chart.subscribeCrosshairMove((param: any) => {
    updateTooltipContent(param);
  });

  // Subscribe to visible range change
  let updateTimeout: number | null = null;
  chartState.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = window.setTimeout(() => {
      updatePriceLines(chartState);
    }, 100);
  });

  // Notify RN that chart is ready
  postMessageToRN({
    type: 'CHART_READY',
    timestamp: new Date().toISOString(),
  });
}

// Create candlestick series
function createCandlestickSeries() {
  if (!chartState.chart) return null;

  if (chartState.candlestickSeries) {
    chartState.chart.removeSeries(chartState.candlestickSeries);
  }

  const colors = chartState.colors || getChartColors();

  chartState.candlestickSeries = chartState.chart.addSeries(CandlestickSeries, {
    upColor: colors.greenLineColor,
    downColor: colors.redLineColor,
    borderDownColor: colors.redLineColor,
    borderUpColor: colors.greenLineColor,
    wickDownColor: colors.redLineColor,
    wickUpColor: colors.greenLineColor,
    lastValueVisible: true,
    priceLineVisible: true,
    priceLineSource: 0,
    priceLineWidth: 1,
    priceLineStyle: 2,
    priceFormat: {
      type: 'price',
      minMove: 0.0000001,
    },
  });

  return chartState.candlestickSeries;
}

// Create volume series
function createVolumeSeries() {
  if (!chartState.chart) return null;

  if (chartState.volumeSeries) {
    chartState.chart.removeSeries(chartState.volumeSeries);
  }

  chartState.volumeSeries = chartState.chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    lastValueVisible: false,
    priceLineVisible: false,
  });

  return chartState.volumeSeries;
}

// Handle SET_CANDLESTICK_DATA message
function handleSetCandlestickData(
  message: Omit<
    DuplexDefs['TradingViewMessage']['receive']['data'] & {
      type: 'SET_CANDLESTICK_DATA';
    },
    'type'
  >,
) {
  chartState.noTime = !!message.noTime;

  if (!chartState.chart) return;

  if (!message.data?.length) {
    hasRenderableData = false;
    clearChartData();
    setLoadingOverlayVisible(true);
    return;
  }

  if (!chartState.candlestickSeries) {
    createCandlestickSeries();
  }

  if (chartState.candlestickSeries) {
    hasRenderableData = true;
    setLoadingOverlayVisible(false);
    chartState.currentData = message.data;
    chartState.candlestickSeries.setData(message.data);

    const currentDataKey = message.source + '_' + (message.data?.length || 0);
    const shouldAutoscale =
      chartState.isInitialDataLoad || chartState.lastDataKey !== currentDataKey;
    if (shouldAutoscale) {
      chartState.lastDataKey = currentDataKey;
    }
    chartState.isInitialDataLoad = false;

    if (message.showVolume) {
      if (!chartState.volumeSeries) {
        createVolumeSeries();
      }
      const colors = chartState.colors || getChartColors();
      chartState.volumeSeries.setData(
        message.data.map(item => ({
          time: item.time,
          value: item.volume || 0,
          color:
            item.close >= item.open
              ? colors.greenLineColor
              : colors.redLineColor,
        })),
      );
      chartState.candlestickSeries.priceScale().applyOptions({
        scaleMargins: { top: 0, bottom: 0.1 },
      });
      chartState.volumeSeries
        .priceScale()
        .applyOptions({ scaleMargins: { top: 0.9, bottom: 0 } });
      updatePriceLines(chartState);
    }

    if (message.fitContent) {
      chartState.chart.timeScale().fitContent();
    }
    chartState.chart.timeScale().scrollToRealTime();
  }
}

// Handle UPDATE_CANDLESTICK_DATA message
function handleUpdateCandlestickData(data: TradingViewCandlestickData) {
  if (!chartState.chart || !chartState.candlestickSeries || !data) return;
  hasRenderableData = true;
  setLoadingOverlayVisible(false);
  chartState.candlestickSeries.update(data);
}

// Handle UPDATE_TPSL_PRICE_LINES message
function handleUpdateTPSLPriceLines(data: TPSLPriceLines) {
  if (!chartState.chart || !chartState.candlestickSeries || !data) return;
  updateTPSLPriceLinesLogic(chartState, data);
}

// Handle UPDATE_THEME message
function handleUpdateTheme(colors: ChartColors, description: ChartDescription) {
  chartState.colors = colors;
  chartState.description = description;
  updateLoadingSkeletonTheme(colors);

  if (chartState.chart) {
    chartState.chart.applyOptions({
      layout: {
        background: { color: colors.background },
        textColor: colors.text,
      },
      grid: {
        vertLines: { color: colors.border },
        horzLines: { color: colors.border },
      },
    });
  }

  if (chartState.tooltip) {
    chartState.tooltip.style.background = colors.tooltip.bg;
  }

  containerEl.style.background = colors.background;
  document.body.style.background = colors.background;
}

// Handle messages from RN
function handleMessage(event: CustomEvent) {
  const message = event.detail as DuplexReceive;

  switch (message.type) {
    case 'GOT_RUNTIME_INFO': {
      // Apply initial theme from runtime info
      const { isDark, i18nTexts } = message.info;
      const colors = getChartColors(!isDark);
      const description: ChartDescription = {
        tp: i18nTexts?.['component.kline.tp'] || defaultDescription.tp,
        entry: i18nTexts?.['component.kline.entry'] || defaultDescription.entry,
        sl: i18nTexts?.['component.kline.sl'] || defaultDescription.sl,
        liq: i18nTexts?.['component.kline.liq'] || defaultDescription.liq,
        high: i18nTexts?.['component.kline.high'] || defaultDescription.high,
        low: i18nTexts?.['component.kline.low'] || defaultDescription.low,
        time: i18nTexts?.['component.kline.time'] || defaultDescription.time,
        open: i18nTexts?.['component.kline.open'] || defaultDescription.open,
        close: i18nTexts?.['component.kline.close'] || defaultDescription.close,
        chg: i18nTexts?.['component.kline.chg'] || defaultDescription.chg,
        chgPercent:
          i18nTexts?.['component.kline.chgPercent'] ||
          defaultDescription.chgPercent,
        volume:
          i18nTexts?.['component.kline.volume'] || defaultDescription.volume,
      };
      handleUpdateTheme(colors, description);
      break;
    }
    case 'TRADINGVIEW_MESSAGE': {
      // Handle TradingView specific messages
      const tvMessage = message.data;
      switch (tvMessage.type) {
        case 'SET_CANDLESTICK_DATA':
          handleSetCandlestickData({
            data: tvMessage.data,
            source: tvMessage.source,
            showVolume: tvMessage.showVolume,
            fitContent: tvMessage.fitContent,
            noTime: tvMessage.noTime,
          });
          break;
        case 'UPDATE_CANDLESTICK_DATA':
          handleUpdateCandlestickData(tvMessage.data);
          break;
        case 'UPDATE_TPSL_PRICE_LINES':
          handleUpdateTPSLPriceLines(tvMessage.data);
          break;
        case 'UPDATE_THEME':
          handleUpdateTheme(tvMessage.colors, tvMessage.description);
          break;
      }
      break;
    }
  }
}

// Window resize handler
let resizeTimeout: number | null = null;
function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  resizeTimeout = window.setTimeout(() => {
    if (chartState.chart) {
      chartState.chart.applyOptions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
  }, 100);
}

// Initialize
function init() {
  // Set initial background
  if (containerEl) {
    containerEl.style.background =
      chartState.colors?.background || getChartColors().background;
  }
  document.body.style.background =
    chartState.colors?.background || getChartColors().background;
  setLoadingOverlayVisible(!hasRenderableData);

  // Add event listeners
  window.addEventListener('messageFromRN', handleMessage as EventListener);
  window.addEventListener('resize', handleResize);

  // Request runtime info (theme, i18n) from RN
  postMessageToRN({ type: 'GET_RUNTIME_INFO' });

  // Create chart
  createChart();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.removeEventListener('messageFromRN', handleMessage as EventListener);
  window.removeEventListener('resize', handleResize);
  if (chartState.chart) {
    chartState.chart.remove();
  }
});

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
