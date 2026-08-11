import {
  type CandleStick,
  type ChartColors,
  type ChartDescription,
  type PerpsProChartConfig,
  type TPSLPriceLines,
} from './types';
import BigNumber from 'bignumber.js';
import { createSeriesMarkers } from 'lightweight-charts/standalone';

// Format utilities
const Sub_Numbers = '₀₁₂₃₄₅₆₇₈₉';

export function formatLittleNumber(num: string | number, minLen = 6): string {
  const bn = new BigNumber(num);
  if (bn.toFixed().length >= minLen) {
    const s = bn.precision(4).toFormat();
    const ss = s.replace(/^0.(0*)?(?:.*)/u, (_, z: string) => {
      const zeroLength = z?.length || 0;
      const sub = String(zeroLength)
        .split('')
        .map(x => Sub_Numbers[Number(x)])
        .join('');
      const end = s.slice(zeroLength + 2);
      return '0.0' + sub + end;
    });
    return ss;
  }
  return String(num);
}

export function formatPrice(v: number): string {
  if (Math.abs(v) >= 0.1) {
    return v.toFixed(2);
  }
  if (Math.abs(v) < 0.0001) {
    const isNegative = v < 0;
    const absNum = Math.abs(v);
    return (isNegative ? '-' : '') + formatLittleNumber(absNum);
  }
  return v.toFixed(4);
}

export function formatNumber(v: number): string {
  if (v >= 1000000) {
    return (v / 1000000).toFixed(2) + 'M';
  } else if (v >= 1000) {
    return (v / 1000).toFixed(2) + 'K';
  }
  return v.toFixed(2);
}

const normalizeSignedZero = (value: number) =>
  Object.is(value, -0) ? 0 : value;

export function formatProPrice(v: number, decimals: number): string {
  if (!Number.isFinite(v)) {
    return '--';
  }
  const safeDecimals = Number.isInteger(decimals)
    ? Math.min(12, Math.max(0, decimals))
    : 2;
  return normalizeSignedZero(v).toFixed(safeDecimals);
}

export function formatPerpsProCrosshairPrice(
  price: number,
  decimals: number,
): string {
  const formatted = formatProPrice(price, decimals);
  if (formatted === '--') {
    return formatted;
  }
  const [integer = '', fraction] = formatted.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
  return fraction == null ? groupedInteger : `${groupedInteger}.${fraction}`;
}

export function formatPerpsProCrosshairChange(
  price: number,
  referencePrice: number | null,
): string | null {
  if (
    !Number.isFinite(price) ||
    referencePrice == null ||
    !Number.isFinite(referencePrice) ||
    referencePrice <= 0
  ) {
    return null;
  }
  const change = normalizeSignedZero(
    ((price - referencePrice) / referencePrice) * 100,
  );
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
}

export function formatProCompactNumber(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v) || v < 0) {
    return '--';
  }
  const normalized = normalizeSignedZero(v);
  if (normalized >= 1_000_000_000) {
    return `${(normalized / 1_000_000_000).toFixed(2)}B`;
  }
  if (normalized >= 1_000_000) {
    return `${(normalized / 1_000_000).toFixed(2)}M`;
  }
  if (normalized >= 1_000) {
    return `${(normalized / 1_000).toFixed(2)}K`;
  }
  return normalized.toFixed(2);
}

export function formatProTooltipTime(
  time: number,
  interval: PerpsProChartConfig['interval'],
): string {
  const date = new Date(time * 1000);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (interval === '1d' || interval === '1w' || interval === '1M') {
    return `${year}-${month}-${day}`;
  }
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hours}:${minutes}`;
}

export type PerpsProTooltipMetrics = {
  change: number | null;
  changePercent: number | null;
  isPositive: boolean;
  rangePercent: number | null;
};

export function getPerpsProTooltipMetrics(
  candle: Pick<CandleStick, 'open' | 'close' | 'high' | 'low'>,
): PerpsProTooltipMetrics {
  if (
    !Number.isFinite(candle.open) ||
    candle.open <= 0 ||
    !Number.isFinite(candle.close) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low)
  ) {
    return {
      change: null,
      changePercent: null,
      isPositive: true,
      rangePercent: null,
    };
  }
  const change = normalizeSignedZero(candle.close - candle.open);
  return {
    change,
    changePercent: normalizeSignedZero((change / candle.open) * 100),
    isPositive: change >= 0,
    rangePercent: normalizeSignedZero(
      ((candle.high - candle.low) / candle.open) * 100,
    ),
  };
}

export type MovingAveragePoint = {
  time: number;
  value: number;
};

export function calculateSimpleMovingAverage(
  data: ReadonlyArray<CandleStick>,
  period: number,
): MovingAveragePoint[] {
  if (!Number.isInteger(period) || period <= 0 || data.length < period) {
    return [];
  }
  const result: MovingAveragePoint[] = [];
  let sum = 0;
  for (let index = 0; index < data.length; index += 1) {
    sum += data[index].close;
    if (index >= period) {
      sum -= data[index - period].close;
    }
    if (index >= period - 1) {
      result.push({
        time: data[index].time,
        value: sum / period,
      });
    }
  }
  return result;
}

export function getInitialVisibleLogicalRange(
  dataLength: number,
  visibleBars: number,
) {
  const safeLength = Math.max(0, Math.floor(dataLength));
  const safeVisibleBars = Math.max(1, Math.floor(visibleBars));
  return {
    from: Math.max(0, safeLength - safeVisibleBars),
    to: safeLength,
  };
}

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
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatYTime(t: number, tickMarkType?: number): string {
  const d = new Date(t * 1000);
  const mon = MONTHS[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  const yr = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (tickMarkType === 0) return String(d.getFullYear());
  if (tickMarkType === 1) return mon + " '" + yr;
  if (tickMarkType === 2) return day + ' ' + mon;
  if (tickMarkType !== undefined && tickMarkType >= 3)
    return hours + ':' + minutes;
  return day + ' ' + mon;
}

export function formatTime(
  t: number | { month?: number; day?: number; year?: number },
  noTime = false,
): string {
  if (typeof t === 'number') {
    const d = new Date(t * 1000);
    const dow = DAYS[d.getDay()];
    const mon = MONTHS[d.getMonth()];
    const day = String(d.getDate()).padStart(2, '0');
    const yr = String(d.getFullYear()).slice(-2);
    if (noTime) {
      return dow + ' ' + day + ' ' + mon + " '" + yr;
    }
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return (
      dow + ' ' + day + ' ' + mon + " '" + yr + ' ' + hours + ':' + minutes
    );
  }
  const bd = t;
  const mon = MONTHS[(bd.month || 1) - 1] || '';
  const day = String(bd.day || 1).padStart(2, '0');
  const yr = String(bd.year || 0).slice(-2);
  return day + ' ' + mon + " '" + yr;
}

export interface VisibleExtremes {
  highest: number | null;
  lowest: number | null;
  highestTime: number | null;
  lowestTime: number | null;
}

export function calculateVisibleExtremes(
  data: CandleStick[],
  from: number,
  to: number,
): VisibleExtremes {
  if (!data || data.length === 0) {
    return { highest: null, lowest: null, highestTime: null, lowestTime: null };
  }

  const rangeData = data.filter(bar => bar.time >= from && bar.time <= to);
  if (rangeData.length === 0) {
    return { highest: null, lowest: null, highestTime: null, lowestTime: null };
  }

  let highest = rangeData[0].high;
  let lowest = rangeData[0].low;
  let highestTime = rangeData[0].time;
  let lowestTime = rangeData[0].time;

  rangeData.forEach(bar => {
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
}

// Chart state management
export interface ChartState {
  chart: any | null;
  candlestickSeries: any | null;
  volumeSeries: any | null;
  maSeries: Record<7 | 25 | 99, any | null>;
  crosshairMarkerSeries: any | null;
  crosshairActive: boolean;
  isInitialDataLoad: boolean;
  lastDataKey: string | null;
  noTime: boolean;
  tooltip: HTMLDivElement | null;
  clearMarkers: any | null;
  currentExtremes: VisibleExtremes | null;
  priceLineContainers: {
    tp: any | null;
    sl: any | null;
    liquidation: any | null;
    entry: any | null;
  };
  colors: ChartColors | null;
  description: ChartDescription | null;
  proConfig: PerpsProChartConfig | null;
  selectedPrice: number | null;
  selectedTime: number | null;
  selectedPointX: number | null;
  selectedPointY: number | null;
  proReferencePrice: number | null;
  currentData: TradingViewCandlestickData[];
}

export function createChartState(): ChartState {
  return {
    chart: null,
    candlestickSeries: null,
    volumeSeries: null,
    maSeries: {
      7: null,
      25: null,
      99: null,
    },
    crosshairMarkerSeries: null,
    crosshairActive: false,
    isInitialDataLoad: true,
    lastDataKey: null,
    noTime: false,
    tooltip: null,
    clearMarkers: null,
    currentExtremes: null,
    priceLineContainers: {
      tp: null,
      sl: null,
      liquidation: null,
      entry: null,
    },
    colors: null,
    description: null,
    proConfig: null,
    selectedPrice: null,
    selectedTime: null,
    selectedPointX: null,
    selectedPointY: null,
    proReferencePrice: null,
    currentData: [],
  };
}

// Price lines management
export function updateTPSLPriceLines(
  state: ChartState,
  priceLines: TPSLPriceLines,
): void {
  if (
    !state.candlestickSeries ||
    !state.chart ||
    !state.colors ||
    !state.description
  )
    return;

  // Clear existing price lines
  Object.values(state.priceLineContainers).forEach(line => {
    if (line) {
      state.candlestickSeries!.removePriceLine(line);
    }
  });
  state.priceLineContainers = {
    tp: null,
    sl: null,
    liquidation: null,
    entry: null,
  };

  // Add Take Profit line
  if (priceLines.tpPrice && priceLines.tpPrice > 0) {
    state.priceLineContainers.tp = state.candlestickSeries.createPriceLine({
      price: priceLines.tpPrice,
      color: state.colors.greenLineColor,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: state.description.tp,
    });
  }

  // Add Entry line
  if (priceLines.entryPrice && priceLines.entryPrice > 0) {
    state.priceLineContainers.entry = state.candlestickSeries.createPriceLine({
      price: priceLines.entryPrice,
      color: state.colors.greenLineColor,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: state.description.entry,
    });
  }

  // Add Stop Loss line
  if (priceLines.slPrice && priceLines.slPrice > 0) {
    state.priceLineContainers.sl = state.candlestickSeries.createPriceLine({
      price: priceLines.slPrice,
      color: state.colors.redLineColor,
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: state.description.sl,
    });
  }

  // Add Liquidation line
  if (priceLines.liquidationPrice && priceLines.liquidationPrice > 0) {
    state.priceLineContainers.liquidation =
      state.candlestickSeries.createPriceLine({
        price: priceLines.liquidationPrice,
        color: state.colors.redLineColor,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: state.description.liq,
      });
  }
}

// Update high/low markers based on visible range
export function updatePriceLines(state: ChartState): void {
  if (
    !state.candlestickSeries ||
    !state.chart ||
    !state.colors ||
    !state.description
  )
    return;

  const visibleRange = state.chart.timeScale().getVisibleLogicalRange();
  if (!visibleRange) return;

  const barsInfo = state.candlestickSeries.barsInLogicalRange(visibleRange);
  const data = state.candlestickSeries.data();

  if (!barsInfo || data.length === 0) return;

  const newExtremes = calculateVisibleExtremes(
    data,
    barsInfo.from,
    barsInfo.to,
  );

  // Skip if extremes haven't changed
  if (
    state.currentExtremes &&
    state.currentExtremes.highest === newExtremes.highest &&
    state.currentExtremes.lowest === newExtremes.lowest &&
    state.currentExtremes.highestTime === newExtremes.highestTime &&
    state.currentExtremes.lowestTime === newExtremes.lowestTime
  ) {
    return;
  }

  state.currentExtremes = newExtremes;
  const { highest, lowest, highestTime, lowestTime } = newExtremes;
  if (!highest || !lowest) return;

  if (state.clearMarkers) {
    state.clearMarkers.setMarkers([]);
  }

  const LightweightCharts = (window as any).LightweightCharts;
  if (!LightweightCharts) return;

  state.clearMarkers = createSeriesMarkers(state.candlestickSeries, [
    {
      time: highestTime,
      position: 'aboveBar',
      color: state.colors.highPriceLineColor,
      shape: 'arrowDown',
      text: state.description.high,
      size: 0.1,
    },
    {
      time: lowestTime,
      position: 'belowBar',
      color: state.colors.lowPriceLineColor,
      shape: 'arrowUp',
      text: state.description.low,
      size: 0.1,
    },
  ]);
}
