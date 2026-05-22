import {
  type CandleStick,
  type ChartColors,
  type ChartDescription,
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
  currentData: TradingViewCandlestickData[];
}

export function createChartState(): ChartState {
  return {
    chart: null,
    candlestickSeries: null,
    volumeSeries: null,
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
