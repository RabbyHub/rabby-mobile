import { INTERNAL_REQUEST_SESSION } from '@/constant';
import {
  DELETE_AGENT_EMPTY_ADDRESS,
  HYPE_EVM_BRIDGE_ADDRESS,
  HYPE_EVM_BRIDGE_ADDRESS_MAP,
  HYPE_SEND_ASSET_TOKEN,
  HYPE_SEND_ASSET_TOKEN_MAP,
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
import { Abstraction, UserAbstraction } from '@rabby-wallet/hyperliquid-sdk';
import { formatSpotState } from '@/utils/perps';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { miniSignTypedData } from '../useMiniSignTypedData';
import {
  AccountSummary,
  apisPerpsStore,
  getClearinghouseStateByMap,
  perpsStore,
  PositionAndOpenOrder,
  usePerpsStore,
  waitForInitialWsData,
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

import { apisLock } from '@/core/apis';
type SignActionType =
  | 'approveAgent'
  | 'approveBuilderFee'
  | 'userSetAbstraction';

interface SignAction {
  action: any;
  type: SignActionType;
  signature: string;
}

export const usePerpsState = () => {
  const [popupSate, setPopupState] = usePerpsPopupState();
  const { t } = useTranslation();
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
    resetAccountState,

    // Effects
    loginPerpsAccount,
    fetchClearinghouseState,
    fetchPerpPermission,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
    unsubscribeAll,
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
    isInitialized,
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
    async (account: Account, agentAddress: string) => {
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

  // return bool if can use approveSignatures
  const restoreApproveSignatures = useMemoizedFn(
    async (payload: { address: string }) => {
      const approveSignatures = await apisPerps.getSendApproveAfterDeposit(
        payload.address,
      );

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

  const checkBuilderFee = useMemoizedFn(async address => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.info.getMaxBuilderFee(
        PERPS_BUILD_FEE_RECEIVE_ADDRESS,
      );
      if (!res) {
        setAccountNeedApproveBuilderFee(true);
        console.error('Failed to set builder fee');
        Sentry.captureException(
          new Error(
            `PERPS set builder fee error, no max builder fee, address: ${address}`,
          ),
        );
      }
    } catch (error) {
      console.error('Failed to set builder fee:', error);
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

  const handleSafeSetUnifiedAccount = useCallback(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      await sdk.exchange?.agentSetAbstraction(Abstraction.UNIFIED_ACCOUNT);
    } catch (e) {
      // silent: this is a best-effort post-approve sync
      handleSafeSetDexAbstraction();
    } finally {
      // need fetch setAbstraction
      setTimeout(() => {
        fetchUserAbstraction('');
      }, 100);
    }
  }, [handleSafeSetDexAbstraction]);

  const handleDirectApprove = useCallback(
    async (signActions: SignAction[]): Promise<void> => {
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
      handleSafeSetUnifiedAccount();
      setTimeout(() => {
        handleSafeSetReference();
      }, 100);
    },
    [handleSafeSetReference, handleSafeSetUnifiedAccount],
  );

  const ensureLoginApproveSign = useCallback(
    async (account: Account, agentAddress: string) => {
      try {
        const sdk = apisPerps.getPerpsSDK();

        const signActions: SignAction[] = [];

        const [checkResult, maxFee] = await Promise.all([
          checkExtraAgent(account, agentAddress),
          sdk.info.getMaxBuilderFee(PERPS_BUILD_FEE_RECEIVE_ADDRESS),
        ]);
        if (checkResult.needDelete) {
          // 需要删除agent，且重新approve agent和builder fee
          setAccountNeedApproveAgent(true);
          !maxFee && setAccountNeedApproveBuilderFee(true);
          return;
        }

        if (checkResult.isExpired) {
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
          handleSafeSetUnifiedAccount();
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
          await handleDirectApprove(signActions);
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
        Sentry.captureException(
          new Error(
            `ensure login approve sign failed, address: ${account.address} , account type: ${account.type} , agentAddress: ${agentAddress} , error: ${e}`,
          ),
        );
      }
    },
    [
      handleDirectApprove,
      setAccountNeedApproveAgent,
      setAccountNeedApproveBuilderFee,
      checkExtraAgent,
      handleSafeSetUnifiedAccount,
    ],
  );

  const isHandlingApproveStatus = useRef(false);

  const handleActionApproveStatus = useCallback(
    async (options?: { isHideToast?: boolean }) => {
      try {
        if (isHandlingApproveStatus.current) {
          return;
        }
        isHandlingApproveStatus.current = true;

        if (!currentPerpsAccount) {
          throw new Error('No currentPerpsAccount');
        }

        const signActions: SignAction[] = [];
        const sdk = apisPerps.getPerpsSDK();

        const { vault, agentAddress } =
          await apisPerps.getOrCreatePerpsAgentWallet(
            currentPerpsAccount.address,
          );
        sdk.initOrUpdateAgent(vault, agentAddress, PERPS_AGENT_NAME);

        if (accountNeedApproveAgent) {
          signActions.push({
            action: sdk.exchange?.prepareApproveAgent(),
            type: 'approveAgent',
            signature: '',
          });
        }

        if (accountNeedApproveBuilderFee) {
          await sleep(10);
          signActions.push({
            action: sdk.exchange?.prepareApproveBuilderFee({
              builder: PERPS_BUILD_FEE_RECEIVE_ADDRESS,
            }),
            type: 'approveBuilderFee',
            signature: '',
          });
        }

        if (signActions.length === 0) {
          isHandlingApproveStatus.current = false;
          return;
        }

        await executeSignatures(signActions, currentPerpsAccount);

        try {
          await handleDirectApprove(signActions);
        } catch (error) {}
        setAccountNeedApproveAgent(false);
        setAccountNeedApproveBuilderFee(false);
        isHandlingApproveStatus.current = false;
      } catch (error) {
        isHandlingApproveStatus.current = false;
        console.error('Failed to handle action approve status:', error);
        // todo fixme maybe no need show toast in prod
        if (!options?.isHideToast) {
          showToast((error as any)?.message || String(error), 'error');
        }
        Sentry.captureException(
          new Error(
            `Failed to handle action approve status, address: ${currentPerpsAccount?.address} , account type: ${currentPerpsAccount?.type} , error: ${error}`,
          ),
        );
        throw error;
      }
    },
    [
      accountNeedApproveAgent,
      accountNeedApproveBuilderFee,
      currentPerpsAccount,
      executeSignatures,
      handleDirectApprove,
      setAccountNeedApproveAgent,
      setAccountNeedApproveBuilderFee,
    ],
  );

  useEffect(() => {
    if (isInitialized) {
      return;
    }

    const initIsLogin = async () => {
      try {
        const initAccount = perpsState.currentPerpsAccount;
        if (!initAccount) {
          return false;
        }
        if (!apisLock.isUnlocked()) {
          await loginPerpsAccount(initAccount);
          await Promise.all([fetchMarketData(), waitForInitialWsData()]);
          setInitialized(true);
          return false;
        }
        const { vault, agentAddress } =
          await apisPerps.getOrCreatePerpsAgentWallet(initAccount.address);
        const sdk = apisPerps.getPerpsSDK();
        // 开始恢复登录态
        sdk.initAccount(
          initAccount.address,
          vault,
          agentAddress,
          PERPS_AGENT_NAME,
        );
        await loginPerpsAccount(initAccount);

        // checkIsNeedAutoLoginOut(initAccount.address, agentAddress);
        ensureLoginApproveSign(initAccount, agentAddress);
        // Run HTTP meta fetch and WS first-frame wait in parallel.
        // waitForInitialWsData resolves on first push of both
        // currentClearinghouseState and global asset ticker, or on timeout.
        await Promise.all([fetchMarketData(), waitForInitialWsData()]);

        setInitialized(true);
        return true;
      } catch (error) {
        console.error('Failed to init Perps state:', error);
      }
    };

    initIsLogin();
  }, [
    perpsState.currentPerpsAccount,
    isInitialized,
    loginPerpsAccount,
    fetchMarketData,
    ensureLoginApproveSign,
    setInitialized,
    resetAccountState,
    fetchPerpPermission,
  ]);

  const judgeIsUserAgentIsExpired = useMemoizedFn(
    async (errorMessage: string) => {
      const masterAddress = currentPerpsAccount?.address;
      if (!masterAddress) {
        return false;
      }

      const agentWalletPreference = await apisPerps.getAgentWalletPreference(
        masterAddress,
      );
      const agentAddress = agentWalletPreference?.agentAddress;
      if (agentAddress && errorMessage.includes(agentAddress)) {
        console.warn('handle action agent is expired, logout');
        showToast('Agent is expired, try it again', 'error');
        setAccountNeedApproveAgent(true);
        return true;
      }
    },
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
    sdk.initAccount(account.address, vault, agentAddress, PERPS_AGENT_NAME);

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
        await handleDirectApprove(signActions);
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

      const sdk = apisPerps.getPerpsSDK();
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
          sdk.initAccount(
            account.address,
            res.vault,
            res.preference.agentAddress,
            PERPS_AGENT_NAME,
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
        new Error(
          `Failed to login Perps account, address: ${account.address} , account type: ${account.type} , error: ${error}`,
        ),
      );
    }
  });

  const logout = useMemoizedFn((address: string) => {
    apisPerpsStore.logout();
    apisPerps.setPerpsCurrentAccount(null);
    apisPerps.setSendApproveAfterDeposit(address, []);
    deleteAgentCbRef.current = null;
  });

  const setCurrentPerpsAccount = useMemoizedFn((account: Account | null) => {
    setCurrentPerpsAccount(account);
  });

  const handleWithdraw = useMemoizedFn(
    async (
      amount: number | string,
      isHypeWithdraw = false,
      isUnifiedAccount = false,
      targetAsset: keyof typeof HYPE_SEND_ASSET_TOKEN_MAP = 'USDC',
    ): Promise<boolean> => {
      try {
        const sdk = apisPerps.getPerpsSDK();

        if (!currentPerpsAccount) {
          throw new Error('No currentPerpsAccount address');
        }

        if (!sdk.exchange) {
          throw new Error('Hyperliquid no exchange client');
        }

        if (
          targetAsset !== 'USDC' &&
          targetAsset !== 'USDT' &&
          targetAsset !== 'USDH' &&
          targetAsset !== 'USDE'
        ) {
          throw new Error(`Invalid target asset, targetAsset: ${targetAsset}`);
        }

        // HYPE withdraw goes through `send` ledger update whose server-
        // side timestamp can be a few dozen ms earlier than the client
        // clock, leaving the time-based pending filter unable to clear
        // it. Backdate by 1s to absorb the drift (matches the desktop
        // deposit handler's `Date.now() - 1000` trick).
        const time = Date.now() - 1000;
        const useMiniApprovalSign =
          currentPerpsAccount.type === KEYRING_CLASS.HARDWARE.ONEKEY ||
          currentPerpsAccount.type === KEYRING_CLASS.HARDWARE.LEDGER;
        const tokenId = HYPE_SEND_ASSET_TOKEN_MAP[targetAsset];
        const hyperDestination = HYPE_EVM_BRIDGE_ADDRESS_MAP[targetAsset];

        const action = isHypeWithdraw
          ? sdk.exchange.prepareSendAsset({
              destination: hyperDestination,
              amount: amount.toString(),
              token: tokenId,
              sourceDex: isUnifiedAccount ? 'spot' : '',
              destinationDex: 'spot',
            })
          : sdk.exchange.prepareWithdraw({
              amount: amount.toString(),
              destination: currentPerpsAccount.address,
            });

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
          try {
            const result = await miniSignTypedData({
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
          } catch (error) {
            throw 'Withdraw failed';
          }
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

        const res = isHypeWithdraw
          ? await sdk.exchange.sendSendAsset({
              action: action.message as any,
              nonce: action.nonce || 0,
              signature: signature as string,
            })
          : await sdk.exchange.sendWithdraw({
              action: action.message as any,
              nonce: action.nonce || 0,
              signature: signature as string,
            });

        setLocalLoadingHistory(
          [
            {
              time,
              hash: res.hash || '',
              type: 'withdraw',
              status: 'pending',
              usdValue: isHypeWithdraw
                ? amount.toString()
                : (+amount - 1).toString(),
            },
          ],
          false,
        );
        return true;
      } catch (error: any) {
        console.error('Failed to withdraw:', error);
        showToast(error.message || 'Withdraw failed', 'error');
        return false;
      }
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
      const sdk = apisPerps.getPerpsSDK();

      // Step 1: Prepare typed data for master wallet signing
      const prepared = sdk.exchange?.prepareUserSetAbstraction({
        user: account.address,
        abstraction: UserAbstraction.UNIFIED_ACCOUNT,
      });
      if (!prepared) {
        console.error('Failed to prepare unified account request');
        return false;
      }

      // Step 2: Sign with master wallet
      const signAction: SignAction = {
        action: {
          domain: prepared.domain,
          types: prepared.types,
          primaryType: prepared.primaryType,
          message: prepared.message,
        },
        type: 'userSetAbstraction',
        signature: '',
      };
      await executeSignatures([signAction], account);

      // Step 3: Send signed request
      await sdk.exchange?.sendUserSetAbstraction({
        action: prepared.message,
        nonce: prepared.nonce,
        signature: signAction.signature,
      });

      // Refresh account state
      setTimeout(() => {
        fetchUserAbstraction(account.address);
      }, 100);
      showToast('Unified Account enabled', 'success');
      return true;
    } catch (error: any) {
      if (error === 'Canceled') {
        return false;
      }
      console.error('enableUnifiedAccount error', error);
      showToast(error?.message || 'Failed to enable Unified Account', 'error');
      Sentry.captureException(
        new Error('PERPS enableUnifiedAccount error: ' + JSON.stringify(error)),
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
    setCurrentPerpsAccount,
    setInitialized,
    handleWithdraw,
    refreshData: refreshData,
    handleDeleteAgent,
    fetchMarketData,
    fetchClearinghouseState,

    judgeIsUserAgentIsExpired,
    handleActionApproveStatus,

    handleSafeSetReference,
    handleSafeSetUnifiedAccount,
    handleEnableUnifiedAccount,
  };
};
