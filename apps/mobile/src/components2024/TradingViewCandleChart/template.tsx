interface ChartColors {
  background: string;
  text: string;
  border: string;
}

export const createTradingViewChartTemplate = (
  colors: ChartColors,
): string => `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>TradingView Chart</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
    <script>
        // Initialize window.utils with simple formatting functions
        window.utils = {
          formatPrice: (v) => {
            if (v >= 0.1) {
              return v.toFixed(2);
            }
            if (v < 0.0001) {
              return v.toExponential(2);
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
        };

        const defaultFormat = v => v.toFixed(2);
        const formatNumber = v => {
          if (v >= 1000000) {
            return (v / 1000000).toFixed(2) + 'M';
          } else if (v >= 1000) {
            return (v / 1000).toFixed(2) + 'K';
          }
          return v.toFixed(2);
        };
        const formatTime = (t) => {
          if (typeof t === 'number') {
            const d = new Date((t) * 1000)
            return '' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
          }
          const bd = t
          return '' + bd.year + '-' + String(bd.month).padStart(2, '0') + '-' + String(bd.day).padStart(2, '0')
        }
        // Global variables
        window.chart = null;
        window.candlestickSeries = null;
        window.volumeSeries = null;
        window.isInitialDataLoad = true; // Track if this is the first data load
        window.lastDataKey = null; // Track the last dataset to avoid unnecessary autoscaling
        window.tooltip = null;
        // Step 1: Load TradingView library dynamically
        function loadTradingView() {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js';
            script.onload = function() {
                setTimeout(createChart, 500); // Small delay to ensure library is ready
            };
            script.onerror = function() {
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
                window.chart = LightweightCharts.createChart(document.getElementById('container'), {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    layout: {
                        background: {
                            color: '${colors.background}',
                        },
                        textColor: '${colors.text}',
                        attributionLogo: true,
                    },
                    localization: {
                        priceFormatter: window?.utils?.formatPrice || defaultFormat,
                        dateFormat: window?.utils?.formatTime || formatTime,
                    },
                    grid: {
                        vertLines: { color: '${colors.border}' },
                        horzLines: { color: '${colors.border}' },
                    },
                    timeScale: {
                        timeVisible: true,
                        secondsVisible: false,
                        borderColor: 'transparent',
                    },
                    rightPriceScale: {
                        borderColor: 'transparent',
                        borderVisible: false,
                        minimumWidth: 50,
                        scaleMargins: {
                          top: 0.1,
                          bottom: 0.4,
                        },
                    },
                    leftPriceScale: {
                        borderColor: 'transparent',
                    }
                });

                // open external url when click tradingview logo
                (function setupLogoHijack() {
                    let bound = false;
                    const attach = () => {
                        const el = document.getElementById('tv-attr-logo');
                        if (el && !bound) {
                            bound = true;
                            const handler = function(e) {
                                try {
                                    e.preventDefault();
                                    e.stopPropagation();
                                } catch(_) {}
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'ATTR_LOGO_CLICK',
                                        timestamp: Date.now(),
                                    }));
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

                // Notify React Native that chart is ready
                if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CHART_READY',
                        timestamp: new Date().toISOString()
                    }));
                }
            } catch (error) {
                console.error('TradingView: Error creating chart:', error);
            }
        }
        // Create candlestick series when data is received
        window.createCandlestickSeries = function() {
            if (!window.chart || !window.LightweightCharts?.CandlestickSeries) return null;
            // Remove existing series if it exists
            if (window.candlestickSeries) {
                window.chart.removeSeries(window.candlestickSeries);
            }
            // Create new candlestick series
            window.candlestickSeries = window.chart.addSeries(window.LightweightCharts.CandlestickSeries, {
                upColor: '#0ECB81',
                downColor: '#F6465D',
                borderDownColor: '#F6465D',
                borderUpColor: '#0ECB81',
                wickDownColor: '#F6465D',
                wickUpColor: '#0ECB81',
                lastValueVisible: true,
                priceLineVisible: true,
                priceLineSource: 0,
                priceLineWidth: 1,
                priceLineStyle: 2,
                priceFormat: {
                  type: 'price',
                  minMove: 0.0000001,
                }
            });
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
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.chart) {
                window.chart.applyOptions({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }
        });

        // 创建 tooltip DOM
        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.display = 'none';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = '#D1D4DC';
        tooltip.style.padding = '8px 10px';
        tooltip.style.border = '1px solid #2B2B43';
        tooltip.style.borderRadius = '4px';
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

          // Build tooltip HTML without template literals
          let tooltipHTML = '';
          tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML += '<span>Time:</span>';
          tooltipHTML += '<span>' + (window.utils?.formatTime || formatTime)(param.time) + '</span>';
          tooltipHTML += '</div>';
          tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML += '<span>Open:</span>';
          tooltipHTML += '<span>' + (window.utils?.formatPrice || defaultFormat)(open) + '</span>';
          tooltipHTML += '</div>';
          tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML += '<span>High:</span>';
          tooltipHTML += '<span>' + (window.utils?.formatPrice || defaultFormat)(high) + '</span>';
          tooltipHTML += '</div>';
          tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML += '<span>Low:</span>';
          tooltipHTML += '<span>' + (window.utils?.formatPrice || defaultFormat)(low) + '</span>';
          tooltipHTML += '</div>';
          tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
          tooltipHTML += '<span>Close:</span>';
          tooltipHTML += '<span>' + (window.utils?.formatPrice || defaultFormat)(close) + '</span>';
          tooltipHTML += '</div>';

          if (typeof volume === 'number') {
            tooltipHTML += '<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">';
            tooltipHTML += '<span>Volume:</span>';
            tooltipHTML += '<span>' + (window.utils?.formatNumber || formatNumber)(volume) + '</span>';
            tooltipHTML += '</div>';
          }

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
        window.addEventListener('message', function(event) {
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
                                const currentDataKey = message.source + '_' + (message.data?.length || 0);
                                const shouldAutoscale = window.isInitialDataLoad || (window.lastDataKey !== currentDataKey);
                                if (shouldAutoscale) {
                                    // window.chart.timeScale().fitContent();
                                    window.lastDataKey = currentDataKey;
                                }
                                window.isInitialDataLoad = false;
                                if(message.showVolume) {
                                  if (!window.volumeSeries) {
                                    window.createVolumeSeries();
                                  }
                                  window.volumeSeries.setData(message.data.map(item => ({
                                    time: item.time,
                                    value: item.volume,
                                    color:
                                      item.close >= item.open
                                        ? '#0ECB81'
                                        : '#F6465D',
                                  })));
                                  window.candlestickSeries
                                    .priceScale()
                                    .applyOptions({ scaleMargins: { top: 0.1, bottom: 0.2 } });
                                  window.volumeSeries
                                    .priceScale()
                                    .applyOptions({ scaleMargins: { top: 0.9, bottom: 0 } });
                                }
                            } else {
                                console.error('📊 TradingView: Failed to create candlestick series');
                            }
                        }
                        break;
                    case 'UPDATE_CANDLESTICK_DATA':
                      if (window.chart && window.candlestickSeries && message.data) {
                        window.candlestickSeries.update(message.data);
                      }
                      break;
                    case 'UPDATE_INTERVAL':
                        // Send confirmation back to React Native
                        if (window.ReactNativeWebView) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'INTERVAL_UPDATED',
                                duration: message.duration,
                                candlePeriod: message.candlePeriod,
                                candleCount: message.candleCount,
                                timestamp: new Date().toISOString()
                            }));
                        }
                        break;
                }
            } catch (error) {
                console.error('📊 TradingView: Message handling error:', error);
            }
        });
        // Also listen for React Native WebView messages
        document.addEventListener('message', function(event) {
            window.dispatchEvent(new MessageEvent('message', event));
        });
        // Start loading after a small delay
        setTimeout(loadTradingView, 0);
    </script>
</body>
</html>`;
