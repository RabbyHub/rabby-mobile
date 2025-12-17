import { refAssetForLocalWebView } from '@/core/storage/webviewAssets';

interface ChartColors {
  background: string;
  text: string;
  border: string;
  greenLineColor: string;
  redLineColor: string;
  highPriceLineColor: string;
  lowPriceLineColor: string;
  tooltip: {
    bg: string;
    title: string;
    value: string;
  };
}

export const TradeViewJSGlobalUtils = /* javascript */ `
const Sub_Numbers = '₀₁₂₃₄₅₆₇₈₉';
window.utils = {
  formatLittleNumber: (num, minLen = 6) => {
    const bn = new BigNumber(num);
    if (bn.toFixed().length >= minLen) {
      const s = bn.precision(4).toFormat();
      const ss = s.replace(/^0.(0*)?(?:.*)/u, (_, z) => {
        const zeroLength = z.length;

        const sub = String(zeroLength)
          .split('')
          .map(x => Sub_Numbers[x])
          .join('');

        const end = s.slice(zeroLength + 2);
        return '0.0' + sub + end;
      });

      return ss;
    }
    return num;
  },
  formatPrice: (v) => {
    if (Math.abs(v) >= 0.1) {
      return v.toFixed(2);
    }
    if (Math.abs(v) < 0.0001) {
      const isNegative = v < 0;
      const absNum = Math.abs(v);
      return (isNegative ? '-' : '') + window.utils.formatLittleNumber(absNum);
    }
    return v.toFixed(4);
  },
  formatNumber: (v) => {
    if (v >= 1000000) {
      return (v / 1000000).toFixed(2) + 'M';
    } else if (v >= 1000) {
      return (v / 1000).toFixed(2) + 'K';
    }
    return v.toFixed(2);
  },
  formatYTime: (t) => {
    if (typeof t === 'number') {
      const d = new Date(t * 1000);
      return (
        '' +
        (d.getMonth() + 1) +
        '/' +
        d.getDate() +
        ' ' +
        d.getHours().toString().padStart(2, '0') +
        ':' +
        d.getMinutes().toString().padStart(2, '0')
      );
    }
    const bd = t;
    return '' + bd.month + '/' + bd.day;
  },
  formatTime: (t) => {
    if (typeof t === 'number') {
      const d = new Date(t * 1000);
      return (
        '' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '/' +
        String(d.getDate()).padStart(2, '0') +
        ' ' +
        String(d.getHours()).padStart(2, '0') +
        ':' +
        String(d.getMinutes()).padStart(2, '0')
      );
    }
    const bd = t;
    return (
      '' +
      bd.year +
      '-' +
      String(bd.month).padStart(2, '0') +
      '-' +
      String(bd.day).padStart(2, '0')
    );
  },
  // 计算当前可见范围的最高最低价格
  calculateVisibleExtremes: (data, from, to) => {
    if (!data || data.length === 0) return { highest: null, lowest: null, highestTime: null, lowestTime: null };

    const rangeData = data.filter(
      (bar) => bar.time >= from && bar.time <= to
    );
    if (rangeData.length === 0) return { highest: null, lowest: null, highestTime: null, lowestTime: null };

    let highest = rangeData[0].high;
    let lowest = rangeData[0].low;
    let highestTime = rangeData[0].time;
    let lowestTime = rangeData[0].time;

    rangeData.forEach((bar) => {
      if (bar.high > highest) {
        highest = bar.high;
        highestTime = bar.time;
      }
      if (bar.low < lowest) {
        lowest = bar.low;
        lowestTime = bar.time;
      }
    });

    return { highest, lowest, highestTime, lowestTime };
  },
}
`;

export interface ChartDescription {
  tp: string;
  entry: string;
  sl: string;
  liq: string;
  high: string;
  low: string;
  time: string;
  open: string;
  close: string;
  chg: string;
  chgPercent: string;
  volume: string;
}
export const createTradingViewChartTemplate = (
  colors: ChartColors,
  description: ChartDescription,
): string => /* html */ `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>TradingView Chart</title>
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <!-- 预加载关键资源 -->
    <link rel="preload" href=${
      refAssetForLocalWebView('bignumber.js@9.3.1-bignumber.min.js').quoted
    } as="script" crossorigin="anonymous">
    <link rel="preload" href=${
      refAssetForLocalWebView('lightweight-charts.standalone.production.js')
        .quoted
    } as="script" crossorigin="anonymous">
    <style>
      body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          font-family: Arial, sans-serif;
          background: ${colors.background};
      }
      #container {
          width: 100%;
          height: 100vh;
          position: relative;
          background: ${colors.background};
      }
    </style>
  </head>
  <body>
    <div id="container"></div>
    <script src=${
      refAssetForLocalWebView('bignumber.js@9.3.1-bignumber.min.js').quoted
    }></script>
    <script>
      ${TradeViewJSGlobalUtils}
      window.colors = {
        background: "${colors.background}",
        text: "${colors.text}",
        border: "${colors.border}",
        greenLineColor: "${colors.greenLineColor}",
        redLineColor: "${colors.redLineColor}",
        highPriceLineColor: "${colors.highPriceLineColor}",
        lowPriceLineColor: "${colors.lowPriceLineColor}",
        tooltip: {
          bg: "${colors.tooltip.bg}",
          title: "${colors.tooltip.title}",
          value: "${colors.tooltip.value}",
        },
      };
      window.description = {
        tp: '${description.tp}',
        entry: '${description.entry}',
        sl: '${description.sl}',
        liq: '${description.liq}',
        high: '${description.high}',
        low: '${description.low}',
        time: '${description.time}',
        open: '${description.open}',
        close: '${description.close}',
        chg: '${description.chg}',
        chgPercent: '${description.chgPercent}',
        volume: '${description.volume}',
      }

      // Global variables
      window.chart = null;
      window.candlestickSeries = null;
      window.volumeSeries = null;
      window.isInitialDataLoad = true; // Track if this is the first data load
      window.lastDataKey = null; // Track the last dataset to avoid unnecessary autoscaling
      window.tooltip = null;
      window.clearMarkers = null;
      window.currentExtremes = null;

      window.priceLineContainers = {
        tp: null,
        sl: null,
        liquidation: null,
        entry: null,
      };

      // Step 1: Load TradingView library dynamically
      function loadTradingView() {
        const script = document.createElement('script');
        script.src = ${
          refAssetForLocalWebView('lightweight-charts.standalone.production.js')
            .quoted
        };
        script.onload = function () {
          setTimeout(createChart, 50); // Small delay to ensure library is ready
        };
        script.onerror = function () {
          console.error('TradingView: Failed to load library');
        };
        document.head.appendChild(script);
      }
      // Step 2: Create chart
      function createChart() {
        if (!window.LightweightCharts) {
          console.error('TradingView: Library not available');
          return;
        }
        try {
          // Create chart with theme applied via template literals
          window.chart = LightweightCharts.createChart(
            document.getElementById('container'),
            {
              width: window.innerWidth,
              height: window.innerHeight,
              layout: {
                background: {
                  color: window.colors.background,
                },
                textColor: window.colors.text,
                attributionLogo: true,
              },
              localization: {
                priceFormatter: window?.utils?.formatPrice,
                dateFormat: window?.utils?.formatTime,
              },
              grid: {
                vertLines: { color: window.colors.border },
                horzLines: { color: window.colors.border },
              },
              timeScale: {
                barSpacing: 10,
                timeVisible: true,
                secondsVisible: false,
                borderColor: 'transparent',
                tickMarkFormatter: window?.utils?.formatYTime,
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
            }
          );

          // open external url when click tradingview logo
          (function setupLogoHijack() {
            let bound = false;
            const attach = () => {
              const el = document.getElementById('tv-attr-logo');
              if (el && !bound) {
                bound = true;
                const handler = function (e) {
                  try {
                    e.preventDefault();
                    e.stopPropagation();
                  } catch (_) {}
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(
                      JSON.stringify({
                        type: 'ATTR_LOGO_CLICK',
                        timestamp: Date.now(),
                      })
                    );
                  }
                  return false;
                };
                // use capture to intercept early
                el.addEventListener('click', handler, true);
              }
            };
            // try now
            attach();
          })();

          // Subscribe to crosshair move events
          window.chart.subscribeCrosshairMove(handleCrosshairMove);
          let updateTimeout = null;
          window.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
            if (updateTimeout) {
              clearTimeout(updateTimeout);
            }
            updateTimeout = setTimeout(() => {
              updatePriceLines();
            }, 100);
          });

          // Notify React Native that chart is ready
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(
              JSON.stringify({
                type: 'CHART_READY',
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          console.error('TradingView: Error creating chart:', error);
        }
      }
      // Create candlestick series when data is received
      window.createCandlestickSeries = function () {
        if (!window.chart || !window.LightweightCharts?.CandlestickSeries)
          return null;
        // Remove existing series if it exists
        if (window.candlestickSeries) {
          window.chart.removeSeries(window.candlestickSeries);
        }
        // Create new candlestick series
        window.candlestickSeries = window.chart.addSeries(
          window.LightweightCharts.CandlestickSeries,
          {
            upColor: window.colors.greenLineColor,
            downColor: window.colors.redLineColor,
            borderDownColor: window.colors.redLineColor,
            borderUpColor: window.colors.greenLineColor,
            wickDownColor: window.colors.redLineColor,
            wickUpColor: window.colors.greenLineColor,
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineSource: 0,
            priceLineWidth: 1,
            priceLineStyle: 2,
            priceFormat: {
              type: 'price',
              minMove: 0.0000001,
            },
          }
        );
        return window.candlestickSeries;
      };
      window.createVolumeSeries = function () {
        if (!window.chart || !window.LightweightCharts?.HistogramSeries)
          return null;
        if (window.volumeSeries) {
          window.chart.removeSeries(window.volumeSeries);
        }
        window.volumeSeries = window.chart.addSeries(
          window.LightweightCharts.HistogramSeries,
          {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
            lastValueVisible: false,
            priceLineVisible: false,
          }
        );
        return window.volumeSeries;
      };

      window.updateTPSLPriceLines = (priceLines) => {
        if (!window.candlestickSeries || !window.chart) return;

        // Clear existing price lines
        Object.values(window.priceLineContainers).forEach((line) => {
          if (line) {
            window.candlestickSeries.removePriceLine(line);
          }
        });
        window.priceLineContainers = {};

        // Add Take Profit line
        if (priceLines.tpPrice && priceLines.tpPrice > 0) {
          const tpLine = window.candlestickSeries.createPriceLine({
            price: priceLines.tpPrice,
            color: window.colors.greenLineColor,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: window.description.tp,
          });
          window.priceLineContainers.tp = tpLine;
        }

        // Add Entry line
        if (priceLines.entryPrice && priceLines.entryPrice > 0) {
          const entryLine = window.candlestickSeries.createPriceLine({
            price: priceLines.entryPrice,
            color: window.colors.greenLineColor,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: window.description.entry,
          });
          window.priceLineContainers.entry = entryLine;
        }

        // Add Stop Loss line
        if (priceLines.slPrice && priceLines.slPrice > 0) {
          const slLine = window.candlestickSeries.createPriceLine({
            price: priceLines.slPrice,
            color: window.colors.redLineColor,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: window.description.sl,
          });
          window.priceLineContainers.sl = slLine;
        }

        // Add Liquidation line
        if (priceLines.liquidationPrice && priceLines.liquidationPrice > 0) {
          const liquidationLine = window.candlestickSeries.createPriceLine({
            price: priceLines.liquidationPrice,
            color: window.colors.redLineColor,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: window.description.liq,
          });
          window.priceLineContainers.liquidation = liquidationLine;
        }
      };

      // 更新价格线的函数
      const updatePriceLines = () => {
        if (!window.candlestickSeries || !window.chart) return;

        const visibleRange = window.chart.timeScale().getVisibleLogicalRange();
        if (!visibleRange) return;

        const barsInfo =
          window.candlestickSeries.barsInLogicalRange(visibleRange);
        const data = window.candlestickSeries.data();

        if (!barsInfo || data.length === 0) return;

        // 检查范围是否真的发生了变化
        const newExtremes = window.utils.calculateVisibleExtremes(data, barsInfo.from, barsInfo.to)

        // 如果极值没有变化，跳过更新
        if (window.currentExtremes &&
            window.currentExtremes.highest === newExtremes.highest &&
            window.currentExtremes.lowest === newExtremes.lowest &&
            window.currentExtremes.highestTime === newExtremes.highestTime &&
            window.currentExtremes.lowestTime === newExtremes.lowestTime) {
          return;
        }

        window.currentExtremes = newExtremes
        const { highest, lowest, highestTime, lowestTime } = newExtremes
        if (!highest || !lowest) return;

        if(window.clearMarkers) {
          window.clearMarkers.setMarkers([]);
        }
        window.clearMarkers = LightweightCharts.createSeriesMarkers(window.candlestickSeries, [
          {
              time: highestTime,
              position: 'aboveBar',
              color: window.colors.highPriceLineColor,
              shape: 'arrowDown',
              text: window.description.high,
              size: 0.1, // 小尺寸
          },
          {
              time: lowestTime,
              position: 'belowBar',
              color: window.colors.lowPriceLineColor,
              shape: 'arrowUp',
              text: window.description.low,
              size: 0.1,
          }
        ]);
      };
      // Handle window resize
      window.addEventListener('resize', function () {
        if (window.chart) {
          window.chart.applyOptions({
            width: window.innerWidth,
            height: window.innerHeight,
          });
        }
      });

      // 创建 tooltip DOM
      const tooltip = document.createElement('div');
      tooltip.style.position = 'absolute';
      tooltip.style.display = 'none';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.background = window.colors.tooltip.bg;
      tooltip.style.color = '#D1D4DC';
      tooltip.style.padding = '8px 9px';
      tooltip.style.borderRadius = '8px';
      tooltip.style.fontSize = '12px';
      tooltip.style.lineHeight = '1.4';
      tooltip.style.zIndex = '1000';
      window.tooltip = tooltip;
      const containerEl = document.getElementById('container');
      if (containerEl) containerEl.appendChild(tooltip);

      // Handle crosshair move for tooltip
      const handleCrosshairMove = (param) => {
        if (!containerEl || !window.tooltip) return;
        const tooltipEl = window.tooltip;

        const point = param.point;
        if (!point || param.time === undefined) {
          tooltipEl.style.display = 'none';
          return;
        }

        const candleData = window.candlestickSeries
          ? param.seriesData.get(window.candlestickSeries)
          : undefined;
        const volumeDataPoint = window.volumeSeries
          ? param.seriesData.get(window.volumeSeries)
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

        // 计算涨跌额和涨跌幅
        const change = close - open;
        const changePercent = open !== 0 ? (change / open) * 100 : 0;
        const isPositive = change >= 0;

        // Build tooltip HTML without template literals
        let tooltipHTML = '';
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.time +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.value +
          '; font-size: 10px; font-weight: 600;">' +
          window.utils?.formatTime(param.time) +
          '</span>';
        tooltipHTML += '</div>';
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.open +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.value +
          '; font-size: 10px; font-weight: 600;">' +
          window.utils?.formatPrice(open) +
          '</span>';
        tooltipHTML += '</div>';
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.high +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.value +
          '; font-size: 10px; font-weight: 600;">' +
          window.utils?.formatPrice(high) +
          '</span>';
        tooltipHTML += '</div>';
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.low +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.value +
          '; font-size: 10px; font-weight: 600;">' +
          window.utils?.formatPrice(low) +
          '</span>';
        tooltipHTML += '</div>';
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.close +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.value +
          '; font-size: 10px; font-weight: 600;">' +
          window.utils?.formatPrice(close) +
          '</span>';
        tooltipHTML += '</div>';

        if (typeof volume === 'number') {
          tooltipHTML +=
            '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML +=
            '<span style="color: ' +
            window.colors.tooltip.title +
            '; font-size: 10px;">' +
            window.description.volume +
            ':</span>';
          tooltipHTML +=
            '<span style="color: ' +
            window.colors.tooltip.value +
            '; font-size: 10px; font-weight: 600;">' +
            window.utils?.formatNumber(volume) +
            '</span>';
          tooltipHTML += '</div>';
        }
         // 涨跌额
        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.chg +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          (isPositive ? window.colors.greenLineColor : window.colors.redLineColor) +
          '; font-size: 10px; font-weight: 600;">' +
          (isPositive ? '+' : '') +
          window.utils?.formatPrice(change) +
          '</span>';
        tooltipHTML += '</div>';

        tooltipHTML +=
          '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
        tooltipHTML +=
          '<span style="color: ' +
          window.colors.tooltip.title +
          '; font-size: 10px;">' +
          window.description.chgPercent +
          ':</span>';
        tooltipHTML +=
          '<span style="color: ' +
          (isPositive ? window.colors.greenLineColor : window.colors.redLineColor) +
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
          // 选中点在左侧，显示在右上角
          tooltipEl.style.right = '8px';
          tooltipEl.style.left = 'auto';
        } else {
          // 选中点在右侧，显示在左上角
          tooltipEl.style.left = '8px';
          tooltipEl.style.right = 'auto';
        }
        tooltipEl.style.display = 'block';
      };

      // Message handling from React Native
      window.addEventListener('message', function (event) {
        try {
          const message = JSON.parse(event.data);
          switch (message.type) {
            case 'SET_CANDLESTICK_DATA':
              if (window.chart && message.data?.length > 0) {
                // Create or get candlestick series
                if (!window.candlestickSeries) {
                  window.createCandlestickSeries();
                }
                if (window.candlestickSeries) {
                  window.candlestickSeries.setData(message.data);
                  // Check if this is truly new data (different source/period) or just a rerender
                  const currentDataKey =
                    message.source + '_' + (message.data?.length || 0);
                  const shouldAutoscale =
                    window.isInitialDataLoad ||
                    window.lastDataKey !== currentDataKey;
                  if (shouldAutoscale) {
                    // window.chart.timeScale().fitContent();
                    window.lastDataKey = currentDataKey;
                  }
                  window.isInitialDataLoad = false;
                  if (message.showVolume) {
                    if (!window.volumeSeries) {
                      window.createVolumeSeries();
                    }
                    window.volumeSeries.setData(
                      message.data.map((item) => ({
                        time: item.time,
                        value: item.volume,
                        color: item.close >= item.open ? window.colors.greenLineColor : window.colors.redLineColor,
                      }))
                    );
                    window.candlestickSeries
                      .priceScale()
                      .applyOptions({
                        scaleMargins: { top: 0, bottom: 0.1 },
                      });
                    window.volumeSeries
                      .priceScale()
                      .applyOptions({ scaleMargins: { top: 0.9, bottom: 0 } });
                    updatePriceLines();
                  }
                  if (message.fitContent) {
                    window.chart.timeScale().fitContent();
                  }
                  window.chart.timeScale().scrollToRealTime();
                } else {
                  console.error(
                    '📊 TradingView: Failed to create candlestick series'
                  );
                }
              }
              break;
            case 'UPDATE_CANDLESTICK_DATA':
              if (window.chart && window.candlestickSeries && message.data) {
                window.candlestickSeries.update(message.data);
              }
              break;
            case 'UPDATE_TPSL_PRICE_LINES':
              if (window.chart && window.candlestickSeries && message.data) {
                window.updateTPSLPriceLines(message.data);
              }
              break;
            case 'UPDATE_INTERVAL':
              // Send confirmation back to React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    type: 'INTERVAL_UPDATED',
                    duration: message.duration,
                    candlePeriod: message.candlePeriod,
                    candleCount: message.candleCount,
                    timestamp: new Date().toISOString(),
                  })
                );
              }
              break;
          }
        } catch (error) {
          console.error('📊 TradingView: Message handling error:', error);
        }
      });
      // Also listen for React Native WebView messages
      document.addEventListener('message', function (event) {
        window.dispatchEvent(new MessageEvent('message', event));
      });
      // Start loading after a small delay
      setTimeout(loadTradingView, 0);
    </script>
  </body>
</html>
`;
