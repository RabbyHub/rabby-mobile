import {
  GasLevel,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Contract, providers } from 'ethers';
import { hexToString } from 'web3-utils';

import type { AbstractPortfolioToken } from '@/screens/Home/types';
import { findChain } from './chain';
import { CustomTestnetToken } from '@/core/services/customTestnetService';
import BigNumber from 'bignumber.js';
import { MINIMUM_GAS_LIMIT } from '@/constant/gas';
import { calcPercent } from '@/utils/math';
import { formatUsdValue, formatAmount } from '@/utils/number';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { Account } from '@/core/services/preference';
import { type TokenItemMaybeWithOwner } from '@/databases/hooks/token';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { ITokenItem } from '@/store/tokens';
import { columnConverter } from '@/databases/entities/_helpers';

export const SMALL_TOKEN_ID = '_SMALL_TOKEN_';
export const geTokenDecimals = async (
  id: string,
  provider: providers.JsonRpcProvider,
) => {
  try {
    const contract = new Contract(
      id,
      [
        {
          constant: true,
          inputs: [],
          name: 'decimals',
          outputs: [
            {
              name: '',
              type: 'uint8',
            },
          ],
          payable: false,
          stateMutability: 'view',
          type: 'function',
        },
      ],
      provider,
    );
    const decimals = await contract.decimals();
    return decimals;
  } catch (e) {
    const contract = new Contract(
      id,
      [
        {
          constant: true,
          inputs: [],
          name: 'DECIMALS',
          outputs: [
            {
              name: '',
              type: 'uint8',
            },
          ],
          payable: false,
          stateMutability: 'view',
          type: 'function',
        },
      ],
      provider,
    );
    return contract.DECIMALS();
  }
};

export const getTokenName = async (
  id: string,
  provider: providers.JsonRpcProvider,
) => {
  try {
    const contract = new Contract(
      id,
      [
        {
          constant: true,
          inputs: [],
          name: 'name',
          outputs: [
            {
              name: '',
              type: 'string',
            },
          ],
          payable: false,
          stateMutability: 'view',
          type: 'function',
        },
      ],
      provider,
    );
    const name = await contract.name();
    return name;
  } catch (e) {
    try {
      const contract = new Contract(
        id,
        [
          {
            constant: true,
            inputs: [],
            name: 'name',
            outputs: [
              {
                name: '',
                type: 'bytes32',
              },
            ],
            payable: false,
            stateMutability: 'view',
            type: 'function',
          },
        ],
        provider,
      );
      const name = await contract.name();
      return hexToString(name);
    } catch (e) {
      const contract = new Contract(
        id,
        [
          {
            constant: true,
            inputs: [],
            name: 'NAME',
            outputs: [
              {
                name: '',
                type: 'string',
              },
            ],
            payable: false,
            stateMutability: 'view',
            type: 'function',
          },
        ],
        provider,
      );
      return contract.NAME();
    }
  }
};

export const ellipsisTokenSymbol = (text: string, length = 6) => {
  if (text?.length <= length) {
    return text;
  }

  const regexp = new RegExp(`^(.{${length}})(.*)$`);
  return text?.replace(regexp, '$1...');
};

export function getTokenSymbol(token?: {
  optimized_symbol?: string | null;
  display_symbol?: string | null;
  symbol?: string | null;
}) {
  return (
    token?.optimized_symbol || token?.display_symbol || token?.symbol || ''
  );
}

export type TokenItemFromAbstractPortfolioToken = TokenItemMaybeWithOwner & {
  cex_ids?: string[];
  isFakerFoldRow?: boolean;
  isManualFold?: boolean;
  smallTokenAllUsdValue?: string;
  isPined?: boolean;
  isFold?: boolean;
  isExcludeBalance?: boolean;
  pinIndex?: number;
};
export const abstractTokenToTokenItem = (
  token: AbstractPortfolioToken & { cex_ids?: string[] },
): TokenItemFromAbstractPortfolioToken => {
  return {
    id: token._tokenId,
    chain: token.chain,
    amount: token.amount,
    raw_amount: token.raw_amount,
    decimals: token.decimals,
    display_symbol: token.display_symbol,
    is_core: token.is_core,
    is_verified: token.is_verified,
    is_wallet: token.is_wallet,
    is_scam: token.is_scam,
    is_suspicious: token.is_suspicious,
    logo_url: token.logo_url,
    name: token.name,
    optimized_symbol: token.optimized_symbol,
    price: token.price,
    symbol: token.symbol,
    time_at: token.time_at,
    price_24h_change: token.price_24h_change,
    //@ts-expect-error lack value_24h_change
    value_24h_change: token?.value_24h_change,
    low_credit_score: token?.low_credit_score,
    credit_score: token?.credit_score,
    cex_ids: token?.cex_ids,
    fdv: token?.fdv,
    isFakerFoldRow: token?.id === SMALL_TOKEN_ID,
    smallTokenAllUsdValue:
      token?.id === SMALL_TOKEN_ID ? token?._usdValueStr : undefined,
    isPined: token?._isPined,
    isFold: token?._isFold,
    isManualFold: token?._isManualFold,
    isExcludeBalance: token?._isExcludeBalance,
    pinIndex: token?._pinIndex,
  };
};

export class DisplayedToken implements AbstractPortfolioToken {
  // [immerable] = true;
  id: string;
  _tokenId: string;
  chain: string;
  logo_url: string;
  amount: number;
  symbol: string;
  price: number;
  decimals: number;
  display_symbol: string | null;
  raw_amount_hex_str?: string;
  is_core: boolean | null;
  is_wallet: boolean;
  name: string;
  optimized_symbol: string;
  is_verified: boolean | null;
  time_at: number;
  price_24h_change?: number | null;
  low_credit_score?: boolean;
  credit_score?: number;
  cex_ids: string[];
  fdv?: number;
  _amountStr?: string;
  _priceStr?: string;
  _amountChange?: number;
  _amountChangeStr = '';
  _usdValue?: number;
  _realUsdValue: number;
  _usdValueStr?: string;
  _historyPatched?: boolean;
  _usdValueChange?: number;
  _realUsdValueChange?: number;
  _usdValueChangeStr?: string;
  _usdValueChangePercent?: string;
  _amountChangeUsdValueStr = '';
  support_market_data?: boolean;

  constructor(token: PortfolioItemToken & { cex_ids?: string[] }) {
    this._tokenId = token.id;
    this.amount = token.amount || 0;
    this.id = token.id + token.chain;
    this.chain = token.chain;
    this.logo_url = token.logo_url;
    this.price = token.price || 0;
    this._realUsdValue = this.price * this.amount;
    // 注意这里，debt 也被处理成正值
    this._usdValue = Math.abs(this._realUsdValue);
    this.symbol = getTokenSymbol(token);

    this._usdValueStr = formatUsdValue(this._usdValue);
    this._priceStr = bizNumberUtils.formatPrice(this.price);
    this._amountStr = formatAmount(Math.abs(this.amount));
    this.decimals = token.decimals;
    this.is_core = token.is_core;
    this.display_symbol = token.display_symbol;
    this.is_verified = token.is_verified;
    this.optimized_symbol = token.optimized_symbol;
    this.is_wallet = token.is_wallet;
    this.name = token.name;
    this.time_at = token.time_at;
    this.price_24h_change = token.price_24h_change;
    // @ts-expect-error
    this.value_24h_change = token.value_24h_change;

    this.low_credit_score = token.low_credit_score;
    this.credit_score = token.credit_score;
    this.cex_ids = token.cex_ids || [];
    this.fdv = token.fdv || 0;
    // 默认是它
    this._usdValueChangeStr = '-';
    this.support_market_data = token.support_market_data;
    this.raw_amount_hex_str = token.raw_amount_hex_str;
    this.decimals = token.decimals;
  }

  patchHistory(h: PortfolioItemToken) {
    this._historyPatched = true;
    // debt 都当做正值
    this._amountChange = Math.abs(this.amount) - Math.abs(h.amount || 0);
    const amountChangeUsdValue = Math.abs(this._amountChange! * this.price);

    // 大于 $0.01 才展示
    if (amountChangeUsdValue >= 0.01) {
      this._amountChangeStr = `${formatAmount(this._amountChange)} ${
        this.symbol
      }`;
      this._amountChangeUsdValueStr = formatUsdValue(amountChangeUsdValue);
    }

    const preValue = (h.amount || 0) * (h.price || 0);
    const preUsdValue = Math.abs(preValue);
    this._usdValueChange = this._usdValue! - preUsdValue;
    this._usdValueChangeStr = formatUsdValue(Math.abs(this._usdValueChange));

    this._usdValueChangePercent = preUsdValue
      ? calcPercent(preUsdValue, this._usdValue, 2, true)
      : this._usdValue
      ? '+100.00%'
      : '+0.00%';

    this._realUsdValueChange = this._realUsdValue! - preValue;
  }

  patchPrice(price?: number) {
    if (this._historyPatched || (!price && price !== 0)) {
      return;
    }

    // 特殊情况，对于不支持历史结点的 portfolio，只当 amount 没有变化
    this.patchHistory({
      amount: this.amount,
      price,
    } as PortfolioItemToken);
  }

  // 24h 之前有，现在没有的不考虑展示，只展示当前仓位
  // static createFromHistory(h: PortfolioItemToken) {}
}

export class DisplayedTokenWithOwner
  extends DisplayedToken
  implements AbstractPortfolioToken
{
  constructor(token: PortfolioItemToken, ownerAccount?: Account | null) {
    super(token);

    this.setOwner(ownerAccount);
  }

  ownerAccount?: Account | null = null;

  setOwner(ownerAccount?: Account | null) {
    if (ownerAccount) {
      this.ownerAccount = { ...ownerAccount };
    }
  }
}

export function tokenItem2AbstractTokenWithOwner(
  token: TokenItem,
  account?: Account | null,
) {
  return new DisplayedTokenWithOwner(token, account);
}

export const customTestnetTokenToTokenItem = (
  token: CustomTestnetToken,
): TokenItem => {
  const chain = findChain({
    id: token.chainId,
  });
  return {
    id: token.id,
    chain: chain?.serverId || '',
    amount: token.amount,
    raw_amount: token.rawAmount,
    raw_amount_hex_str: `0x${new BigNumber(token.rawAmount || 0).toString(16)}`,
    decimals: token.decimals,
    display_symbol: token.symbol,
    is_core: false,
    is_verified: false,
    is_wallet: false,
    is_scam: false,
    is_suspicious: false,
    logo_url: '',
    name: token.symbol,
    optimized_symbol: token.symbol,
    price: 0,
    symbol: token.symbol,
    time_at: 0,
    price_24h_change: 0,
    //@ts-expect-error
    value_24h_change: 0,
  };
};

export const isTestnetTokenItem = (token: TokenItem) => {
  return findChain({
    serverId: token.chain,
  })?.isTestnet;
};

export const isSameTestnetToken = <
  T1 extends Pick<CustomTestnetToken, 'id' | 'chainId'>,
  T2 extends Pick<CustomTestnetToken, 'id' | 'chainId'>,
>(
  token1: T1,
  token2: T2,
) => {
  if (!token1 || !token2) {
    return false;
  }
  return (
    token1.id?.toLowerCase() === token2.id?.toLowerCase() &&
    +token1.chainId === +token2.chainId
  );
};

function checkGasIsEnough({
  token_balance_hex,
  price,
  gasLimit,
}: {
  token_balance_hex: TokenItem['raw_amount_hex_str'];
  price: number;
  gasLimit: number;
}) {
  return new BigNumber(token_balance_hex || 0, 16).gte(
    new BigNumber(gasLimit).times(price),
  );
}
export function checkIfTokenBalanceEnough(
  token: TokenItem,
  options?: {
    gasLimit?: number;
    gasList?: GasLevel[];
  },
) {
  const { gasLimit = MINIMUM_GAS_LIMIT, gasList = [] } = options || {};
  const normalLevel = gasList?.find(e => e.level === 'normal');
  const slowLevel = gasList?.find(e => e.level === 'slow');
  const customLevel = gasList?.find(e => e.level === 'custom');

  const isNormalEnough = checkGasIsEnough({
    token_balance_hex: token?.raw_amount_hex_str,
    price: normalLevel?.price || 0,
    gasLimit,
  });
  const isSlowEnough = checkGasIsEnough({
    token_balance_hex: token?.raw_amount_hex_str,
    price: slowLevel?.price || 0,
    gasLimit,
  });

  return {
    normalLevel,
    isNormalEnough,
    isSlowEnough,
    slowLevel,
    customLevel,
  };
}

export const tokenItemEntityToTokenItem = (
  token: TokenItemEntity,
): ITokenItem => {
  return {
    ...token,
    usd_value: token.price * token.amount,
    cex_ids:
      typeof token.cex_ids === 'string' // TODO: 处理干净后移除兼容逻辑
        ? columnConverter.jsonStringToObj(token.cex_ids)
        : token.cex_ids,
  };
};

export const tokenItemToITokenItem = (
  token: TokenItem,
  owner: string,
): ITokenItem => {
  return {
    ...token,
    usd_value: token.price * token.amount,
    owner_addr: owner,
    cex_ids: token.cex_ids || [],
  };
};
