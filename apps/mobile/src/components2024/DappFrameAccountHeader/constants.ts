const PngPolymarket = require('@/assets2024/icons/prediction/polymarket.jpg');
const PngOpinion = require('@/assets2024/icons/prediction/opinion.jpg');
const PngProbable = require('@/assets2024/icons/prediction/probable.jpg');

const PngHyperliquid = require('@/assets2024/icons/perps/hyperliquid.jpg');
const PngAster = require('@/assets2024/icons/perps/aster.jpg');
const PngLighter = require('@/assets2024/icons/perps/lighter.png');
const PngAave = require('@/assets2024/icons/lending/aave.jpg');
const PngSpark = require('@/assets2024/icons/lending/spark.jpg');
const PngVenus = require('@/assets2024/icons/lending/venus.jpg');

export type DappSelectItem = {
  id: string;
  name: string;
  icon: number;
  url?: string;
  description?: string;
  rightText?: string;
  onPress?: (item: DappSelectItem) => void;
  themeColor: string;
  extraInfo: string;
  value?: string;
  remoteUrl?: string;
};

const PREDICTION: DappSelectItem[] = [
  {
    id: 'polymarket',
    name: 'Polymarket',
    icon: PngPolymarket,
    url: 'https://polymarket.com/',
    themeColor: 'rgba(22, 82, 240, 0.06)',
    extraInfo: 'Vol: $3.614b',
  },
  {
    id: 'opinion',
    name: 'Opinion',
    icon: PngOpinion,
    url: 'https://app.opinion.trade/macro',
    themeColor: 'rgba(0, 0, 0, 0.06);',
    extraInfo: 'Vol: $2.915b',
  },
  {
    id: 'probable',
    name: 'Probable',
    icon: PngProbable,
    url: 'https://probable.markets/',
    themeColor: 'rgba(252, 98, 28, 0.06);',
    extraInfo: 'Vol: $1.823b',
  },
];

const LENDING: DappSelectItem[] = [
  {
    id: 'aave',
    name: 'Aave',
    icon: PngAave,
    url: 'https://app.aave.com',
    themeColor: 'rgba(11, 11, 11, 0.06)',
    extraInfo: 'TVL: $27.925b',
  },
  {
    id: 'spark',
    name: 'Spark',
    icon: PngSpark,
    url: 'https://app.spark.fi/my-portfolio',
    themeColor: 'rgba(252, 105, 137, 0.08)',
    extraInfo: 'TVL: $5.246b',
  },
  {
    id: 'venus',
    name: 'Venus',
    icon: PngVenus,
    url: 'https://venus.io',
    themeColor: 'rgba(58, 121, 253, 0.08)',
    extraInfo: 'TVL: $1.226b',
  },
];

const PERPS: DappSelectItem[] = [
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    icon: PngHyperliquid,
    url: 'https://app.hyperliquid.xyz/',
    themeColor: 'rgba(175, 249, 229, 0.15)',
    extraInfo: 'Vol: $262.013b',
  },
  {
    id: 'aster',
    name: 'Aster',
    icon: PngAster,
    url: 'https://www.asterdex.com/trade/pro/futures/BTCUSDT',
    themeColor: 'rgba(247, 212, 172, 0.16)',
    extraInfo: 'Vol: $147.423b',
  },
  {
    id: 'lighter',
    name: 'Lighter',
    icon: PngLighter,
    url: 'https://app.lighter.xyz/trade/LIT_USDC',
    themeColor: 'rgba(11, 11, 11, 0.06)',
    extraInfo: 'Vol: $114.536b',
  },
];

export const INNER_DAPP_LIST = {
  PREDICTION,
  LENDING,
  PERPS,
} as const;
