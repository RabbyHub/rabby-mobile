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
        // Global variables
        window.chart = null;
        window.candlestickSeries = null;
        window.isInitialDataLoad = true; // Track if this is the first data load
        window.lastDataKey = null; // Track the last dataset to avoid unnecessary autoscaling
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
                        attributionLogo: false,
                    },
                    localization: {
                        priceFormatter: (price) => {
                            // Format price with comma separators
                            return new Intl.NumberFormat('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            }).format(price);
                        }
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
                          bottom: 0.1,
                        },
                    },
                    leftPriceScale: {
                        borderColor: 'transparent',
                    }
                });
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
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.chart) {
                window.chart.applyOptions({
                    width: window.innerWidth,
                    height: window.innerHeight
                });
            }
        });
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
                                    window.chart.timeScale().fitContent();
                                    window.lastDataKey = currentDataKey;
                                }
                                window.isInitialDataLoad = false;
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
