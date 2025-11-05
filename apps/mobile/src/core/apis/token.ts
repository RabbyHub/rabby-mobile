import { findChain, findChainByServerID } from '@/utils/chain';
import { preferenceService } from '../services';
import { abiCoder, sendRequest } from './sendRequest';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { t } from 'i18next';
import { AbiCoder } from 'web3-eth-abi';
import { addHexPrefix, unpadHexString } from 'ethereumjs-util';
import { Account } from '../services/preference';

export async function transferNFT(
  {
    to,
    chainServerId,
    contractId,
    abi,
    tokenId,
    amount,
    account,
  }: {
    to: string;
    chainServerId: string;
    contractId: string;
    abi: 'ERC721' | 'ERC1155';
    tokenId: string;
    amount?: number;
    account: Account;
  },
  options: {
    $ctx?: any;
    isBuild?: boolean;
  },
) {
  if (!account) throw new Error(t('background.error.noCurrentAccount'));
  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) throw new Error(t('background.error.invalidChainId'));

  const { $ctx, isBuild = false } = options;
  const dataBase = {
    $ctx,
    method: 'eth_sendTransaction',
    ...(isBuild && {
      chainId: chainId,
      from: account.address,
      to: contractId,
    }),
  };
  if (abi === 'ERC721') {
    return sendRequest(
      {
        data: {
          ...dataBase,
          params: [
            {
              from: account.address,
              to: contractId,
              chainId: chainId,
              data: abiCoder.encodeFunctionCall(
                {
                  constant: false,
                  inputs: [
                    { internalType: 'address', name: 'from', type: 'address' },
                    { internalType: 'address', name: 'to', type: 'address' },
                    {
                      internalType: 'uint256',
                      name: 'tokenId',
                      type: 'uint256',
                    },
                  ],
                  name: 'safeTransferFrom',
                  outputs: [],
                  payable: false,
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [account.address, to, tokenId],
              ),
            },
          ],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      },
      isBuild,
    );
  } else if (abi === 'ERC1155') {
    return await sendRequest(
      {
        data: {
          ...dataBase,
          params: [
            {
              from: account.address,
              to: contractId,
              chainId: chainId,
              data: abiCoder.encodeFunctionCall(
                {
                  inputs: [
                    {
                      internalType: 'address',
                      name: 'from',
                      type: 'address',
                    },
                    {
                      internalType: 'address',
                      name: 'to',
                      type: 'address',
                    },
                    {
                      internalType: 'uint256',
                      name: 'id',
                      type: 'uint256',
                    },
                    {
                      internalType: 'uint256',
                      name: 'amount',
                      type: 'uint256',
                    },
                    {
                      internalType: 'bytes',
                      name: 'data',
                      type: 'bytes',
                    },
                  ],
                  name: 'safeTransferFrom',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [account.address, to, tokenId, amount, []] as any,
              ),
            },
          ],
        },
        session: INTERNAL_REQUEST_SESSION,
        account,
      },
      isBuild,
    );
  } else {
    throw new Error(t('background.error.unknownAbi'));
  }
}

export const sendToken = async ({
  to,
  chainServerId,
  tokenId,
  rawAmount,
  $ctx,
  isBuild,
  account,
}: {
  to: string;
  chainServerId: string;
  tokenId: string;
  rawAmount: string;
  isBuild?: boolean;
  $ctx?: any;
  account: Account;
}) => {
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }
  const chain = findChainByServerID(chainServerId);
  const chainId = chain?.id;
  if (!chainId) {
    throw new Error(t('background.error.invalidChainId'));
  }
  const params: Record<string, any> = {
    chainId: chain.id,
    from: account!.address,
    to: tokenId,
    value: '0x0',
    data: (abiCoder as unknown as AbiCoder).encodeFunctionCall(
      {
        name: 'transfer',
        type: 'function',
        inputs: [
          {
            type: 'address',
            name: 'to',
          },
          {
            type: 'uint256',
            name: 'value',
          },
        ],
      },
      [to, rawAmount],
    ),
    isSend: true,
  };
  const isNativeToken = tokenId === chain.nativeTokenAddress;

  if (isNativeToken) {
    params.to = to;
    delete params.data;
    params.value = addHexPrefix(
      unpadHexString(
        (abiCoder as unknown as AbiCoder).encodeParameter('uint256', rawAmount),
      ),
    );
  }

  return await sendRequest(
    {
      data: {
        method: 'eth_sendTransaction',
        params: [params],
        $ctx,
      },
      session: INTERNAL_REQUEST_SESSION,
      account,
    },
    isBuild,
  );
};
