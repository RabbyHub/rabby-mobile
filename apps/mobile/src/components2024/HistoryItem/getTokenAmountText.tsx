import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { formatAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';

interface Props {
  amount: number;
  token: TokenItem;
}

export const getTokenAmountText = ({ amount, token }: Props) => {
  return `${formatAmount(amount || '0')} ${getTokenSymbol(token)}`;
};
