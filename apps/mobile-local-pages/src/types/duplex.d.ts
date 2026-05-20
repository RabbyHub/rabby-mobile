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
            type: 'UPDATE_THEME';
            colors: {
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
            };
          };
    };
    post: never;
  };
  TradingView_ChartReady: {
    post: {
      type: 'CHART_READY';
      timestamp: string;
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
