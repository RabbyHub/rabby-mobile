import { openapi } from '@/core/request';
import { GAS_ACCOUNT_INSUFFICIENT_TIP } from '@/screens/GasAccount/hooks/checkTsx';
import type {
  GasAccountCheckResult,
  Tx,
} from '@rabby-wallet/rabby-api/dist/types';
import type { SignTxCheckError } from './calc';

const GAS_ACCOUNT_CHAIN_NOT_SUPPORTED = 4001;
const GAS_ACCOUNT_BALANCE_NOT_ENOUGH = 4002;
const GAS_ACCOUNT_UNAVAILABLE = 4003;

const buildGasAccountErrors = ({
  isSupportedAddr,
  noCustomRPC,
  errMsg,
  chainNotSupport,
  balanceEnough,
  isGasAccount,
}: {
  isSupportedAddr: boolean;
  noCustomRPC: boolean;
  errMsg?: string;
  chainNotSupport?: boolean;
  balanceEnough?: boolean;
  isGasAccount?: boolean;
}): SignTxCheckError[] => {
  if (!isSupportedAddr || !noCustomRPC) {
    return [];
  }

  if (errMsg) {
    return [
      {
        code: GAS_ACCOUNT_UNAVAILABLE,
        msg: errMsg,
        level: 'forbidden',
      },
    ];
  }

  if (chainNotSupport || isGasAccount === false) {
    return [
      {
        code: GAS_ACCOUNT_CHAIN_NOT_SUPPORTED,
        msg: 'GasAccount is not available on current chain',
        level: 'forbidden',
      },
    ];
  }

  if (!balanceEnough) {
    return [
      {
        code: GAS_ACCOUNT_BALANCE_NOT_ENOUGH,
        msg: GAS_ACCOUNT_INSUFFICIENT_TIP,
        level: 'forbidden',
      },
    ];
  }

  return [];
};

export const checkGasAccountLevelValidation = async ({
  isReady,
  noCustomRPC,
  isSupportedAddr,
  sig,
  gasAccountAddress,
  txs,
}: {
  isReady: boolean;
  noCustomRPC: boolean;
  isSupportedAddr: boolean;
  sig?: string;
  gasAccountAddress?: string;
  txs: Tx[];
}): Promise<{
  valid: boolean;
  cost: number;
  errors: SignTxCheckError[];
  result?: GasAccountCheckResult;
}> => {
  if (!isReady || !txs.length || !sig || !gasAccountAddress) {
    return {
      valid: false,
      cost: 0,
      errors: buildGasAccountErrors({
        isSupportedAddr,
        noCustomRPC,
        errMsg: !sig || !gasAccountAddress ? 'GasAccount is not ready' : '',
      }),
    };
  }

  try {
    const res = await openapi.checkGasAccountTxs({
      sig,
      account_id: gasAccountAddress,
      tx_list: txs,
    });

    const errors = buildGasAccountErrors({
      isSupportedAddr,
      noCustomRPC,
      errMsg: res.err_msg,
      chainNotSupport: res.chain_not_support,
      balanceEnough: res.balance_is_enough,
      isGasAccount: res.is_gas_account,
    });

    return {
      valid: errors.length === 0,
      cost:
        (res.gas_account_cost?.estimate_tx_cost || 0) +
        (res.gas_account_cost?.gas_cost || 0),
      errors,
      result: res,
    };
  } catch (error: any) {
    return {
      valid: false,
      cost: 0,
      errors: buildGasAccountErrors({
        isSupportedAddr,
        noCustomRPC,
        errMsg: error?.message || 'GasAccount validation failed',
      }),
    };
  }
};
