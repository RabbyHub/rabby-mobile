import { type ApprovalSpenderItemToBeRevoked } from '@rabby-wallet/biz-utils/dist/isomorphic/approval';
import { t } from 'i18next';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { abiCoder, sendRequest } from './sendRequest';
import { preferenceService } from '../services';
import type PQueue from 'p-queue';
import { findChain } from '@/utils/chain';
import { TokenSpenderPair } from '@rabby-wallet/biz-utils/dist/isomorphic/permit2';
import { approvalUtils, permit2Utils } from '@rabby-wallet/biz-utils';

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
    nftTokenId,
    isApprovedForAll,
  }: {
    chainServerId: string;
    contractId: string;
    spender: string;
    abi: 'ERC721' | 'ERC1155' | '';
    isApprovedForAll: boolean;
    nftTokenId?: string | null;
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
                [
                  '0x0000000000000000000000000000000000000000',
                  nftTokenId,
                ] as any,
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

  const abortRevoke = new AbortController();

  const revokeSummary = approvalUtils.summarizeRevoke(list);

  const revokeList: (() => Promise<void>)[] = [
    ...Object.entries(revokeSummary.permit2Revokes).map(
      ([permit2Key, item]) =>
        async () => {
          try {
            const { chainServerId, permit2ContractId } =
              permit2Utils.decodePermit2GroupKey(permit2Key);
            if (!permit2ContractId) return;
            if (chainServerId !== item.chainServerId) {
              console.warn(`chainServerId ${chainServerId} not match`, item);
              return;
            }

            await lockdownPermit2({
              id: permit2ContractId,
              chainServerId: item.chainServerId,
              tokenSpenders: item.tokenSpenders,
            });
          } catch (error) {
            abortRevoke.abort();
            if (__DEV__) console.error(error);
            console.error('batch revoke permit2 error', item);
          }
        },
    ),
    ...revokeSummary.generalRevokes.map(e => async () => {
      try {
        if ('nftTokenId' in e) {
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
        abortRevoke.abort();
        if (__DEV__) console.error(error);
        console.error('revoke error', e);
      }
    }),
  ];

  const waitAbort = new Promise<void>(resolve => {
    const onAbort = () => {
      queue.clear();
      resolve();

      abortRevoke.signal.removeEventListener('abort', onAbort);
    };
    abortRevoke.signal.addEventListener('abort', onAbort);
  });

  try {
    await Promise.race([queue.addAll(revokeList), waitAbort]);
  } catch (error) {
    console.log('revoke error', error);
  }
}

export async function lockdownPermit2(input: {
  id: string;
  chainServerId: string;
  tokenSpenders: TokenSpenderPair[];
  $ctx?: any;
  gasPrice?: number;
}) {
  const {
    chainServerId,
    id,
    tokenSpenders: _tokenSpenders,
    $ctx,
    gasPrice,
  } = input;

  const tokenSpenders = JSON.parse(JSON.stringify(_tokenSpenders));

  const account = await preferenceService.getCurrentAccount();
  if (!account) {
    throw new Error(t('background.error.noCurrentAccount'));
  }
  const chainId = findChain({
    serverId: chainServerId,
  })?.id;
  if (!chainId) {
    throw new Error(t('background.error.invalidChainId'));
  }
  const tx: any = {
    from: account.address,
    to: id,
    chainId: chainId,
    data: abiCoder.encodeFunctionCall(
      {
        constant: false,
        inputs: [
          {
            name: 'approvals',
            type: 'tuple[]',
            internalType: 'tuple[]',
            components: [
              { type: 'address', name: 'token' },
              { type: 'address', name: 'spender' },
            ],
          },
        ],
        name: 'lockdown',
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
      [tokenSpenders] as any,
    ),
  };
  if (gasPrice) {
    tx.gasPrice = gasPrice;
  }

  return await sendRequest(
    {
      $ctx,
      method: 'eth_sendTransaction',
      params: [tx],
    },
    INTERNAL_REQUEST_SESSION,
  );
}
