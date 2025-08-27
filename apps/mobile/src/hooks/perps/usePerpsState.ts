import { apisPerps } from './../../core/apis/perps';
import { useCallback, useEffect, useMemo } from 'react';
import {
  PERPS_AGENT_NAME,
  PERPS_BUILD_FEE_RECEIVE_ADDRESS,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { useInterval, useMemoizedFn } from 'ahooks';
import { useAccounts, useFallbackAccount } from '../account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { Account } from '@/core/services/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { apisKeyring } from '@/core/apis/keyring';
import { sendRequest } from '@/core/apis/sendRequest';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { usePerpsStore } from './usePerpsStore';
// import { useCurrentAccount } from '@/ui/hooks/backgroundState/useAccount';
// import { message } from 'antd';
type SignActionType = 'approveAgent' | 'approveBuilderFee';

interface SignAction {
  action: any;
  type: SignActionType;
  signature: string;
}

export const usePerpsState = () => {
  const {
    state: perpsState,
    setApproveSignatures,
    setLocalLoadingHistory,
    setUserAccountHistory,
    setUserFills,
    addUserFills,
    updatePositionsWithClearinghouse,
    updateUserAccountHistory,
    setPerpFee,
    setMarketData,
    setPositionAndOpenOrders,
    setAccountSummary,
    // setCurrentPerpsAccount,
    setInitialized,
    // setApproveSignatures,
    resetState,

    // Effects
    saveApproveSignatures,
    fetchPositionAndOpenOrders,
    loginPerpsAccount,
    fetchClearinghouseState,
    fetchUserNonFundingLedgerUpdates,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
    subscribeToUserData,
    startPolling,
    stopPolling,
    unsubscribeAll,
    logout: _logout,
  } = usePerpsStore();
  const { isInitialized, currentPerpsAccount, isLogin, positionAndOpenOrders } =
    perpsState;
  // const wallet = useWallet();
  const { accounts: accountsList } = useAccounts({
    disableAutoFetch: true,
  });

  const checkIsExtraAgentIsExpired = useMemoizedFn(
    async (masterAddress: string, agentAddress: string) => {
      const sdk = apisPerps.getPerpsSDK();
      const extraAgents = await sdk.info.extraAgents(masterAddress);
      const item = extraAgents.find(agent =>
        isSameAddress(agent.address, agentAddress),
      );
      if (!item) {
        return true;
      }
      const expiredAt = item?.validUntil;
      const oneDayAfter = Date.now() + 24 * 60 * 60 * 1000;
      const isExpired = expiredAt ? expiredAt < oneDayAfter : true;
      return isExpired;
    },
  );

  // return bool if can use approveSignatures
  const restoreApproveSignatures = useMemoizedFn(
    async (payload: { address: string }) => {
      const approveSignatures = await apisPerps.getSendApproveAfterDeposit(
        payload.address,
      );

      console.log('getSendApproveAfterDeposit res', approveSignatures);
      if (approveSignatures?.length) {
        const item = approveSignatures[0];
        const expiredTime = item.nonce + 1000 * 60 * 60 * 24;
        const now = Date.now();
        if (expiredTime > now) {
          setApproveSignatures(approveSignatures);
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    },
  );

  const checkIsNeedAutoLoginOut = useMemoizedFn(
    async (masterAddress: string, agentAddress: string) => {
      const sdk = apisPerps.getPerpsSDK();
      const extraAgents = await sdk.info.extraAgents(masterAddress);
      const item = extraAgents.find(agent =>
        isSameAddress(agent.address, agentAddress),
      );
      if (!item) {
        const res = await restoreApproveSignatures({
          address: masterAddress,
        });
        if (!res) {
          console.warn(
            'masterAddress isExpired, no restore approve signature, logout',
          );
          logout(masterAddress);
        }
      } else {
        const expiredAt = item?.validUntil;
        const oneDayAfter = Date.now() + 24 * 60 * 60 * 1000;
        const isExpired = expiredAt ? expiredAt < oneDayAfter : true;
        if (isExpired) {
          console.warn('masterAddress isExpired, update agent, auto login out');
          // need to update agent for send new approve agent api avoid error
          apisPerps.createPerpsAgentWallet(masterAddress);
          logout(masterAddress);
        }
      }
    },
  );

  useEffect(() => {
    if (isInitialized && isLogin) {
      // 已经初始化完成 且 已经登录
      fetchClearinghouseState();
      return;
    }

    if (isInitialized) {
      return;
    }

    const initIsLogin = async () => {
      try {
        const noLoginAction = () => {
          apisPerps.setPerpsCurrentAccount(null);
          fetchMarketData();
          setInitialized(true);
        };

        const currentAccount = await apisPerps.getPerpsCurrentAccount();
        console.log(' init currentAccount', currentAccount);
        if (!currentAccount || !currentAccount.address) {
          // 如果没有登录状态，则只获取市场数据即可
          noLoginAction();
          return false;
        }

        const targetTypeAccount = accountsList.find(
          acc =>
            isSameAddress(acc.address, currentAccount.address) &&
            acc.type === currentAccount.type,
        );

        if (!targetTypeAccount) {
          // 地址列表没找到
          noLoginAction();
          return false;
        }

        const res = await apisPerps.getPerpsAgentWallet(currentAccount.address);
        if (!res) {
          // 没有找到store对应的 agent wallet
          noLoginAction();
          return false;
        }

        const sdk = apisPerps.getPerpsSDK();
        // 开始恢复登录态
        sdk.initAccount(
          currentAccount.address,
          res.vault,
          res.preference.agentAddress,
          PERPS_AGENT_NAME,
        );

        fetchMarketData();

        await loginPerpsAccount(currentAccount);

        checkIsNeedAutoLoginOut(
          currentAccount.address,
          res.preference.agentAddress,
        );

        setTimeout(() => {
          // is not very matter, just wait for the other query api
          fetchPerpFee();
        }, 2000);

        setInitialized(true);
        return true;
      } catch (error) {
        console.error('Failed to init Perps state:', error);
      }
    };

    initIsLogin();
  }, [
    accountsList,
    checkIsNeedAutoLoginOut,
    fetchClearinghouseState,
    fetchMarketData,
    fetchPerpFee,
    isInitialized,
    isLogin,
    loginPerpsAccount,
    setInitialized,
  ]);

  const prepareSignActions = useMemoizedFn(async (): Promise<SignAction[]> => {
    const sdk = apisPerps.getPerpsSDK();

    const signActions: SignAction[] = [
      {
        action: sdk.exchange?.prepareApproveAgent(),
        type: 'approveAgent',
        signature: '',
      },
    ];

    const maxFee = await sdk.info.getMaxBuilderFee(
      PERPS_BUILD_FEE_RECEIVE_ADDRESS,
    );
    if (!maxFee) {
      const buildAction = sdk.exchange?.prepareApproveBuilderFee({
        builder: PERPS_BUILD_FEE_RECEIVE_ADDRESS,
      });
      signActions.push({
        action: buildAction,
        type: 'approveBuilderFee',
        signature: '',
      });
    }

    return signActions;
  });

  const executeSignatures = useMemoizedFn(
    async (signActions: SignAction[], account: Account): Promise<void> => {
      const isLocalWallet =
        account.type === KEYRING_CLASS.PRIVATE_KEY ||
        account.type === KEYRING_CLASS.MNEMONIC;

      for (const actionObj of signActions) {
        const signature = isLocalWallet
          ? await apisKeyring.signTypedData(
              account.type,
              account.address,
              actionObj.action,
              { version: 'V4' },
            )
          : await sendRequest({
              data: {
                method: 'eth_signTypedDataV4',
                params: [account.address, actionObj.action],
              },
              session: INTERNAL_REQUEST_SESSION,
            });

        actionObj.signature = signature as string;
      }
    },
  );

  const handleSafeSetReference = useCallback(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.exchange?.setReferrer(PERPS_REFERENCE_CODE);
      console.log('setReference res', res);
    } catch (e) {
      console.error('Failed to set reference:', e);
    }
  }, []);

  const handleDirectApprove = useCallback(
    async (signActions: SignAction[]): Promise<void> => {
      const sdk = apisPerps.getPerpsSDK();

      console.log('handleDirectApprove', sdk.exchange);

      const results = await Promise.all(
        signActions.map(async actionObj => {
          const { action, type, signature } = actionObj;

          if (type === 'approveAgent') {
            return sdk.exchange?.sendApproveAgent({
              action: action?.message,
              nonce: action?.nonce || 0,
              signature,
            });
          } else if (type === 'approveBuilderFee') {
            return sdk.exchange?.sendApproveBuilderFee({
              action: action?.message,
              nonce: action?.nonce || 0,
              signature,
            });
          }
        }),
      );

      setTimeout(() => {
        handleSafeSetReference();
      }, 500);
      const [approveAgentRes, approveBuilderFeeRes] = results;
      console.log('sendApproveAgentRes', approveAgentRes);
      console.log('sendApproveBuilderFeeRes', approveBuilderFeeRes);
    },
    [handleSafeSetReference],
  );

  const handleLoginWithSignApprove = useMemoizedFn(async (account: Account) => {
    const { agentAddress, vault } = await apisPerps.createPerpsAgentWallet(
      account.address,
    );
    const sdk = apisPerps.getPerpsSDK();
    sdk.initAccount(account.address, vault, agentAddress, PERPS_AGENT_NAME);

    const signActions = await prepareSignActions();

    await executeSignatures(signActions, account);

    const { role } = await sdk.info.getUserRole();
    const isNeedDepositBeforeApprove = role === 'missing';

    if (isNeedDepositBeforeApprove) {
      // 新地址，需要先deposit后才能 send approve
      const approveSignatures = signActions.map(action => {
        return {
          action: action.action,
          nonce: action.action?.nonce || 0,
          signature: action.signature,
          type: action.type,
        };
      });
      saveApproveSignatures({
        approveSignatures,
        address: account.address,
      });
    } else {
      await handleDirectApprove(signActions);
    }

    await loginPerpsAccount(account);
  });

  const login = useMemoizedFn(async (account: Account) => {
    try {
      // const { privateKey, publicKey } = await getOrCreateAgentWallet(account);
      const sdk = apisPerps.getPerpsSDK();
      const res = await apisPerps.getPerpsAgentWallet(account.address);
      if (res) {
        // 如果存在 agent wallet, 则检查是否过期
        const isExpired = await checkIsExtraAgentIsExpired(
          account.address,
          res.preference.agentAddress,
        );
        if (!isExpired) {
          sdk.initAccount(
            account.address,
            res.vault,
            res.preference.agentAddress,
            PERPS_AGENT_NAME,
          );
          // 未到过期时间无需签名直接登录即可
          await loginPerpsAccount(account);
        } else {
          // 过期或者没sendApprove过，需要创建新的agent，同时签名
          await handleLoginWithSignApprove(account);

          await loginPerpsAccount(account);
        }
      } else {
        // 不存在agent wallet,，需要创建新的，同时签名
        await handleLoginWithSignApprove(account);

        await loginPerpsAccount(account);
      }
      return true;
    } catch (error: any) {
      console.error('Failed to login Perps account:', error);
      // message.error(error.message || 'Login failed');
    }
  });

  const logout = useMemoizedFn((address: string) => {
    _logout();
    apisPerps.destroyPerpsSDK();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
  });

  const setCurrentPerpsAccount = useMemoizedFn((account: Account | null) => {
    setCurrentPerpsAccount(account);
  });

  const handleWithdraw = useMemoizedFn(
    async (amount: number): Promise<boolean> => {
      try {
        console.log('handleWithdraw', amount);
        const sdk = apisPerps.getPerpsSDK();

        if (!currentPerpsAccount) {
          throw new Error('No currentPerpsAccount address');
        }

        if (!sdk.exchange) {
          throw new Error('Hyperliquid no exchange client');
        }

        const action = sdk.exchange.prepareWithdraw({
          amount: amount.toString(),
          destination: currentPerpsAccount.address,
        });
        console.log('withdraw action', action);
        let signature = '';
        if (
          currentPerpsAccount.type === KEYRING_CLASS.PRIVATE_KEY ||
          currentPerpsAccount.type === KEYRING_CLASS.MNEMONIC
        ) {
          signature = await apisKeyring.signTypedData(
            currentPerpsAccount.type,
            currentPerpsAccount.address.toLowerCase(),
            action as any,
            { version: 'V4' },
          );
        } else {
          signature = await sendRequest({
            data: {
              method: 'eth_signTypedDataV4',
              params: [currentPerpsAccount.address, action],
            },
            session: INTERNAL_REQUEST_SESSION,
          });
        }
        console.log('withdraw signature', signature);
        const res = await sdk.exchange.sendWithdraw({
          action: action.message as any,
          nonce: action.nonce || 0,
          signature: signature as string,
        });
        console.log('withdraw res', res);
        fetchClearinghouseState();
        return true;
      } catch (error) {
        console.error('Failed to withdraw:', error);
        // message.error(error.message || 'Withdraw failed');
        return false;
      }
    },
  );

  const homeHistoryList = useMemo(() => {
    const list = [
      ...perpsState.localLoadingHistory,
      ...perpsState.userAccountHistory,
      ...perpsState.userFills,
    ];

    return list.sort((a, b) => b.time - a.time);
  }, [
    perpsState.userAccountHistory,
    perpsState.userFills,
    perpsState.localLoadingHistory,
  ]);

  useEffect(() => {
    if (
      perpsState.accountSummary?.withdrawable &&
      Number(perpsState.accountSummary.withdrawable) > 0 &&
      currentPerpsAccount?.address &&
      perpsState.approveSignatures.length > 0
    ) {
      const directSendApprove = async () => {
        const data = perpsState.approveSignatures;
        setApproveSignatures([]);
        await handleDirectApprove(data);
        apisPerps.setSendApproveAfterDeposit(currentPerpsAccount.address, []);
      };
      directSendApprove();
    }
  }, [
    currentPerpsAccount?.address,
    handleDirectApprove,
    perpsState.accountSummary?.withdrawable,
    perpsState.approveSignatures,
    setApproveSignatures,
  ]);

  return {
    // State
    marketData: perpsState.marketData,
    marketDataMap: perpsState.marketDataMap,
    positionAndOpenOrders: perpsState.positionAndOpenOrders,
    accountSummary: perpsState.accountSummary,
    currentPerpsAccount: perpsState.currentPerpsAccount,
    isLogin: perpsState.isLogin,
    isInitialized: perpsState.isInitialized,
    userFills: perpsState.userFills,
    homeHistoryList,

    // Actions
    login,
    logout,
    setCurrentPerpsAccount,
    handleWithdraw,
    refreshData: refreshData,
  };
};
