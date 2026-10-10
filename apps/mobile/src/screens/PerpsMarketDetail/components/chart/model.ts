import type {
  CandleStick,
  SimpleChartFill,
} from '@/components2024/TradingViewCandleChart/type';
import type { PerpsCandle } from '@/hooks/perps/candles/candle';

export const toSimpleChartCandle = (candle: PerpsCandle): CandleStick => ({
  ...candle,
  time: Math.floor(candle.time / 1000),
});

export function simplePriceChange(price: number | null, reference: number) {
  if (
    price === null ||
    !Number.isFinite(price) ||
    !Number.isFinite(reference) ||
    reference <= 0
  )
    return null;
  const delta = price - reference;
  return { delta, percent: delta / reference };
}

export function simplePriceText(
  price: number | null | undefined,
  decimals: number,
) {
  if (price == null || !Number.isFinite(price) || price < 0) return '—';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function projectSimpleFills(
  fills: readonly { time: number; side: string }[],
): SimpleChartFill[] {
  return fills
    .filter(
      fill =>
        Number.isFinite(fill.time) && (fill.side === 'B' || fill.side === 'A'),
    )
    .map(fill => ({ time: Math.floor(fill.time / 1000), side: fill.side }));
}

// Keep the existing chart's English date labels and local display timezone.
export function simpleSelectionTime(time: number) {
  const date = new Date(time * 1000);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
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
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${days[date.getDay()]} ${pad(date.getDate())} ${
    months[date.getMonth()]
  } '${String(date.getFullYear()).slice(-2)} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}
