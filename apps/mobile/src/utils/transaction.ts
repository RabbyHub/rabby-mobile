import { CHAINS_ENUM } from '@/constant/chains';
import abi from 'human-standard-token-abi';
import { CHAINS } from '@/constant/chains';
import type {
  ExplainTxResponse,
  GasLevel,
  Tx,
} from '@rabby-wallet/rabby-api/dist/types';
import { isHexString } from 'ethereumjs-util';
import BigNumber from 'bignumber.js';
import { minBy } from 'lodash';
import { KEYRING_CATEGORY_MAP } from '@rabby-wallet/keyring-utils';
import { ethers } from 'ethers';
import { isHex, hexToString, stringToHex } from 'web3-utils';

export const is1559Tx = (tx: Tx) => {
  if (!('maxFeePerGas' in tx) || !('maxPriorityFeePerGas' in tx)) {
    return false;
  }
  return (
    isHexString(tx.maxFeePerGas || '') &&
    isHexString(tx.maxPriorityFeePerGas || '')
  );
};
export const GASPRICE_RANGE = {
  [CHAINS_ENUM.ETH]: [0, 20000],
  [CHAINS_ENUM.BOBA]: [0, 20000],
  [CHAINS_ENUM.OP]: [0, 20000],
  [CHAINS_ENUM.BASE]: [0, 20000],
  [CHAINS_ENUM.ZORA]: [0, 20000],
  [CHAINS_ENUM.ERA]: [0, 20000],
  [CHAINS_ENUM.KAVA]: [0, 20000],
  [CHAINS_ENUM.ARBITRUM]: [0, 20000],
  [CHAINS_ENUM.AURORA]: [0, 20000],
  [CHAINS_ENUM.BSC]: [0, 20000],
  [CHAINS_ENUM.AVAX]: [0, 40000],
  [CHAINS_ENUM.POLYGON]: [0, 100000],
  [CHAINS_ENUM.FTM]: [0, 100000],
  [CHAINS_ENUM.GNOSIS]: [0, 500000],
  [CHAINS_ENUM.OKT]: [0, 50000],
  [CHAINS_ENUM.HECO]: [0, 100000],
  [CHAINS_ENUM.CELO]: [0, 100000],
  [CHAINS_ENUM.MOVR]: [0, 50000],
  [CHAINS_ENUM.CRO]: [0, 500000],
  [CHAINS_ENUM.BTT]: [0, 20000000000],
  [CHAINS_ENUM.METIS]: [0, 50000],
};
export const validateGasPriceRange = (tx: Tx) => {
  const chain = Object.values(CHAINS).find(c => c.id === tx.chainId);
  if (!chain) {
    return true;
  }
  const range = (GASPRICE_RANGE as any)[chain.enum];
  if (!range) {
    return true;
  }
  const [min, max] = range;
  if (Number((tx as Tx).gasPrice || tx.maxFeePerGas) / 1e9 < min) {
    throw new Error('GasPrice too low');
  }
  if (Number((tx as Tx).gasPrice || tx.maxFeePerGas) / 1e9 > max) {
    throw new Error('GasPrice too high');
  }
  return true;
};

export const convert1559ToLegacy = tx => {
  return {
    chainId: tx.chainId,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
    gasPrice: tx.maxFeePerGas,
    nonce: tx.nonce,
  };
};

export const convertLegacyTo1559 = (tx: Tx) => {
  return {
    chainId: tx.chainId,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    data: tx.data,
    gas: tx.gas,
    maxFeePerGas: tx.gasPrice,
    maxPriorityFeePerGas: tx.gasPrice,
    nonce: tx.nonce,
  };
};

export function getKRCategoryByType(type?: string) {
  return KEYRING_CATEGORY_MAP[type as any] || null;
}

export const calcMaxPriorityFee = (
  gasList: GasLevel[],
  target: GasLevel,
  chainId: number,
  useMaxFee: boolean,
) => {
  if (chainId !== 1 || useMaxFee) {
    return target.price;
  }
  if (target.priority_price && target.priority_price !== null) {
    return target.priority_price;
  }
  // only enable auto-priorityFee for ETH currently
  const min = minBy(
    gasList.filter(item => item.level !== 'custom'),
    'price',
  );
  if (min) {
    if (target.price < min.price) return target.price / 10;
    const basePriorityFee = target.price / 10;
    if (min.level === target.level) {
      return basePriorityFee;
    } else {
      const gap = target.price - min.price;
      const value = new BigNumber(gap)
        .times(0.8)
        .plus(basePriorityFee)
        .toFixed(1);
      return Number(value);
    }
  } else {
    return target.price;
  }
};

export function makeTransactionId(
  fromAddr: string,
  nonce: number | string,
  chainEnum: string,
) {
  if (typeof nonce === 'number') {
    nonce = `0x${nonce.toString(16)}`;
  } else if (typeof nonce === 'string') {
    nonce = nonce.startsWith('0x') ? nonce : `0x${nonce}`;
  }
  return `${fromAddr}_${nonce}_${chainEnum}`;
}

const hstInterface = new ethers.utils.Interface(abi);

export function getTokenData(data: string) {
  try {
    return hstInterface.parseTransaction({ data });
  } catch (error) {
    return undefined;
  }
}

export function getTokenAddressParam(
  tokenData: ethers.utils.TransactionDescription,
): string {
  const value = tokenData?.args?._to || tokenData?.args?.[0];
  return value?.toString().toLowerCase();
}

export function calcTokenValue(value: string, decimals: number) {
  const multiplier = Math.pow(10, Number(decimals || 0));
  return new BigNumber(String(value)).times(multiplier);
}

export function getCustomTxParamsData(
  data: string,
  {
    customPermissionAmount,
    decimals,
  }: { customPermissionAmount: string; decimals: number },
) {
  const methodId = data.substring(0, 10);
  if (methodId === '0x39509351') {
    // increaseAllowance
    const iface = new ethers.utils.Interface([
      {
        inputs: [
          { internalType: 'address', name: 'spender', type: 'address' },
          { internalType: 'uint256', name: 'increment', type: 'uint256' },
        ],
        name: 'increaseAllowance',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function',
      },
    ]);
    const [spender] = iface.decodeFunctionData('increaseAllowance', data);
    const customPermissionValue = calcTokenValue(
      customPermissionAmount,
      decimals,
    );
    const calldata = iface.encodeFunctionData('increaseAllowance', [
      spender,
      customPermissionValue.toFixed(),
    ]);
    return calldata;
  } else {
    const tokenData = getTokenData(data);

    if (!tokenData) {
      throw new Error('Invalid data');
    }
    let spender = getTokenAddressParam(tokenData);
    if (spender.startsWith('0x')) {
      spender = spender.substring(2);
    }
    const [signature, tokenValue] = data.split(spender);

    if (!signature || !tokenValue) {
      throw new Error('Invalid data');
    } else if (tokenValue.length !== 64) {
      throw new Error(
        'Invalid token value; should be exactly 64 hex digits long (u256)',
      );
    }

    let customPermissionValue = calcTokenValue(
      customPermissionAmount,
      decimals,
    ).toString(16);

    if (customPermissionValue.length > 64) {
      throw new Error('Custom value is larger than u256');
    }

    customPermissionValue = customPermissionValue.padStart(
      tokenValue.length,
      '0',
    );
    const customTxParamsData = `${signature}${spender}${customPermissionValue}`;
    return customTxParamsData;
  }
}

export function varyTxSignType(txDetail: ExplainTxResponse | null) {
  let isNFT = false;
  let isToken = false;
  let gaCategory: 'Security' | 'Send' = 'Send';
  let gaAction:
    | 'signTx'
    | 'signDeclineTokenApproval'
    | 'signDeclineNFTApproval'
    | 'signDeclineTokenAndNFTApproval' = 'signTx';

  if (
    txDetail?.type_deploy_contract ||
    txDetail?.type_cancel_tx ||
    txDetail?.type_call
  ) {
    // nothing to do
  }
  if (
    txDetail?.type_cancel_token_approval ||
    txDetail?.type_cancel_single_nft_approval ||
    txDetail?.type_cancel_nft_collection_approval
  ) {
    gaCategory = 'Security';
  } else {
    gaCategory = 'Send';
  }

  if (
    txDetail?.type_send ||
    txDetail?.type_cancel_token_approval ||
    txDetail?.type_token_approval
  ) {
    isToken = true;
  }

  if (
    txDetail?.type_cancel_single_nft_approval ||
    txDetail?.type_cancel_nft_collection_approval ||
    txDetail?.type_single_nft_approval ||
    txDetail?.type_nft_collection_approval ||
    txDetail?.type_nft_send
  ) {
    isNFT = true;
  }

  if (gaCategory === 'Security') {
    if (isToken && !isNFT) {
      gaAction = 'signDeclineTokenApproval';
    } else if (!isToken && isNFT) {
      gaAction = 'signDeclineNFTApproval';
    } else if (isToken && isNFT) {
      gaAction = 'signDeclineTokenAndNFTApproval';
    }
  }

  return {
    gaCategory,
    gaAction,
    isNFT,
    isToken,
  };
}

/**
 * @description accept input data as hex or string, and return the formatted result
 */
export function formatTxInputDataOnERC20(maybeHex: string) {
  const result = {
    withInputData: false,
    currentIsHex: false,
    currentData: '',
    hexData: '',
    utf8Data: '',
  };

  if (!maybeHex) return result;

  result.currentIsHex = maybeHex.startsWith('0x') && isHex(maybeHex);

  if (result.currentIsHex) {
    try {
      result.currentData = hexToString(maybeHex);
      result.withInputData = true;
      result.hexData = maybeHex;
      result.utf8Data = result.currentData;
    } catch (err) {
      result.currentData = '';
    }
  } else {
    result.currentData = maybeHex;
    result.hexData = stringToHex(maybeHex);
    result.utf8Data = maybeHex;
    result.withInputData = true;
  }

  return result;
}

function formatNumberArg(arg: string | number, opt = {} as BigNumber.Format) {
  const bn = new BigNumber(arg);
  const format = {
    prefix: '',
    decimalSeparator: '.',
    groupSeparator: '',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0,
    suffix: '',
    ...opt,
  };

  return bn.toFormat(0, format);
}

export function formatTxExplainAbiData(abi?: ExplainTxResponse['abi'] | null) {
  return [
    abi?.func,
    '(',
    (abi?.params || [])
      ?.map((argValue, idx) => {
        const argValueText =
          typeof argValue === 'number' ? formatNumberArg(argValue) : argValue;
        return `arg${idx}=${argValueText}`;
      })
      .join(', '),
    ')',
  ].join('');
}
