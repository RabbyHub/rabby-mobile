import { ethers } from 'ethers';
import { omit } from 'lodash';
import { Common, Hardfork } from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';
import { bytesToHex } from '@ethereumjs/util';
import { CHAINS_ENUM } from '@/constant/chains';
import { addresses, abis } from '@eth-optimism/contracts-ts';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import providerController from '../controllers/provider';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { OP_STACK_ENUMS } from '@/constant/gas';
import { CHAINS } from '@/constant/chains';
import { openapi } from '@/core/request';
import BigNumber from 'bignumber.js';
import { t } from 'i18next';

function buildTxParams(txMeta) {
  return {
    ...omit(txMeta.txParams, 'gas'),
    gasLimit: txMeta.txParams.gas,
  };
}

function buildTransactionCommon(txMeta) {
  // This produces a transaction whose information does not completely match an
  // Optimism transaction — for instance, DEFAULT_CHAIN is still 'mainnet' and
  // genesis points to the mainnet genesis, not the Optimism genesis — but
  // considering that all we want to do is serialize a transaction, this works
  // fine for our use case.
  return Common.custom({
    chainId: Number(txMeta.chainId),
    // Optimism only supports type-0 transactions; it does not support any of
    // the newer EIPs since EIP-155. Source:
    // <https://github.com/ethereum-optimism/optimism/blob/develop/specs/l2geth/transaction-types.md>
    defaultHardfork: Hardfork.SpuriousDragon,
  });
}

export default function buildUnserializedTransaction(txMeta) {
  const txParams = buildTxParams(txMeta);
  const common = buildTransactionCommon(txMeta);
  return TransactionFactory.fromTxData(txParams, { common });
}

export { sendRequest } from './sendRequest';

export const requestETHRpc = (
  data: { method: string; params: any },
  chainId: string,
) => {
  return providerController.ethRpc(
    {
      data,
      session: INTERNAL_REQUEST_SESSION,
    },
    chainId,
  );
};

// https://docs.scroll.io/en/developers/transaction-fees-on-scroll/#calculating-the-l1-data-fee-with-gas-oracle
export const scrollL1FeeEstimate = async (txParams: any) => {
  const account = await preferenceService.getCurrentAccount();
  const iface = new ethers.utils.Interface([
    {
      type: 'constructor',
      stateMutability: 'nonpayable',
      inputs: [{ type: 'address', name: '_owner', internalType: 'address' }],
    },
    {
      type: 'function',
      stateMutability: 'view',
      outputs: [{ type: 'uint256', name: '', internalType: 'uint256' }],
      name: 'getL1Fee',
      inputs: [{ type: 'bytes', name: '_data', internalType: 'bytes' }],
    },
  ]);

  const serializedTransaction = buildUnserializedTransaction({
    txParams,
  }).serialize();
  const calldata = iface.encodeFunctionData('getL1Fee', [
    bytesToHex(serializedTransaction),
  ]);
  const res = await openapi.ethRpc(CHAINS[CHAINS_ENUM.SCRL].serverId, {
    method: 'eth_call',
    params: [
      {
        from: account?.address,
        to: '0x5300000000000000000000000000000000000002',
        data: calldata,
      },
    ],
  });
  return res;
};

// https://community.optimism.io/docs/developers/build/transaction-fees/#the-l1-data-fee
export const opStackL1FeeEstimate = async (
  txParams: any,
  chain: CHAINS_ENUM,
) => {
  const account = await preferenceService.getCurrentAccount();
  const address = addresses.GasPriceOracle[420];
  const abi = abis.GasPriceOracle;
  const serializedTransaction = buildUnserializedTransaction({
    txParams,
  }).serialize();
  const iface = new ethers.utils.Interface(abi);
  const calldata = iface.encodeFunctionData('getL1Fee', [
    bytesToHex(serializedTransaction),
  ]);
  const res = await openapi.ethRpc(CHAINS[chain].serverId, {
    method: 'eth_call',
    params: [
      {
        from: account?.address,
        to: address,
        data: calldata,
      },
    ],
  });
  return res;
};

export const fetchEstimatedL1Fee = async (
  txParams: any,
  chain = CHAINS_ENUM.OP,
): Promise<string> => {
  if (OP_STACK_ENUMS.includes(chain)) {
    return opStackL1FeeEstimate(txParams, chain);
  } else if (chain === CHAINS_ENUM.SCRL) {
    return scrollL1FeeEstimate(txParams);
  }
  return Promise.resolve('0x0');
};

export const getRecommendNonce = async ({
  from,
  chainId,
}: {
  from: string;
  chainId: number;
}) => {
  const chain = Object.values(CHAINS).find(item => item.id === chainId);
  if (!chain) {
    throw new Error(t('background.error.invalidChainId'));
  }
  const onChainNonce = await requestETHRpc(
    {
      method: 'eth_getTransactionCount',
      params: [from, 'latest'],
    },
    chain.serverId,
  );
  const localNonce =
    (await transactionHistoryService.getNonceByChain(from, chainId)) || 0;
  return `0x${BigNumber.max(onChainNonce, localNonce).toString(16)}`;
};
