import { getRecommendNonce } from '@/core/apis/provider';
import { Account } from '@/core/services/preference';
import { t } from 'i18next';
import { hexToNumber, isHex } from 'viem';
import { intToHex } from './number';

export type RetryUpdateType = 'nonce' | 'gasPrice' | 'origin' | false;

class TxRetry {
  private _retryUpdateType: RetryUpdateType = false;

  private _recommendNonce: string = '0x0';

  get retryUpdateType() {
    return this._retryUpdateType;
  }

  get recommendNonce() {
    return this._recommendNonce;
  }

  setRecommendNonce(nonce: string) {
    this._recommendNonce = nonce;
  }

  reset() {
    this._retryUpdateType = false;
    this._recommendNonce = '0x0';
  }

  setType(type: RetryUpdateType) {
    this._retryUpdateType = type;
  }
}

const txErrorRetryState = new TxRetry();

export const getRetryTxType = () => txErrorRetryState.retryUpdateType;

export const setRetryTxType = (type: RetryUpdateType) => {
  txErrorRetryState.setType(type);
};

export const retryTxReset = () => {
  txErrorRetryState.reset();
};

export const getRetryTxRecommendNonce = () => txErrorRetryState.recommendNonce;

export const setRetryTxRecommendNonce = async ({
  nonce,
  from,
  account,
  chainId,
}: {
  nonce: string;
  from: string;
  chainId: number;
  account: Account;
}) => {
  let recommendNonce: string = nonce;

  try {
    recommendNonce = await getRecommendNonce({
      from: from,
      chainId: chainId,
      account: account,
    });
    if (recommendNonce === nonce) {
      recommendNonce = intToHex(
        hexToNumber(recommendNonce as '0x${string}') + 1,
      );
    }
  } catch (error) {
    recommendNonce = intToHex(hexToNumber(nonce as '0x${string}') + 1);
    console.debug('recommendNonce error', error);
  }

  txErrorRetryState.setRecommendNonce(recommendNonce);

  return recommendNonce;
};

type HintRule = {
  keywords: string[];
  result:
    | ((params?: { nonce?: string }) => [string, RetryUpdateType])
    | [string, RetryUpdateType];
};

const defaultHint: HintRule['result'] = [
  // 'Something is wrong. Please retry later.',
  t('page.signTx.errorRetry.defaultTips'),

  false,
];
const hintRules: HintRule[] = [
  {
    keywords: ['insufficient funds for gas'],
    result: [
      // 'Your gas balance isn’t enough to cover the network gas fee. Add funds for gas and try again.',
      t('page.signTx.errorRetry.insufficient'),
      false,
    ],
  },
  {
    keywords: [
      'max fee per gas less than block base fee',
      'transaction underpriced',
    ],
    result: [
      // 'Gas price too low. We’ll adjust it by 30% to help your transaction confirm. Click “Retry” to confirm and try again.',
      t('page.signTx.errorRetry.gasPriceTooLow'),
      'gasPrice',
    ],
  },
  {
    keywords: ['nonce too low'],
    result: params => [
      // `Nonce too low. We’ll update it to ${
      //   params?.nonce
      //     ? isHex(params?.nonce)
      //       ? hexToNumber(params?.nonce as `0x${string}`) + 1
      //       : typeof params?.nonce === 'number'
      //       ? params?.nonce + 1
      //       : ''
      //     : ''
      // }. Click “Retry” to confirm and try again.`,
      t('page.signTx.errorRetry.nonceTooLow', {
        nonce: params?.nonce
          ? isHex(params?.nonce)
            ? hexToNumber(params?.nonce as `0x${string}`)
            : typeof params?.nonce === 'number'
            ? params?.nonce
            : ''
          : '',
      }),
      'nonce',
    ],
  },
  {
    keywords: ['nonce too high'],
    result: [
      // 'Nonce too high. Please adjust the nonce and try again.'
      t('page.signTx.errorRetry.nonceTooHigh'),
      false,
    ],
  },
  {
    keywords: ['already known'],
    result: [
      // 'Transaction already submitted. Duplicate transaction detected.',
      t('page.signTx.errorRetry.alreadySubmitted'),
      false,
    ],
  },
  {
    keywords: ['exceeds block gas limit'],
    result: [
      // 'Gas exceeds block gas limit. Please adjust and try again.',
      t('page.signTx.errorRetry.gasExceedsBlockGasLimit'),
      false,
    ],
  },
  {
    keywords: ['invalid transaction', 'invalid sender'],
    result: [
      // 'Invalid transaction. '
      t('page.signTx.errorRetry.InvalidTx'),
      false,
    ],
  },
  {
    keywords: ['intrinsic gas too low'],
    result: [
      // 'Gas limit too low. Please adjust and try again.'
      t('page.signTx.errorRetry.gasLimitTooLow'),
      false,
    ],
  },
];

export const getTxFailedResult = (
  origin: string,
  params?: { nonce?: string },
) => {
  const lowerText = origin.toLowerCase();

  for (const rule of hintRules) {
    if (
      rule.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
    ) {
      return typeof rule.result === 'function'
        ? rule.result?.({ nonce: getRetryTxRecommendNonce(), ...params })
        : rule.result;
    }
  }

  // return defaultHint;
  return [origin, false] as [string, RetryUpdateType];
};

export const useDebugToastErrorTxRetryInfo = ({
  description,
  isFailedTx,
  tx,
  account,
}: {
  description: string;
  isFailedTx: boolean;
  tx: {
    chainId?: number;
    from?: string;
    nonce?: string;
    gasPrice?: string;
    maxFeePerGas?: string;
  };
  account?: Account;
}) => {
  // useEffect(() => {
  //   if (
  //     isNonPublicProductionEnv &&
  //     description &&
  //     isFailedTx &&
  //     tx.chainId &&
  //     tx.from &&
  //     tx.nonce
  //   ) {
  //     toast.info(
  //       `
  //               origin error: ${description}
  //               nonce: ${tx.nonce}
  //               gasPrice: ${tx.gasPrice}
  //               maxFeePerGas: ${tx.maxFeePerGas}
  //               `,
  //       { duration: 3000 },
  //     );
  //   }
  // }, [
  //   account,
  //   description,
  //   isFailedTx,
  //   tx.chainId,
  //   tx.from,
  //   tx.gasPrice,
  //   tx.maxFeePerGas,
  //   tx.nonce,
  // ]);
};
