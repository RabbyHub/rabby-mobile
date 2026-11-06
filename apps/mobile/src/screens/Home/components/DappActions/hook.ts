import type {
  PortfolioItem,
  Tx,
  WithdrawAction,
} from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BLACKLIST_METHODS,
  WHITELIST_ADDRESS,
  WHITELIST_SPENDER,
} from './constant';
import type { AbiFunction } from 'viem';
import { encodeFunctionData, parseAbiItem } from 'viem';
import { findChain } from '@/utils/chain';
import { isValidAddress } from '@ethereumjs/util';
import PQueue from 'p-queue';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import BigNumber from 'bignumber.js';
import { CHAINS_ENUM } from '@/constant/chains';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { getERC20Allowance, requestETHRpc } from '@/core/apis/provider';
import type { Account } from '@/core/startupServices/preference';
import { approveToken } from '@/core/apis/approvals';
import { openapi } from '@/core/request';
import { findLast } from 'lodash';
import { toast } from '@/components2024/Toast';

const rpcQueue = new PQueue({
  concurrency: 20,
  interval: 1000,
  intervalCap: 10,
});

const BLACKLIST_METHOD_SET = new Set(
  BLACKLIST_METHODS.map(name => name.toLowerCase()),
);

// Name parsed for encodeFunctionData. That name is what tx.data's selector is built from.
// Any parameter overload of these names is blocked.
export const isBlacklistMethodName = (name: string) => {
  return BLACKLIST_METHOD_SET.has(name.toLowerCase());
};

export const isWhitelistAddress = (address: string) => {
  return WHITELIST_ADDRESS.some(item => isSameAddress(item, address));
};

export const isWhitelistSpender = (address: string, chain: string) => {
  return WHITELIST_SPENDER.some(
    item =>
      isSameAddress(item.address, address) &&
      item.chain.toLowerCase() === chain.toLowerCase(),
  );
};
const cacheMap = new Map<string, boolean>();
export const useIsContractBySymbol = () => {
  return useCallback(async (address: string, serverId?: string) => {
    const key = `${address.toLowerCase()}-${serverId}`;
    if (cacheMap.has(key)) {
      return cacheMap.get(key);
    }
    try {
      // symbol call
      if (!serverId) {
        return false;
      }
      if (!isValidAddress(address)) {
        return false;
      }
      const data = '0x95d89b41';
      const ret = await rpcQueue.add(() =>
        requestETHRpc<string>(
          {
            method: 'eth_call',
            params: [
              {
                to: address,
                data,
              },
              'latest',
            ],
          },
          serverId,
        ),
      );

      const result = !!ret && ret !== '0x' && ret !== '0x0';
      cacheMap.set(key, result);
      return result;
    } catch (e) {
      return false;
    }
  }, []);
};

export const getMethodDesc = (fncName: string) => {
  if (fncName.trim().startsWith('function ')) {
    return fncName;
  }
  const normalizedName = fncName.trim();
  // 接口可能返回 `foo(uint256)` 或 `foo(uint256)()` 两种形式，
  // 统一只保留第一段完整签名。
  const [signature] = normalizedName.split(')(');
  if (!signature.includes('(') || signature.endsWith(')')) {
    return `function ${signature}`;
  }
  return `function ${signature})`;
};

export const parseActionAbi = (func: string) => {
  const normalizedFunc = getMethodDesc(func);
  return parseAbiItem(normalizedFunc) as AbiFunction;
};

export const buildActionCalldata = (func: string, strParams?: string[]) => {
  const abi = parseActionAbi(func);
  const calldata = encodeFunctionData({
    abi: [abi],
    functionName: abi.name,
    args: strParams as any[],
  });
  return { abi, calldata };
};

const getPortfolioPositionId = (item: PortfolioItem) =>
  `${item.pool?.id || ''}${item.position_index || ''}`;

export const findTypedWithdrawAction = (
  actions: WithdrawAction[] | undefined,
  type: 'withdraw' | 'claim',
) =>
  actions?.find(
    item =>
      item.type === type || (type === 'withdraw' && item.type === 'queue'),
  );

export const useDappActionRequest = (
  portfolio: PortfolioItem,
  currentAccount: Account | undefined,
  buildTxs: (action: WithdrawAction) => Promise<Tx[]>,
) => {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  const run = async (
    type: 'withdraw' | 'claim',
    submit: (txs: Tx[], actionType: WithdrawAction['type']) => Promise<void>,
  ) => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      const protocolId = portfolio.pool?.project_id;
      const positionId = getPortfolioPositionId(portfolio);
      if (!protocolId || !portfolio.pool?.id || !currentAccount?.address) {
        throw new Error('Position unavailable');
      }
      const res = await openapi.getProtocol({
        addr: currentAccount.address,
        id: protocolId,
      });
      // DisplayedProject keeps the last portfolio when ids collide.
      const freshPortfolio = findLast(
        res?.portfolio_item_list,
        item => getPortfolioPositionId(item) === positionId,
      );
      const freshAction = findTypedWithdrawAction(
        freshPortfolio?.withdraw_actions,
        type,
      );
      if (!freshAction || freshPortfolio?.proxy_detail?.proxy_contract_id) {
        throw new Error('Action unavailable');
      }
      await submit(await buildTxs(freshAction), freshAction.type);
    } catch (error) {
      console.error('Dapp action failed', error);
      toast.error('Failed to prepare transaction');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return { pending, run };
};

export const useDappAction = (
  data: WithdrawAction | undefined,
  chain?: string,
  currentAccount?: Account,
) => {
  const [valid, setValid] = useState(false);
  const isErc20Contract = useIsContractBySymbol();

  const chainInfo = useMemo(() => {
    return findChain({
      serverId: chain,
    });
  }, [chain]);

  const validate = useCallback(
    async (source: WithdrawAction, abi: AbiFunction) => {
      if (
        !chain ||
        (source.need_approve?.to &&
          !isWhitelistSpender(source.need_approve.to, chain)) ||
        isBlacklistMethodName(abi.name)
      ) {
        return false;
      }
      const addresses =
        source.str_params?.filter(
          (item, index) => !!item && abi.inputs[index]?.type === 'address',
        ) || [];
      const results = await Promise.all(
        addresses.map(async addr => {
          if (
            currentAccount?.address &&
            isSameAddress(currentAccount.address, addr)
          ) {
            return true;
          }
          if (isWhitelistAddress(addr)) {
            return true;
          }
          return isErc20Contract(addr, chain);
        }),
      );
      return results.every(Boolean);
    },
    [chain, currentAccount?.address, isErc20Contract],
  );

  useEffect(() => {
    if (!data || !chain) {
      setValid(false);
      return;
    }

    let isMounted = true;
    const run = async () => {
      try {
        const { abi } = buildActionCalldata(data.func, data.str_params);
        const passed = await validate(data, abi);
        if (isMounted) {
          setValid(passed);
        }
      } catch (error) {
        // ignore error and hide actions
        if (isMounted) {
          setValid(false);
        }
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [chain, data, validate]);

  const buildApproveTxs = useCallback(
    async (source: WithdrawAction): Promise<Tx[]> => {
      const resTxs: Tx[] = [];
      if (
        !currentAccount?.address ||
        !chainInfo?.id ||
        !source?.need_approve?.to ||
        !source?.need_approve?.token_id ||
        !source?.need_approve?.str_raw_amount
      ) {
        return [];
      }

      let tokenApproved = false;
      let allowance = '0';
      if (source?.need_approve.to === chainInfo?.nativeTokenAddress) {
        tokenApproved = true;
      } else {
        try {
          allowance = await getERC20Allowance(
            chainInfo.serverId,
            source?.need_approve?.token_id,
            source?.need_approve?.to,
            currentAccount.address,
            currentAccount,
          );
          tokenApproved = new BigNumber(allowance).gte(
            new BigNumber(source.need_approve.str_raw_amount || '0'),
          );
        } catch (error) {
          // ignore error, default to not approved
        }
      }
      let shouldTwoStepApprove = false;
      if (
        chainInfo?.enum === CHAINS_ENUM.ETH &&
        isSameAddress(source?.need_approve?.to, ETH_USDT_CONTRACT) &&
        Number(allowance) !== 0 &&
        !tokenApproved
      ) {
        shouldTwoStepApprove = true;
      }
      if (shouldTwoStepApprove) {
        const res = await approveToken({
          chainServerId: chainInfo.serverId,
          id: source?.need_approve?.token_id,
          spender: source?.need_approve?.to,
          amount: 0,
          account: currentAccount,
          isBuild: true,
        });
        resTxs.push(res.params[0]);
      }
      if (!tokenApproved) {
        const res = await approveToken({
          chainServerId: chainInfo.serverId,
          id: source?.need_approve?.token_id,
          spender: source?.need_approve?.to,
          amount: source?.need_approve?.str_raw_amount || '0',
          account: currentAccount,
          isBuild: true,
        });
        resTxs.push(res.params[0]);
      }

      return resTxs;
    },
    [
      currentAccount,
      chainInfo?.id,
      chainInfo?.nativeTokenAddress,
      chainInfo?.enum,
      chainInfo?.serverId,
    ],
  );

  const action = useCallback(
    async (source: WithdrawAction): Promise<Tx[]> => {
      if (!source || !chain || !currentAccount?.address || !chainInfo?.id) {
        throw new Error('Action unavailable');
      }
      const { abi, calldata } = buildActionCalldata(
        source.func,
        source.str_params,
      );
      if (!(await validate(source, abi))) {
        throw new Error('Invalid action');
      }
      const tx = {
        chainId: chainInfo.id,
        from: currentAccount.address,
        to: source.contract_id,
        value: '0x0',
        data: calldata,
      } as Tx;
      const approveTxs = await buildApproveTxs(source);
      return [...approveTxs, tx];
    },
    [chain, currentAccount?.address, chainInfo?.id, buildApproveTxs, validate],
  );

  return {
    valid,
    action,
  };
};
