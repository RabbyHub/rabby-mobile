import type { PerpsProTradeSide } from '../model/trade';

type Translate = (key: string) => unknown;

const BAD_ALO_REJECTION =
  /^Post only order would have immediately matched, bbo was .+(?:\. asset=\d+)?\.?$/i;
const BAD_ALO_CODE = /^badAloPxRejected$/i;
const BUY_BAD_ALO_REJECTION =
  /^(?:Alo order price must be lower than best ask price|Post-only order price must be lower than the best ask price to avoid immediately matching)\.?$/i;
const SELL_BAD_ALO_REJECTION =
  /^(?:Alo order price must be higher than best bid price|Post-only order price must be higher than the best bid price to avoid immediately matching)\.?$/i;

const getAloRejectionKey = (message: string, side: PerpsProTradeSide) => {
  if (BAD_ALO_REJECTION.test(message) || BAD_ALO_CODE.test(message)) {
    return side === 'buy'
      ? 'page.perps.pro.orderError.aloBuyWouldMatch'
      : 'page.perps.pro.orderError.aloSellWouldMatch';
  }
  if (side === 'buy' && BUY_BAD_ALO_REJECTION.test(message)) {
    return 'page.perps.pro.orderError.aloBuyWouldMatch';
  }
  if (side === 'sell' && SELL_BAD_ALO_REJECTION.test(message)) {
    return 'page.perps.pro.orderError.aloSellWouldMatch';
  }
  return null;
};

export const getPerpsProOrderErrorText = ({
  message,
  side,
  t,
}: {
  message: string;
  side: PerpsProTradeSide;
  t: Translate;
}) => {
  const lines = message.split('\n');
  let mapped = false;
  const result = lines.map(line => {
    const normalized = line.trim();
    const key = getAloRejectionKey(normalized, side);
    if (!key) {
      return line;
    }
    mapped = true;
    return String(t(key));
  });
  if (!mapped) {
    return message;
  }
  return [...new Set(result)].join('\n');
};
