import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  DELETE_AGENT_EMPTY_ADDRESS,
  HYPE_EVM_BRIDGE_ADDRESS,
  HYPE_SEND_ASSET_TOKEN,
  HYPE_SEND_ASSET_TOKEN_MAP,
  PERPS_AGENT_NAME,
  PERPS_BUILD_FEE,
  PERPS_BUILD_FEE_RECEIVE_ADDRESS,
  PERPS_REFERENCE_CODE,
} from '@/constant/perps';
import { apisKeyring } from '@/core/apis/keyring';
import { sendRequest } from '@/core/apis/sendRequest';
import type { Account } from '@/core/startupServices/preference';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { formatSpotState } from '@/utils/perps';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useMemo, useRef } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { miniSignTypedData } from '../useMiniSignTypedData';
import type { PositionAndOpenOrder } from './usePerpsStore';
import {
  AccountSummary,
  apisPerpsStore,
  getClearinghouseStateByMap,
  perpsStore,
  usePerpsStore,
  fetchUserAbstraction,
  subscribeToUserData,
} from './usePerpsStore';
import * as Sentry from '@sentry/react-native';
import { minBy, uniqBy } from 'lodash';
import { showToast } from './showToast';
import { usePerpsPopupState } from '@/screens/Perps/hooks/usePerpsPopupState';
import { useTranslation } from 'react-i18next';
import { sleep } from '@/utils/async';
import { useShallow } from 'zustand/react/shallow';
import { usePerpsAccount } from './usePerpsAccount';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import { isUserCancelledSignature } from './perpsActionError';
import { useIsFocused } from '@react-navigation/native';
import { useEnsurePerpsRuntime } from './runtime/useEnsurePerpsRuntime';
import { executePerpsWithdraw } from './funding/perpsWithdraw';
import { isSamePerpsFundingAccount } from './funding/accountGuard';
import { ensurePerpsActionApproval } from './actions/perpsActionApproval';
import { setPerpsAgentUnifiedAccount } from './actions/setAgentUnifiedAccount';
import { executeEnablePerpsUnifiedAccount } from './actions/enableUnifiedAccount';

type SignActionType = 'approveAgent' | 'approveBuilderFee';

interface SignAction {
  action: any;
  type: SignActionType;
  signature: string;
}

export const usePerpsState = (
  options: { legacyRuntimeContinuationEnabled?: boolean } = {},
) => {
  const [popupSate, setPopupState] = usePerpsPopupState();
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const deleteAgentCbRef = useRef<(() => Promise<void>) | null>(null);
  const {
    setApproveSignatures,
    setLocalLoadingHistory,
    setUserAccountHistory,
    setUserFills,
    addUserFills,
    setPerpFee,
    setMarketData,
    setAccountNeedApproveAgent,
    setAccountNeedApproveBuilderFee,
    setInitialized,

    // Effects
    loginPerpsAccount,
    fetchClearinghouseState,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
  } = usePerpsStore();

  const perpsState = perpsStore(
    useShallow(s => ({
      currentPerpsAccount: s.currentPerpsAccount,
      accountNeedApproveAgent: s.accountNeedApproveAgent,
      accountNeedApproveBuilderFee: s.accountNeedApproveBuilderFee,
      isInitialized: s.isInitialized,
      isLogin: s.isLogin,
      hasPermission: s.hasPermission,
      perpFee: s.perpFee,
      userFills: s.userFills,
      userAccountHistory: s.userAccountHistory,
      localLoadingHistory: s.localLoadingHistory,
      favoriteMarkets: s.favoriteMarkets,
      openOrders: s.openOrders,
      currentClearinghouseState: s.currentClearinghouseState,
    })),
  );
  const {
    currentPerpsAccount,
    accountNeedApproveAgent,
    accountNeedApproveBuilderFee,
  } = perpsState;

  const handleDeleteAgent = useMemoizedFn(async () => {
    if (deleteAgentCbRef.current) {
      try {
        await deleteAgentCbRef.current();
        showToast(t('page.perps.deleteAgentSuccess'), 'success');
      } catch (error) {
        showToast((error as any).message || 'Delete agent failed', 'error');
      }
      deleteAgentCbRef.current = null;
    }
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
          const result = await miniSignTypedData({
            txs: signActions.map(item => {
              return {
                data: item.action,
                from: account.address,
                version: 'V4',
              };
            }),
            account,
          });
          result.forEach((item, idx) => {
            signActions[idx].signature = item.txHash;
          });
        } catch (error) {
          throw 'Canceled';
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

  const checkExtraAgent = useMemoizedFn(
    async (
      account: Account,
      agentAddress: string,
      opts?: { skipDeletePopup?: boolean },
    ) => {
      // self-sign: master signs its own orders, there is no agent to expire.
      if (
        apisPerps.isSelfSignPerpsAccount(account.type) ||
        account.type === KEYRING_CLASS.WATCH
      ) {
        return { isExpired: false };
      }
      const sdk = apisPerps.getPerpsSDK();
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
          if (!opts?.skipDeletePopup) {
            deleteAgentCbRef.current = async () => {
              const deleteItem = minBy(extraAgents, agent => agent.validUntil);
              if (deleteItem) {
                apisPerps.initPerpsAgentAccount(
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
                  signature: signActions[0]?.signature || '',
                });
              }
            };
            // setDeleteAgentModalVisible?.(true);
            setPopupState(prev => ({
              ...prev,
              isShowDeleteAgentPopup: true,
            }));
          }
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

  const checkBuilderFee = useMemoizedFn(async address => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.info.getMaxBuilderFee(
        PERPS_BUILD_FEE_RECEIVE_ADDRESS,
      );
      if (!res) {
        setAccountNeedApproveBuilderFee(true);
      }
    } catch (error) {
      console.error('Failed to set builder fee:', error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        { extra: { scene: 'PERPS set builder fee error', address } },
      );
    }
  });

  const checkSelfSignBuilderFee = useMemoizedFn(async () => {
    try {
      const maxFee = await apisPerps
        .getPerpsSDK()
        .info.getMaxBuilderFee(PERPS_BUILD_FEE_RECEIVE_ADDRESS);
      setAccountNeedApproveAgent(false);
      setAccountNeedApproveBuilderFee(!maxFee);
    } catch (e) {
      // best-effort; keep current flags
    }
  });

  const handleSafeSetReference = useCallback(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.exchange?.setReferrer(PERPS_REFERENCE_CODE);
    } catch (e) {
      // console.error('Failed to set reference:', e);
    }
  }, []);

  const handleSafeSetDexAbstraction = useCallback(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.exchange?.agentEnableDexAbstraction();
      console.log('handleSafeSetDexAbstraction res', res);
    } catch (e) {
      console.log('Failed to handleSafeSetDexAbstraction:', e);
    }
  }, []);

  const handleSafeSetUnifiedAccount = useCallback(
    async (account: Account) => {
      try {
        const sdk = apisPerps.getPerpsSDK();
        await setPerpsAgentUnifiedAccount(sdk.exchange);
      } catch (e) {
        // silent: this is a best-effort post-approve sync
        void handleSafeSetDexAbstraction();
      } finally {
        // need fetch setAbstraction
        setTimeout(() => {
          void fetchUserAbstraction(account).catch(() => undefined);
        }, 100);
      }
    },
    [handleSafeSetDexAbstraction],
  );

  const handleDirectApprove = useCallback(
    async (signActions: SignAction[], account: Account): Promise<void> => {
      const sdk = apisPerps.getPerpsSDK();

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
            return res;
          }
        }),
      );

      // wait 100ms for backend to process approve, then setUnifiedAccount
      await sleep(100);
      void handleSafeSetUnifiedAccount(account);
      setTimeout(() => {
        handleSafeSetReference();
      }, 100);
    },
    [handleSafeSetReference, handleSafeSetUnifiedAccount],
  );

  const fetchApproveStatus = useMemoizedFn(
    async (
      account: Account,
      agentAddress: string,
      opts?: { skipDeletePopup?: boolean },
    ) => {
      const sdk = apisPerps.getPerpsSDK();
      const [checkResult, maxFee] = await Promise.all([
        checkExtraAgent(account, agentAddress, opts),
        sdk.info.getMaxBuilderFee(
          PERPS_BUILD_FEE_RECEIVE_ADDRESS,
          account.address,
        ),
      ]);
      return { ...checkResult, maxFee };
    },
  );

  const checkAccountApproveStatus = useCallback(
    async (account: Account, agentAddress: string) => {
      try {
        const { needDelete, isExpired, maxFee } = await fetchApproveStatus(
          account,
          agentAddress,
          { skipDeletePopup: true },
        );
        if (needDelete) {
          setAccountNeedApproveAgent(true);
          !maxFee && setAccountNeedApproveBuilderFee(true);
          return;
        }

        if (isExpired) {
          setAccountNeedApproveAgent(true);
        }

        if (!maxFee) {
          setAccountNeedApproveBuilderFee(true);
        }
      } catch (e) {
        setAccountNeedApproveAgent(true);
        setAccountNeedApproveBuilderFee(true);
        Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
          extra: {
            scene: 'checkAccountApproveStatus failed',
            address: account.address,
            accountType: account.type,
            agentAddress,
          },
        });
      }
    },
    [
      setAccountNeedApproveAgent,
      setAccountNeedApproveBuilderFee,
      fetchApproveStatus,
    ],
  );

  const ensureLoginApproveSign = useCallback(
    async (account: Account, agentAddress: string) => {
      try {
        const sdk = apisPerps.getPerpsSDK();

        const signActions: SignAction[] = [];

        const { needDelete, isExpired, maxFee } = await fetchApproveStatus(
          account,
          agentAddress,
        );
        if (needDelete) {
          // 需要删除agent，且重新approve agent和builder fee
          setAccountNeedApproveAgent(true);
          !maxFee && setAccountNeedApproveBuilderFee(true);
          return;
        }

        if (isExpired) {
          const { agentAddress: newAgentAddress, vault } =
            await apisPerps.createPerpsAgentWallet(account.address);
          sdk.initOrUpdateAgent(vault, newAgentAddress, PERPS_AGENT_NAME);
          signActions.push({
            action: sdk.exchange?.prepareApproveAgent(),
            type: 'approveAgent',
            signature: '',
          });
        }

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

        if (signActions.length === 0) {
          setAccountNeedApproveAgent(false);
          setAccountNeedApproveBuilderFee(false);
          void handleSafeSetUnifiedAccount(account);
          return;
        }

        if (
          account.type === KEYRING_CLASS.PRIVATE_KEY ||
          account.type === KEYRING_CLASS.MNEMONIC
        ) {
          for (const actionObj of signActions) {
            let signature = '';

            signature = await apisKeyring.signTypedData(
              account.type,
              account.address,
              actionObj.action,
              { version: 'V4' },
            );
            actionObj.signature = signature;
          }
          await handleDirectApprove(signActions, account);
          setAccountNeedApproveAgent(false);
          setAccountNeedApproveBuilderFee(false);
        } else {
          signActions.forEach(item => {
            if (item.type === 'approveAgent') {
              setAccountNeedApproveAgent(true);
            } else if (item.type === 'approveBuilderFee') {
              setAccountNeedApproveBuilderFee(true);
            }
          });
        }
      } catch (e) {
        setAccountNeedApproveAgent(true);
        setAccountNeedApproveBuilderFee(true);
        Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
          extra: {
            scene: 'ensure login approve sign failed',
            address: account.address,
            accountType: account.type,
            agentAddress,
          },
        });
      }
    },
    [
      handleDirectApprove,
      setAccountNeedApproveAgent,
      setAccountNeedApproveBuilderFee,
      fetchApproveStatus,
      handleSafeSetUnifiedAccount,
    ],
  );

  const legacyRuntimeContinuation = useMemo(
    () => ({
      selfSign: checkSelfSignBuilderFee,
      lockedAgent: (agentAddress: string) => {
        if (currentPerpsAccount) {
          return checkAccountApproveStatus(currentPerpsAccount, agentAddress);
        }
      },
      unlockedAgent: (agentAddress: string) => {
        if (currentPerpsAccount) {
          return ensureLoginApproveSign(currentPerpsAccount, agentAddress);
        }
      },
    }),
    [
      checkAccountApproveStatus,
      checkSelfSignBuilderFee,
      currentPerpsAccount,
      ensureLoginApproveSign,
    ],
  );

  useEnsurePerpsRuntime({
    legacyContinuation: legacyRuntimeContinuation,
    legacyContinuationEnabled:
      options.legacyRuntimeContinuationEnabled ?? isFocused,
  });

  const handleActionApproveStatus = useCallback(
    async (options?: { isHideToast?: boolean }) => {
      try {
        if (!currentPerpsAccount) {
          throw new Error('No currentPerpsAccount');
        }
        await ensurePerpsActionApproval(currentPerpsAccount);
      } catch (error) {
        console.error('Failed to handle action approve status:', error);
        // todo fixme maybe no need show toast in prod
        if (!options?.isHideToast) {
          showToast((error as any)?.message || String(error), 'error');
        }
        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          {
            extra: {
              scene: 'Failed to handle action approve status',
              address: currentPerpsAccount?.address,
              accountType: currentPerpsAccount?.type,
            },
          },
        );
        throw error;
      }
    },
    [currentPerpsAccount],
  );

  const handleSetLaterApproveStatus = useCallback(
    (signActions: SignAction[]) => {
      signActions.forEach(action => {
        if (action.type === 'approveAgent') {
          setAccountNeedApproveAgent(true);
        } else if (action.type === 'approveBuilderFee') {
          setAccountNeedApproveBuilderFee(true);
        }
      });
    },
    [setAccountNeedApproveAgent, setAccountNeedApproveBuilderFee],
  );

  const handleLoginWithSignApprove = useMemoizedFn(async (account: Account) => {
    const { agentAddress, vault } = await apisPerps.createPerpsAgentWallet(
      account.address,
    );
    const sdk = apisPerps.getPerpsSDK();
    apisPerps.initPerpsAgentAccount(account.address, vault, agentAddress);

    const signActions = await prepareSignActions();
    console.log('signActions', signActions);

    if (
      account.type === KEYRING_CLASS.PRIVATE_KEY ||
      account.type === KEYRING_CLASS.MNEMONIC
    ) {
      await executeSignatures(signActions, account);

      let isNeedDepositBeforeApprove = true;
      const info = getClearinghouseStateByMap(account.address);
      const accountValue = info?.marginSummary.accountValue;
      if (Number(accountValue) > 0) {
        isNeedDepositBeforeApprove = false;
      } else {
        const { role } = await sdk.info.getUserRole();
        isNeedDepositBeforeApprove = role === 'missing';
      }

      if (isNeedDepositBeforeApprove) {
        handleSetLaterApproveStatus(signActions);
      } else {
        await handleDirectApprove(signActions, account);
        setAccountNeedApproveAgent(false);
        setAccountNeedApproveBuilderFee(false);
      }
    } else {
      let needApproveAgent = false;
      let needApproveBuilderFee = false;
      signActions.forEach(item => {
        if (item.type === 'approveAgent') {
          needApproveAgent = true;
        } else if (item.type === 'approveBuilderFee') {
          needApproveBuilderFee = true;
        }
      });
      setAccountNeedApproveAgent(needApproveAgent);
      setAccountNeedApproveBuilderFee(needApproveBuilderFee);
    }

    await loginPerpsAccount(account);
  });

  const login = useMemoizedFn(async (account: Account) => {
    try {
      if (!(await ensureWalletUnlockedForAction())) {
        return false;
      }

      // self-sign (pk/mnemonic): master is its own signer — no agent, no
      // approveAgent. login is a user-initiated, already-unlocked entry, so
      // silently approve the builder fee here if it isn't yet (self-sign signs
      // locally via keyring → no popup; handleDirectApprove also sets the
      // unified account). Non-fatal: flag it for later if the approve fails.
      if (apisPerps.isSelfSignPerpsAccount(account.type)) {
        await apisPerps.applyPerpsSigner(account);
        await loginPerpsAccount(account);
        setAccountNeedApproveAgent(false);
        const selfSignSdk = apisPerps.getPerpsSDK();
        try {
          const maxFee = await selfSignSdk.info.getMaxBuilderFee(
            PERPS_BUILD_FEE_RECEIVE_ADDRESS,
            account.address,
          );
          if (maxFee) {
            setAccountNeedApproveBuilderFee(false);
          } else {
            const signActions: SignAction[] = [
              {
                action: selfSignSdk.exchange?.prepareApproveBuilderFee({
                  builder: PERPS_BUILD_FEE_RECEIVE_ADDRESS,
                }),
                type: 'approveBuilderFee',
                signature: '',
              },
            ];
            await executeSignatures(signActions, account);
            await handleDirectApprove(signActions, account);
            setAccountNeedApproveBuilderFee(false);
          }
        } catch (e) {
          setAccountNeedApproveBuilderFee(true);
        }
        return true;
      }

      const res = await apisPerps.getPerpsAgentWallet(account.address);
      const agentAddress = res?.preference?.agentAddress || '';
      const { isExpired, needDelete } = await checkExtraAgent(
        account,
        agentAddress,
      );
      if (needDelete) {
        // 先不登录，防止hl服务状态不同步
        setAccountNeedApproveAgent(true);
        setAccountNeedApproveBuilderFee(true);
        return false;
      }

      if (res) {
        if (!isExpired) {
          apisPerps.initPerpsAgentAccount(
            account.address,
            res.vault,
            res.preference.agentAddress,
          );
          // 未到过期时间无需签名直接登录即可
          await loginPerpsAccount(account);
          setAccountNeedApproveAgent(false);
          setAccountNeedApproveBuilderFee(false);
          checkBuilderFee(account.address);
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
      showToast(error.message || 'Login failed', 'error');
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          extra: {
            scene: 'Failed to login Perps account',
            address: account.address,
            accountType: account.type,
          },
        },
      );
    }
  });

  const logout = useMemoizedFn((address: string) => {
    apisPerpsStore.logout();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
    deleteAgentCbRef.current = null;
  });

  const handleWithdraw = useMemoizedFn(
    async (
      amount: number | string,
      isHypeWithdraw = false,
      isUnifiedAccount = false,
      targetAsset: keyof typeof HYPE_SEND_ASSET_TOKEN_MAP = 'USDC',
    ): Promise<boolean> => {
      return executePerpsWithdraw({
        account: currentPerpsAccount,
        amount,
        isAccountCurrent: expectedAccount => {
          const activeAccount = perpsStore.getState().currentPerpsAccount;
          return isSamePerpsFundingAccount(activeAccount, expectedAccount);
        },
        isHypeWithdraw,
        isSpotCollateralMode: isUnifiedAccount,
        targetAsset,
        setLocalLoadingHistory,
      });
    },
  );

  const allDexsPositions = useMemo(() => {
    const res = perpsState.currentClearinghouseState?.assetPositions || [];
    return res;
  }, [perpsState.currentClearinghouseState]);

  const positionAndOpenOrders: PositionAndOpenOrder[] = useMemo(() => {
    return allDexsPositions.map(position => ({
      ...position,
      openOrders: perpsState.openOrders.filter(
        item => item.coin === position.position.coin,
      ),
    }));
  }, [allDexsPositions, perpsState.openOrders]);

  const handleEnableUnifiedAccount = useMemoizedFn(async () => {
    const account = currentPerpsAccount;
    if (!account) {
      console.error('no currentPerpsAccount');
      return false;
    }
    try {
      await executeEnablePerpsUnifiedAccount(account);
      showToast('Unified Account enabled', 'success');
      return true;
    } catch (error: any) {
      if (isUserCancelledSignature(error)) {
        return false;
      }
      console.error('enableUnifiedAccount error', error);
      showToast(error?.message || 'Failed to enable Unified Account', 'error');
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          extra: {
            title: 'PERPS enableUnifiedAccount error',
            rawError: error?.message ?? error,
          },
        },
      );
      return false;
    }
  });

  return {
    // State
    positionAndOpenOrders,
    currentPerpsAccount: perpsState.currentPerpsAccount,
    isLogin: perpsState.isLogin,
    isInitialized: perpsState.isInitialized,
    userFills: perpsState.userFills,
    hasPermission: perpsState.hasPermission,
    perpFee: perpsState.perpFee,
    userAccountHistory: perpsState.userAccountHistory,
    localLoadingHistory: perpsState.localLoadingHistory,
    accountNeedApproveAgent: perpsState.accountNeedApproveAgent,
    accountNeedApproveBuilderFee: perpsState.accountNeedApproveBuilderFee,
    favoriteMarkets: perpsState.favoriteMarkets,
    // Actions
    login,
    logout,
    setInitialized,
    handleWithdraw,
    refreshData: refreshData,
    handleDeleteAgent,
    fetchMarketData,
    fetchClearinghouseState,
    handleActionApproveStatus,

    handleSafeSetReference,
    handleSafeSetUnifiedAccount,
    handleEnableUnifiedAccount,
  };
};
