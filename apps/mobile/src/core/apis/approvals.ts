import { type ApprovalSpenderItemToBeRevoked } from '@rabby-wallet/biz-utils/dist/isomorphic/approval';
import { t } from 'i18next';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { abiCoder, sendRequest } from './sendRequest';
import { preferenceService } from '../services';
import type PQueue from 'p-queue/dist/index';
import { findChain } from '@/utils/chain';

async function approveToken(
  chainServerId: string,
  id: string,
  spender: string,
  amount: number | string,
  $ctx?: any,
  gasPrice?: number,
  extra?: { isSwap: boolean; swapPreferMEVGuarded?: boolean },
) {
  const account = await preferenceService.getCurrentAccount();
  if (!account) throw new Error(t('background.error.noCurrentAccount'));
  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) throw new Error(t('background.error.invalidChainId'));
  let tx: any = {
    from: account.address,
    to: id,
    chainId: chainId,
    data: abiCoder.encodeFunctionCall(
      {
        constant: false,
        inputs: [
          {
            name: '_spender',
            type: 'address',
          },
          {
            name: '_value',
            type: 'uint256',
          },
        ],
        name: 'approve',
        outputs: [
          {
            name: '',
            type: 'bool',
          },
        ],
        payable: false,
        stateMutability: 'nonpayable',
        type: 'function',
      },
      [spender, amount] as any,
    ),
  };
  if (gasPrice) {
    tx.gasPrice = gasPrice;
  }
  if (extra) {
    tx = {
      ...tx,
      ...extra,
    };
  }
  await sendRequest(
    {
      $ctx,
      method: 'eth_sendTransaction',
      params: [tx],
    },
    INTERNAL_REQUEST_SESSION,
  );
}

async function revokeNFTApprove(
  {
    chainServerId,
    contractId,
    spender,
    abi,
    tokenId,
    isApprovedForAll,
  }: {
    chainServerId: string;
    contractId: string;
    spender: string;
    abi: 'ERC721' | 'ERC1155' | '';
    isApprovedForAll: boolean;
    tokenId: string | null | undefined;
  },
  $ctx?: any,
) {
  const account = await preferenceService.getCurrentAccount();
  if (!account) throw new Error(t('background.error.noCurrentAccount'));
  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) throw new Error(t('background.error.invalidChainId'));
  if (abi === 'ERC721') {
    if (isApprovedForAll) {
      await sendRequest(
        {
          $ctx,
          method: 'eth_sendTransaction',
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
                      name: 'operator',
                      type: 'address',
                    },
                    {
                      internalType: 'bool',
                      name: 'approved',
                      type: 'bool',
                    },
                  ],
                  name: 'setApprovalForAll',
                  outputs: [],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                [spender, false] as any,
              ),
            },
          ],
        },
        INTERNAL_REQUEST_SESSION,
      );
    } else {
      await sendRequest(
        {
          $ctx,
          method: 'eth_sendTransaction',
          params: [
            {
              from: account.address,
              to: contractId,
              chainId: chainId,
              data: abiCoder.encodeFunctionCall(
                {
                  constant: false,
                  inputs: [
                    { internalType: 'address', name: 'to', type: 'address' },
                    {
                      internalType: 'uint256',
                      name: 'tokenId',
                      type: 'uint256',
                    },
                  ],
                  name: 'approve',
                  outputs: [],
                  payable: false,
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
                ['0x0000000000000000000000000000000000000000', tokenId] as any,
              ),
            },
          ],
        },
        INTERNAL_REQUEST_SESSION,
      );
    }
  } else if (abi === 'ERC1155') {
    await sendRequest(
      {
        $ctx,
        method: 'eth_sendTransaction',
        params: [
          {
            from: account.address,
            to: contractId,
            data: abiCoder.encodeFunctionCall(
              {
                constant: false,
                inputs: [
                  { internalType: 'address', name: 'to', type: 'address' },
                  { internalType: 'bool', name: 'approved', type: 'bool' },
                ],
                name: 'setApprovalForAll',
                outputs: [],
                payable: false,
                stateMutability: 'nonpayable',
                type: 'function',
              },
              [spender, false] as any,
            ),
            chainId,
          },
        ],
      },
      INTERNAL_REQUEST_SESSION,
    );
  } else {
    throw new Error(t('background.error.unknownAbi'));
  }
}

function getQueue(): PQueue {
  return new (require('p-queue/dist').default)({
    autoStart: true,
    concurrency: 1,
    timeout: undefined,
  });
}

export async function revoke({
  list,
}: {
  list: ApprovalSpenderItemToBeRevoked[];
}) {
  const queue = getQueue();
  const controller = new AbortController();

  const revokeList = list.map(e => async () => {
    try {
      if ('tokenId' in e) {
        await revokeNFTApprove(e);
      } else {
        await approveToken(e.chainServerId, e.id, e.spender, 0, {
          ga: {
            category: 'Security',
            source: 'tokenApproval',
          },
        });
      }
    } catch (error) {
      await queue.clear();
      console.error('revoke error', e);
      controller.abort();
    }
  });

  try {
    await queue.addAll(revokeList, { signal: controller.signal });
  } catch (error) {
    console.warn('[revoke] revoke error', error);
  }
}
