type RuntimeInfo = {
  runtimeBaseUrl: string;
  platform: 'ios' | 'android';
  useDevResource: boolean;
  // TODO: add type
  language?: string;
  isDark: boolean;
  i18nTexts?: Record<string, string>;
  backGroundColor?: string;
  // colors2024: import('@rabby-wallet/base-utils').AppColors2024Variants;
};

type TradingViewCandlestickData =
  import('lightweight-charts').CandlestickData & {
    volume?: number;
    trades?: number | null;
    quoteTurnover?: number | null;
  };

type PerpsProChartConfig = {
  baseAsset: string;
  initialVisibleBars: number;
  interval:
    | '1m'
    | '5m'
    | '15m'
    | '30m'
    | '1h'
    | '4h'
    | '8h'
    | '12h'
    | '1d'
    | '1w'
    | '1M';
  maPeriods: readonly [7, 25, 99];
  priceDecimals: number;
  quoteAsset: string;
  variant: 'perps-pro';
};

type DuplexDefs = {
  RuntimeInfo: {
    post: {
      type: 'GET_RUNTIME_INFO';
    };
    receive: {
      type: 'GOT_RUNTIME_INFO';
      info: RuntimeInfo;
    };
  };
  WindowInfo: {
    post: {
      type: 'GET_WINDOW_INFO';
    };
    receive: {
      type: 'GOT_WINDOW_INFO';
      info: {
        width: number;
        height: number;
      };
    };
  };
  GASKETVIEW_TOGGLE_LOADING: {
    receive: {
      type: 'GASKETVIEW:TOGGLE_LOADING';
      info: {
        loading: boolean;
        isPositive: boolean;
      };
      animationDurationMs: number;
      animationGradientBorderRadius: number;
    };
    post: never;
  };
  // TradingView Chart Messages - Unified message type
  TradingViewMessage: {
    receive: {
      type: 'TRADINGVIEW_MESSAGE';
      data:
        | {
            type: 'SET_CANDLESTICK_DATA';
            data: Array<TradingViewCandlestickData>;
            source?: string;
            showVolume?: boolean;
            fitContent?: boolean;
            noTime?: boolean;
            identity?: string;
            revision?: number;
            proConfig?: PerpsProChartConfig;
            preserveVisibleRange?: boolean;
          }
        | {
            type: 'UPDATE_CANDLESTICK_DATA';
            data: TradingViewCandlestickData;
          }
        | {
            type: 'UPDATE_TPSL_PRICE_LINES';
            data: {
              tpPrice?: number;
              slPrice?: number;
              liquidationPrice?: number;
              entryPrice?: number;
            };
          }
        | {
            type: 'CLEAR_CROSSHAIR';
          }
        | {
            type: 'RESET_PERPS_PRO_PRICE_SCALE';
          }
        | {
            type: 'COMPLETE_OLDER_CANDLES_REQUEST';
            earliestTime: number;
            identity: string;
            outcome: 'exhausted' | 'retry';
          }
        | {
            type: 'UPDATE_THEME';
            colors: {
              background: string;
              text: string;
              border: string;
              secondaryText: string;
              greenLineColor: string;
              redLineColor: string;
              highPriceLineColor: string;
              lowPriceLineColor: string;
              emptyPrimary: string;
              emptySecondary: string;
              emptyStroke: string;
              ma: {
                7: string;
                25: string;
                99: string;
              };
              tooltip: {
                bg: string;
                border: string;
                title: string;
                value: string;
              };
              crosshairLabel: {
                background: string;
                text: string;
              };
            };
            description: {
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
              vol: string;
              range: string;
              txn: string;
              empty: string;
            };
          };
    };
    post: never;
  };
  TradingView_ChartReady: {
    post: {
      type: 'CHART_READY';
      timestamp: string;
      capabilities?: {
        candleDataAppliedAck?: boolean;
        olderCandleRequest?: boolean;
        perpsProKlineProtocolVersion?: number;
      };
    };
    receive: never;
  };
  TradingView_CandleDataApplied: {
    post: {
      type: 'CANDLE_DATA_APPLIED';
      identity: string;
      revision: number;
    };
    receive: never;
  };
  TradingView_PerpsProPriceScaleAutoScaleChanged: {
    post: {
      type: 'PERPS_PRO_PRICE_SCALE_AUTO_SCALE_CHANGED';
      autoScale: boolean;
    };
    receive: never;
  };
  TradingView_RequestOlderCandles: {
    post: {
      type: 'REQUEST_OLDER_CANDLES';
      earliestTime: number;
      identity: string;
    };
    receive: never;
  };
  TradingView_AttrLogoClick: {
    post: {
      type: 'ATTR_LOGO_CLICK';
      timestamp: number;
    };
    receive: never;
  };
};

type DuplexPost = DuplexDefs[keyof DuplexDefs]['post'];
type DuplexReceive = DuplexDefs[keyof DuplexDefs]['receive'];
