import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  DELETE_AGENT_EMPTY_ADDRESS,
  PERPS_AGENT_NAME,
  PERPS_BUILD_FEE,
  PERPS_BUILD_FEE_RECEIVE_ADDRESS,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { apisKeyring } from '@/core/apis/keyring';
import { sendRequest } from '@/core/apis/sendRequest';
import { Account } from '@/core/services/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAccounts } from '../account';
import { apisPerps } from './../../core/apis/perps';
import { useSendMiniSignTypedData } from './../useMiniSignTypedDataApproval';
import { usePerpsStore } from './usePerpsStore';
import * as Sentry from '@sentry/react-native';
import { toast } from '@/components2024/Toast';
import { minBy } from 'lodash';
import { usePerspPopupState } from '@/screens/Perps/hooks/usePerpsPopupState';
import { useTranslation } from 'react-i18next';
type SignActionType = 'approveAgent' | 'approveBuilderFee';

interface SignAction {
  action: any;
  type: SignActionType;
  signature: string;
}

export const usePerpsInitial = () => {
  const { accounts: accountsList } = useAccounts({
    disableAutoFetch: true,
  });

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
    fetchPerpPermission,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
    subscribeToUserData,
    startPolling,
    stopPolling,
    unsubscribeAll,
    logout: _logout,
  } = usePerpsStore();

  const {
    isInitialized,
    currentPerpsAccount,
    isLogin,
    accountSummary,
    positionAndOpenOrders,
  } = perpsState;

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
          // Sentry.captureException(
          //   new Error(
          //     'masterAddress isExpired, no restore approve signature, logout' +
          //       masterAddress,
          //   ),
          // );
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
          // Sentry.captureException(
          //   new Error(
          //     'masterAddress isExpired, update agent, auto login out' +
          //       masterAddress,
          //   ),
          // );
        }
      }
    },
  );

  const safeSetBuilderFee = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    const res = await sdk.info.getMaxBuilderFee(
      PERPS_BUILD_FEE_RECEIVE_ADDRESS,
    );
    if (res) {
      sdk.exchange?.updateBuilder(
        PERPS_BUILD_FEE_RECEIVE_ADDRESS,
        PERPS_BUILD_FEE,
      );
    }
  });

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    const initIsLogin = async () => {
      try {
        const noLoginAction = async () => {
          apisPerps.setPerpsCurrentAccount(null);
          fetchPerpPermission('');
          await fetchMarketData();
          setInitialized(true);
        };

        const currentAccount = await apisPerps.getPerpsCurrentAccount();
        console.log(' init currentAccount', currentAccount);
        if (!currentAccount || !currentAccount.address) {
          // 如果没有登录状态，则只获取市场数据即可
          console.log('noLoginAction no currentAccount');
          await noLoginAction();
          return false;
        }
        const targetTypeAccount = accountsList.find(
          acc =>
            isSameAddress(acc.address, currentAccount.address) &&
            acc.type === currentAccount.type,
        );

        if (!targetTypeAccount) {
          // 地址列表没找到
          console.log('noLoginAction no targetTypeAccount');
          await noLoginAction();
          return false;
        }

        const res = await apisPerps.getPerpsAgentWallet(currentAccount.address);
        if (!res) {
          // 没有找到store对应的 agent wallet
          console.log('noLoginAction no PerpsAgentWallet');
          await noLoginAction();
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
        safeSetBuilderFee();
        await loginPerpsAccount(targetTypeAccount);
        await fetchMarketData();

        checkIsNeedAutoLoginOut(
          currentAccount.address,
          res.preference.agentAddress,
        );

        setInitialized(true);
        return true;
      } catch (error) {
        console.error('Failed to init Perps state:', error);
      }
    };

    initIsLogin();
  }, [
    isInitialized,
    accountsList,
    safeSetBuilderFee,
    loginPerpsAccount,
    fetchMarketData,
    checkIsNeedAutoLoginOut,
    setInitialized,
    fetchPerpPermission,
  ]);

  const logout = useMemoizedFn((address: string) => {
    _logout();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
  });

  const perpsPositionInfo = useMemo(() => {
    if (
      !isLogin ||
      !positionAndOpenOrders ||
      positionAndOpenOrders.length === 0
    ) {
      return {
        pnl: 0,
        show: false,
      };
    }

    const pnl = positionAndOpenOrders.reduce((acc, order) => {
      return acc + Number(order.position.unrealizedPnl);
    }, 0);

    return {
      pnl,
      show: true,
    };
  }, [isLogin, positionAndOpenOrders]);

  return {
    accountSummary,
    positionAndOpenOrders,
    isLogin,
    safeSetBuilderFee,
    perpsPositionInfo,
  };
};

export const usePerpsState = () => {
  const [popupSate, setPopupState] = usePerspPopupState();
  const { t } = useTranslation();
  const deleteAgentCbRef = useRef<(() => Promise<void>) | null>(null);
  const { safeSetBuilderFee } = usePerpsInitial();
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
    fetchPerpPermission,
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

  const sendMiniSignTypedData = useSendMiniSignTypedData();

  const handleDeleteAgent = useMemoizedFn(async () => {
    if (deleteAgentCbRef.current) {
      try {
        await deleteAgentCbRef.current();
        toast.success(t('page.perps.deleteAgentSuccess'));
      } catch (error) {
        toast.error((error as any).message || 'Delete agent failed');
      }
      deleteAgentCbRef.current = null;
    }
  });

  const checkIsExtraAgentIsExpired = useMemoizedFn(
    async (account: Account, agentAddress: string) => {
      const sdk = apisPerps.getPerpsSDK();
      console.log('----------extraAgents', account.address);
      const extraAgents = await sdk.info.extraAgents(account.address);
      const item = extraAgents.find(agent =>
        isSameAddress(agent.address, agentAddress),
      );
      if (!item) {
        const existAgentName = extraAgents.find(
          agent => agent.name === PERPS_AGENT_NAME,
        );
        if (!existAgentName && extraAgents.length >= 3) {
          // 超过3个，需要删除一个
          deleteAgentCbRef.current = async () => {
            const deleteItem = minBy(extraAgents, agent => agent.validUntil);
            if (deleteItem) {
              sdk.initAccount(
                account.address,
                DELETE_AGENT_EMPTY_ADDRESS,
                DELETE_AGENT_EMPTY_ADDRESS,
                deleteItem.name,
              );
              const action = sdk.exchange?.prepareApproveAgent();
              const signActions: SignAction[] = [
                {
                  action,
                  type: 'approveAgent',
                  signature: '',
                },
              ];
              await executeSignatures(signActions, account);
              const res = await sdk.exchange?.sendApproveAgent({
                action: action?.message,
                nonce: action?.nonce || 0,
                signature: signActions[0].signature,
              });
              console.log('deleteAgent res', res);
            }
          };
          // setDeleteAgentModalVisible?.(true);
          setPopupState(prev => ({
            ...prev,
            isShowDeleteAgentPopup: true,
          }));
          return {
            needDelete: true,
            isExpired: true,
          };
        }
        return {
          isExpired: true,
        };
      }

      const expiredAt = item?.validUntil;
      const oneDayAfter = Date.now() + 24 * 60 * 60 * 1000;
      const isExpired = expiredAt ? expiredAt < oneDayAfter : true;
      return {
        isExpired,
      };
    },
  );

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

      const useMiniApprovalSign =
        account.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
        account.type === KEYRING_CLASS.HARDWARE.LEDGER;

      if (useMiniApprovalSign) {
        // await MiniTypedDataApproval in home page
        try {
          const result = await sendMiniSignTypedData({
            txs: signActions.map(item => {
              return {
                data: item.action,
                from: account.address,
                version: 'V4',
              };
            }),
            account,
          });
          console.log('Mini sign result', result);
          result.forEach((item, idx) => {
            signActions[idx].signature = item.txHash;
          });
        } catch (error) {
          console.log('Mini sign rejected or failed:', error);
          throw error || 'Canceled';
        }
      } else {
        for (const actionObj of signActions) {
          let signature = '';

          if (isLocalWallet) {
            signature = await apisKeyring.signTypedData(
              account.type,
              account.address,
              actionObj.action,
              { version: 'V4' },
            );
          } else {
            signature = await sendRequest({
              data: {
                method: 'eth_signTypedDataV4',
                params: [account.address, JSON.stringify(actionObj.action)],
              },
              session: INTERNAL_REQUEST_SESSION,
              account: account,
            });
          }
          actionObj.signature = signature;
        }
      }
    },
  );

  const handleSafeSetReference = useCallback(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.exchange?.setReferrer(PERPS_REFERENCE_CODE);
      console.log('setReference res', res);
    } catch (e) {
      // console.error('Failed to set reference:', e);
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
            const res = await sdk.exchange?.sendApproveBuilderFee({
              action: action?.message,
              nonce: action?.nonce || 0,
              signature: signature || '',
            });
            res &&
              sdk.exchange?.updateBuilder(
                PERPS_BUILD_FEE_RECEIVE_ADDRESS,
                PERPS_BUILD_FEE,
              );
            return res;
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
        const { isExpired, needDelete } = await checkIsExtraAgentIsExpired(
          account,
          res.preference.agentAddress,
        );
        if (needDelete) {
          // 先不登录，防止hl服务状态不同步
          return false;
        }
        if (!isExpired) {
          sdk.initAccount(
            account.address,
            res.vault,
            res.preference.agentAddress,
            PERPS_AGENT_NAME,
          );
          safeSetBuilderFee();
          // 未到过期时间无需签名直接登录即可
          await loginPerpsAccount(account);
        } else {
          // 过期或者没sendApprove过，需要创建新的agent，同时签名
          await handleLoginWithSignApprove(account);
        }
      } else {
        // 不存在agent wallet,，需要创建新的，同时签名
        await handleLoginWithSignApprove(account);
      }
      return true;
    } catch (error: any) {
      console.error('Failed to login Perps account:', error);
      toast.error(error.message || 'Login failed');
      // Sentry.captureException(
      //   new Error(
      //     'PERPS Login failed' +
      //       JSON.stringify({
      //         error,
      //       }),
      //   ),
      // );
    }
  });

  const logout = useMemoizedFn((address: string) => {
    _logout();
    // apisPerps.destroyPerpsSDK();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
  });

  const setCurrentPerpsAccount = useMemoizedFn((account: Account | null) => {
    setCurrentPerpsAccount(account);
  });

  const handleWithdraw = useMemoizedFn(
    async (amount: number | string): Promise<boolean> => {
      try {
        console.log('handleWithdraw', amount);
        const sdk = apisPerps.getPerpsSDK();

        if (!currentPerpsAccount) {
          throw new Error('No currentPerpsAccount address');
        }

        if (!sdk.exchange) {
          throw new Error('Hyperliquid no exchange client');
        }

        const useMiniApprovalSign =
          currentPerpsAccount.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
          currentPerpsAccount.type === KEYRING_CLASS.HARDWARE.LEDGER;

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
        } else if (useMiniApprovalSign) {
          const result = await sendMiniSignTypedData({
            txs: [
              {
                data: action,
                from: currentPerpsAccount.address,
                version: 'V4',
              },
            ],
            account: currentPerpsAccount,
          });
          signature = result[0].txHash;
        } else {
          signature = await sendRequest({
            data: {
              method: 'eth_signTypedDataV4',
              params: [currentPerpsAccount.address, JSON.stringify(action)],
            },
            session: INTERNAL_REQUEST_SESSION,
            account: currentPerpsAccount,
          });
        }
        console.log('withdraw signature', signature);
        const res = await sdk.exchange.sendWithdraw({
          action: action.message as any,
          nonce: action.nonce || 0,
          signature: signature as string,
        });
        console.log('withdraw res', res);
        setLocalLoadingHistory(
          [
            {
              time: Date.now(),
              hash: res.hash || '',
              type: 'withdraw',
              status: 'pending',
              usdValue: (+amount - 1).toString(),
            },
          ],
          false,
        );
        fetchClearinghouseState();
        return true;
      } catch (error: any) {
        console.error('Failed to withdraw:', error);
        toast.error(error.message || 'Withdraw failed');
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
    hasPermission: perpsState.hasPermission,
    homeHistoryList,

    // Actions
    login,
    logout,
    setCurrentPerpsAccount,
    handleWithdraw,
    refreshData: refreshData,
    handleDeleteAgent,
    fetchMarketData,
  };
};
