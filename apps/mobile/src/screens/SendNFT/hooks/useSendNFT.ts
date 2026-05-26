import React, {
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Alert, LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';
import { intToHex } from '@ethereumjs/util';
import { EventEmitter } from 'events';

import { preferenceService } from '@/core/services';
import { findChain, findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import {
  AddrDescResponse,
  GasLevel,
  NFTItem,
  ProjectItem,
  Tx,
} from '@rabby-wallet/rabby-api/dist/types';
import { openapi } from '@/core/request';
import { TFunction } from 'i18next';
import { isValidAddress } from '@ethereumjs/util';
import BigNumber from 'bignumber.js';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useContactAccounts } from '@/hooks/contact';
import { UIContactBookItem } from '@/core/apis/contact';
import { Account, ChainGas } from '@/core/services/preference';
import { apiContact, apiProvider, apiToken } from '@/core/apis';
import { formatSpeicalAmount } from '@/utils/number';
import { getKRCategoryByType } from '@/utils/transaction';
import { matomoRequestEvent } from '@/utils/analytics';
import { toast } from '@/components2024/Toast';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { StackActions, useIsFocused } from '@react-navigation/native';
import {
  isAccountSupportDirectSign,
  isAccountSupportMiniApproval,
  makeAccountObject,
} from '@/utils/account';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { useRecentSendToHistoryFor } from '@/screens/Send/hooks/useRecentSend';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { useMiniSigner } from '@/hooks/useSigner';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { useMemoizedFn } from 'ahooks';
import { abiCoder } from '@/core/apis/sendRequest';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/shallow';
import { createStore } from 'zustand/vanilla';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';
import { TextInput } from '@/components/Typography';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';
import { zMutative } from '@/core/utils/reexports';
import { isEqual } from 'lodash';

export const enum SendNFTEvents {
  'ON_PRESS_DISMISS' = 'ON_PRESS_DISMISS',
  'ON_SEND' = 'ON_SEND',
  'ON_SIGNED_SUCCESS' = 'ON_SIGNED_SUCCESS',
}

export type SendScreenState = {
  inited: boolean;

  showContactInfo: boolean;
  contactInfo: null | UIContactBookItem;

  /** @deprecated pointless now, see addressToEditAlias */
  showEditContactModal: boolean;
  showListContactModal: boolean;

  editBtnDisabled: boolean;
  cacheAmount: number | string;
  tokenAmountForGas: string;
  showWhitelistAlert: boolean;
  isLoading: boolean;
  isSubmitLoading: boolean;
  temporaryGrant: boolean;

  balanceError: string | null;
  balanceWarn: string | null;

  addressToAddAsContacts: string | null;
  addressToEditAlias: string | null;

  buildTxsCount: number;

  agreeRequiredChecks: {
    forToAddress: boolean;
  };

  toAddrDesc: null | AddrDescResponse['desc'];
};
const DFLT_SEND_STATE: SendScreenState = {
  inited: false,

  showContactInfo: false,
  contactInfo: null,

  showEditContactModal: false,
  showListContactModal: false,

  editBtnDisabled: false,
  cacheAmount: '0',
  tokenAmountForGas: '0',
  showWhitelistAlert: false,
  isLoading: false,
  isSubmitLoading: false,
  temporaryGrant: false,

  balanceError: null,
  balanceWarn: null,

  addressToAddAsContacts: null,
  addressToEditAlias: null,

  buildTxsCount: 0,

  agreeRequiredChecks: {
    forToAddress: false,
  },

  toAddrDesc: null,
};
const createSendNFTScreenStateStore = (initialState: SendScreenState) =>
  createStore<SendScreenState>()(
    zMutative<SendScreenState>(() => initialState),
  );
const sendNFTScreenStateStore = createSendNFTScreenStateStore({
  ...DFLT_SEND_STATE,
});
function putScreenState(
  patchOrUpdateFunc:
    | Partial<SendScreenState>
    | ((prev: SendScreenState) => Partial<SendScreenState>),
) {
  const prev = sendNFTScreenStateStore.getState();
  const patch =
    typeof patchOrUpdateFunc === 'function'
      ? patchOrUpdateFunc(prev)
      : patchOrUpdateFunc;
  const nextState = {
    ...prev,
    ...patch,
  };

  if (!isEqual(prev, nextState)) {
    sendNFTScreenStateStore.setState(nextState, true);
  }
}

function resetScreenState() {
  sendNFTScreenStateStore.setState({ ...DFLT_SEND_STATE }, true);
}

export const apiSendNFT = {
  putScreenState,
  resetScreenState,
};

export function useSendNFTScreenState() {
  const sendNFTScreenState = useStore(sendNFTScreenStateStore);

  return {
    sendNFTScreenState,
    putScreenState,
    resetScreenState,
  };
}

export function useSendNFTScreenStateSelector<T>(
  selector: (state: SendScreenState) => T,
) {
  return useStore(sendNFTScreenStateStore, selector);
}

export function useSendNFTScreenStateShallowSelector<T>(
  selector: (state: SendScreenState) => T,
) {
  const shallowSelector = useShallow(selector);
  return useStore(sendNFTScreenStateStore, shallowSelector);
}

export function useSendNFTScreenStateActions() {
  return {
    putScreenState,
    resetScreenState,
  };
}

export function makeSendTokenValidationSchema(options: {
  t: TFunction<'translation', undefined>;
}) {
  const { t } = options;
  const SendTokenSchema = Yup.object<FormSendNFT>().shape({
    to: Yup.string()
      .required(t('page.sendToken.sectionTo.addrValidator__empty'))
      .test(
        'is-web3-address',
        t('page.sendToken.sectionTo.addrValidator__invalid'),
        value => {
          // allow empty for this test
          if (!value) return true;

          if (value && isValidAddress(value)) return true;

          return false;
        },
      ),
  });

  return SendTokenSchema;
}

export type FormSendNFT = {
  to: string;
  amount: number | string;
};
const DF_SEND_TOKEN_FORM: FormSendNFT = {
  to: '',
  amount: 1,
};
const createSendNFTFormValuesStore = (initialState: FormSendNFT) =>
  createStore<FormSendNFT>()(zMutative<FormSendNFT>(() => initialState));
type SendNFTFormValuesStore = ReturnType<typeof createSendNFTFormValuesStore>;
const defaultSendNFTFormValuesStore = createSendNFTFormValuesStore({
  ...DF_SEND_TOKEN_FORM,
});
function shouldSyncSendNFTReactiveFormValues(
  prev: FormSendNFT,
  next: FormSendNFT,
) {
  return prev.to !== next.to;
}
export function useSendNFTForm({
  toAddress,
  toAddressBrandName,
  nftToken,
  currentAccount,
}: {
  toAddress?: string;
  toAddressBrandName?: string;
  nftToken?: NFTItem;
  currentAccount: Account;
}) {
  const { t } = useTranslation();

  const sendNFTEventsRef = useRef(new EventEmitter());

  const screenState = useSendNFTScreenStateShallowSelector(state => ({
    balanceError: state.balanceError,
    contactInfo: state.contactInfo,
    isLoading: state.isLoading,
    toAddrDesc: state.toAddrDesc,
  }));
  const cacheAmountRef = useRef(DFLT_SEND_STATE.cacheAmount);

  const [formValues, setFormValues] = React.useState<FormSendNFT>({
    ...DF_SEND_TOKEN_FORM,
    to: toAddress || '',
  });
  const formValuesStoreRef = useRef<SendNFTFormValuesStore | null>(null);
  if (!formValuesStoreRef.current) {
    formValuesStoreRef.current = createSendNFTFormValuesStore(formValues);
  }
  const formValuesLatestRef = useRef<FormSendNFT>(formValues);
  const getLatestFormValues = useMemoizedFn(() => formValuesLatestRef.current);
  const setCommittedFormValues = useCallback(
    (next: FormSendNFT | ((prev: FormSendNFT) => FormSendNFT)) => {
      setFormValues(prev => {
        const latest = formValuesLatestRef.current;
        const nextValues = typeof next === 'function' ? next(latest) : next;
        if (isEqual(latest, nextValues)) {
          return prev;
        }
        formValuesLatestRef.current = nextValues;
        formValuesStoreRef.current?.setState(nextValues, true);
        if (isEqual(prev, nextValues)) {
          return prev;
        }
        if (!shouldSyncSendNFTReactiveFormValues(prev, nextValues)) {
          return prev;
        }
        return nextValues;
      });
    },
    [],
  );
  useEffect(() => {
    formValuesLatestRef.current = formValues;
    formValuesStoreRef.current?.setState(formValues, true);
  }, [formValues]);

  const [stableAmountValue, setStableAmountValue] = useState(formValues.amount);
  useEffect(() => {
    const formValuesStore = formValuesStoreRef.current;
    if (!formValuesStore) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = formValuesStore.subscribe((values, prevValues) => {
      if (values.amount === prevValues.amount) {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        setStableAmountValue(values.amount);
      }, 300);
    });

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      unsubscribe();
    };
  }, []);

  const { validationSchema } = useMemo(() => {
    return {
      validationSchema: makeSendTokenValidationSchema({ t }),
    };
  }, [t]);

  const chainItem = findChain({ serverId: nftToken?.chain });

  const {
    openDirect,
    prefetch,
    instance: miniSignInstance,
  } = useMiniSigner({
    account: currentAccount,
    chainServerId: chainItem?.serverId,
    autoResetGasStoreOnChainChange: true,
  });

  const scrollviewRef = useRef<KeyboardAwareScrollView | null>(null);
  const navigation = useRabbyAppNavigation();

  const prefetchMiniSigner = useCallback<typeof prefetch>(
    async ctx => {
      try {
        await prefetch(ctx);
      } catch (e) {
        console.error('prefetchMiniSigner error', e);
      } finally {
        setTimeout(() => {
          scrollviewRef.current?.scrollToEnd(true);
        }, 250);
      }
    },
    [prefetch],
  );

  const scrollToBottom = useCallback(() => {
    scrollviewRef.current?.scrollToEnd?.(true);
  }, []);

  const [ignoreMiniSignGasFee, setIgnoreMiniSignGasFee] = useState(false);
  const handleIgnoreGasFeeChange = useCallback((b: boolean) => {
    setIgnoreMiniSignGasFee(b);
  }, []);

  const svBottomAreaHeight = useSharedValue(220);
  useAnimatedReaction(
    () => {
      return svBottomAreaHeight.value;
    },
    (cur, prev) => {
      if (cur !== prev) {
        runOnJS(scrollToBottom)();
      }
    },
  );
  const scrollViewStyle = useAnimatedStyle(() => {
    return {
      height: svBottomAreaHeight.value,
    };
  });

  const onBottomAreaLayout = useCallback(
    (event: LayoutChangeEvent) => {
      'worklet';
      svBottomAreaHeight.value = event.nativeEvent.layout.height;
    },
    [svBottomAreaHeight],
  );

  const patchFormValues = useCallback(
    (changedValues: Partial<FormSendNFT>) => {
      setCommittedFormValues(prev => {
        const nextState = {
          ...prev,
          ...changedValues,
        };

        return nextState;
      });
    },
    [setCommittedFormValues],
  );

  const handleFormValuesChange = useCallback(
    (
      changedValues: Partial<FormSendNFT> | null,
      opts?: {
        currentPartials?: Partial<FormSendNFT>;
      },
    ) => {
      let { currentPartials } = opts || {};
      const currentValues = {
        ...getLatestFormValues(),
        ...currentPartials,
      };

      if (changedValues && changedValues.to) {
        putScreenState({ temporaryGrant: false });
      }

      if (!currentValues.to || !isValidAddress(currentValues.to)) {
        putScreenState({ editBtnDisabled: true, showWhitelistAlert: true });
      } else {
        putScreenState({ editBtnDisabled: false, showWhitelistAlert: true });
      }
      let resultAmount = currentValues.amount;
      if (!/^\d*(\.\d*)?$/.test(currentValues.amount + '')) {
        resultAmount = cacheAmountRef.current;
      }

      // Validate amount for NFT
      if (new BigNumber(resultAmount || 0).lte(0)) {
        putScreenState({
          balanceError: t('page.sendToken.balanceError.insufficientBalance'),
        });
      } else {
        putScreenState({ balanceError: null });
      }

      const nextFormValues = {
        ...currentValues,
        to: currentValues.to,
        amount: resultAmount,
      };

      patchFormValues(nextFormValues);
      cacheAmountRef.current = resultAmount;
      const aliasName = apiContact.getAliasName(currentValues.to.toLowerCase());
      if (aliasName) {
        putScreenState({
          showContactInfo: true,
          contactInfo: { address: currentValues.to, name: aliasName },
        });
      } else if (screenState.contactInfo) {
        putScreenState({ contactInfo: null });
      }
    },
    [patchFormValues, screenState.contactInfo, getLatestFormValues, t],
  );

  const submitForm = useMemoizedFn(async () => {
    const values = {
      ...getLatestFormValues(),
      amount: formatSpeicalAmount(getLatestFormValues().amount),
    };

    try {
      await validationSchema.validate(values, { abortEarly: false });
    } catch (error) {
      if (__DEV__) {
        console.warn('[SendNFT] submit validation failed', error);
      }
      return;
    }

    handleSubmit(values);
  });

  const handleFieldChange = useMemoizedFn(
    <T extends keyof FormSendNFT>(f: T, value: FormSendNFT[T]) => {
      const nextVal = { ...getLatestFormValues(), [f]: value };
      handleFormValuesChange({ [f]: value }, { currentPartials: nextVal });
    },
  );

  const prepareDirectSubmitMiniTx = useMemoizedFn(async (ref: number) => {
    if (!nftToken || !currentAccount) return;

    const { to, amount } = getLatestFormValues();

    if (
      ref === prepareCountRef.current &&
      currentAccount &&
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      !chainItem?.isTestnet
    ) {
      const res = await apiToken.transferNFT(
        {
          to,
          amount: bizNumberUtils.coerceInteger(amount),
          tokenId: nftToken?.inner_id,
          chainServerId: nftToken?.chain,
          contractId: nftToken?.contract_id,
          abi: nftToken?.is_erc1155 ? 'ERC1155' : 'ERC721',
          account: currentAccount,
        },
        {
          $ctx: {
            ga: {
              category: 'Send',
              source: 'sendNFT',
            },
          },
          isBuild: true,
        },
      );
      const tx = res.params?.[0];

      if (ref === prepareCountRef.current) {
        if (tx) {
          prefetchMiniSigner({
            txs: [tx],
            ga: {
              category: 'Send',
              source: 'sendNFT',
            },
            checkGasFeeTooHigh: true,
            synGasHeaderInfo: true,
          });
          return tx as Tx;
        }
      }
    }
  });

  const handleSubmit = useCallback(
    async ({
      to,
      amount,
      isForceSignTx = false,
    }: FormSendNFT & { isForceSignTx?: boolean }) => {
      if (!nftToken) return;
      sendNFTEventsRef.current.emit(SendNFTEvents.ON_SEND);

      putScreenState({ isSubmitLoading: true });

      matomoRequestEvent({
        category: 'Send',
        action: 'createTx',
        label: [
          chainItem?.name,
          getKRCategoryByType(currentAccount?.type),
          currentAccount?.brandName,
          'nft',
        ].join('|'),
      });
      if (!currentAccount) {
        return;
      }

      try {
        if (
          !isForceSignTx &&
          isAccountSupportMiniApproval(currentAccount?.type || '') &&
          !chainItem?.isTestnet
        ) {
          if (!prepareRef.current) {
            prepareCountRef.current++;
            putScreenState({ buildTxsCount: prepareCountRef.current });
            prepareRef.current = prepareDirectSubmitMiniTx(
              prepareCountRef.current,
            );
          }
          const tx = await prepareRef.current;
          if (tx) {
            try {
              const res = await openDirect({
                txs: [tx],
                checkGasFeeTooHigh: true,
                ignoreGasFeeTooHigh: ignoreMiniSignGasFee || false,
                ga: {
                  category: 'Send',
                  source: 'sendToken',
                  toAddress,
                  trigger: 'sendToken',
                },
              });

              // currentAccount.type !== KEYRING_CLASS.GNOSIS &&
              // transactionHistoryService.addSendTxHistory({
              //   token: currentToken,
              //   amount: Number(amount),
              //   to,
              //   from: currentAccount?.address!,
              //   chainId: chain.id,
              //   hash: last(res) || '',
              //   address: currentAccount?.address!,
              //   status: 'pending',
              //   createdAt: Date.now(),
              // });

              handleFieldChange('amount', '');
            } catch (error: any) {
              console.log('sendToken mini sign error', error);
              if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
              } else if (
                [
                  MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
                  MINI_SIGN_ERROR.CANT_PROCESS,
                ].includes(error)
              ) {
                if (error === MINI_SIGN_ERROR.CANT_PROCESS) {
                  prepareCountRef.current++;
                  putScreenState({ buildTxsCount: prepareCountRef.current });
                  prefetchMiniSigner({ txs: [] });
                  prepareRef.current = prepareDirectSubmitMiniTx(
                    prepareCountRef.current,
                  );
                }

                return;
              } else {
                handleSubmit({
                  to,
                  amount,
                  isForceSignTx: true,
                });
                return;
              }

              prepareCountRef.current++;
              putScreenState({ buildTxsCount: prepareCountRef.current });
              prefetchMiniSigner({ txs: [] });
              prepareRef.current = prepareDirectSubmitMiniTx(
                prepareCountRef.current,
              );
            }
          }
        } else {
          await apiToken
            .transferNFT(
              {
                to,
                amount: bizNumberUtils.coerceInteger(amount),
                tokenId: nftToken.inner_id,
                chainServerId: nftToken.chain,
                contractId: nftToken.contract_id,
                abi: nftToken.is_erc1155 ? 'ERC1155' : 'ERC721',
                account: currentAccount,
              },
              {
                $ctx: {
                  ga: {
                    category: 'Send',
                    source: 'sendNFT',
                  },
                },
                isBuild: false,
              },
            )
            .then(resp => {
              const hash = resp as string;
              console.debug('hash', hash);
              // currentAccount.type !== KEYRING_CLASS.GNOSIS &&
              //   transactionHistoryService.addSendTxHistory({
              //     token: currentToken,
              //     amount: Number(amount),
              //     to,
              //     from: currentAccount?.address!,
              //     chainId: chain.id,
              //     hash,
              //     address: currentAccount?.address!,
              //     status: 'pending',
              //     createdAt: Date.now(),
              //   });

              handleFieldChange('amount', '');
            })
            .catch(err => {
              console.error(err);
              // toast.info(err.message);
            });
        }

        resetNavigationTo(navigation, 'Home');
      } catch (e: any) {
        toast.info(e.message);
      } finally {
        putScreenState({ isSubmitLoading: false });
      }
    },
    [
      chainItem?.isTestnet,
      handleFieldChange,
      ignoreMiniSignGasFee,
      openDirect,
      prefetchMiniSigner,
      prepareDirectSubmitMiniTx,
      toAddress,
      currentAccount,
      chainItem?.name,
      nftToken,
      navigation,
    ],
  );

  const handleGasLevelChanged = useMemoizedFn(async (gl?: GasLevel | null) => {
    // let gasLevel = gl
    //   ? gl
    //   : await loadGasListAndResolve().then(
    //     result => result.normalGasLevel || result.instantGasLevel,
    //   );
    // if (gasLevel) {
    //   putScreenState({ reserveGasOpen: false, selectedGasLevel: gasLevel });
    //   handleMaxInfoChanged({ gasLevel });
    // } else {
    //   putScreenState({ reserveGasOpen: false });
    // }
  });

  const { isAddrOnContactBook } = useContactAccounts({ autoFetch: true });
  const { list: cexList } = useCexSupportList();

  const {
    whitelist,
    enabled: whitelistEnabled,
    findAccountWithoutBalance,
  } = useFindAddressByWhitelist();
  const { recentHistory: recentSendToHistory, reFetch } =
    useRecentSendToHistoryFor(formValues.to);

  useEffect(() => {
    const onTxCompleted: EventBusListeners[typeof EVENTS.TX_COMPLETED] =
      txDetail => {
        if (isGasAccountDepositFlowActive()) {
          return;
        }
        reFetch();
        setTimeout(() => {
          if (isGasAccountDepositFlowActive()) {
            return;
          }
          reFetch();
        }, 5000);
      };
    eventBus.addListener(EVENTS.TX_COMPLETED, onTxCompleted);

    return () => {
      eventBus.removeListener(EVENTS.TX_COMPLETED, onTxCompleted);
    };
  }, [reFetch]);

  const foundToAccountInfo = useMemo(() => {
    return findAccountWithoutBalance(formValues.to, {
      brandName: toAddressBrandName,
    });
  }, [formValues.to, toAddressBrandName, findAccountWithoutBalance]);
  const toAddressIsRecentlySend = recentSendToHistory.length > 0;
  const toAccount = useMemo(() => {
    return (
      foundToAccountInfo?.account ||
      makeAccountObject({
        address: formValues.to,
        brandName: toAddressBrandName,
      })
    );
  }, [foundToAccountInfo?.account, formValues.to, toAddressBrandName]);
  const computed = useMemo(() => {
    const toAddressInWhitelist = !!whitelist.find(item =>
      addressUtils.isSameAddress(item, formValues.to),
    );
    const toAddressPositiveTips = {
      hasPositiveTips:
        toAddressIsRecentlySend ||
        toAddressInWhitelist ||
        !!foundToAccountInfo?.isMyImported,
      inWhitelist: toAddressInWhitelist,
      isRecentlySend: toAddressIsRecentlySend,
      isMyImported: foundToAccountInfo?.isMyImported,
    };
    return {
      toAccount,
      toAddressPositiveTips,
      toAddressIsCex:
        !!screenState.toAddrDesc?.cex?.id &&
        !!screenState.toAddrDesc?.cex?.is_deposit,
      toAddressInContactBook: isAddrOnContactBook(formValues.to),

      toAddrCex: cexList.find(
        item => item.id === screenState.toAddrDesc?.cex?.id,
      ),

      canDirectSign:
        isAccountSupportMiniApproval(currentAccount?.type || '') &&
        !chainItem?.isTestnet,
    };
  }, [
    whitelist,
    isAddrOnContactBook,
    formValues.to,
    toAccount,
    foundToAccountInfo?.isMyImported,
    toAddressIsRecentlySend,
    screenState.toAddrDesc,
    cexList,
    currentAccount?.type,
    chainItem?.isTestnet,
  ]);

  const resetFormValues = useCallback(() => {
    cacheAmountRef.current = DFLT_SEND_STATE.cacheAmount;
    setCommittedFormValues({ ...DF_SEND_TOKEN_FORM });
  }, [setCommittedFormValues]);

  const prepareRef = useRef<Promise<Tx | void>>(undefined);
  const prepareCountRef = useRef(0);

  const isFocused = useIsFocused();
  useEffect(() => {
    if (
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      !chainItem?.isTestnet
    ) {
      prefetchMiniSigner({
        txs: [],
      });
    }
  }, [
    prefetchMiniSigner,
    chainItem?.id,
    formValues.to,
    currentAccount?.type,
    chainItem?.isTestnet,
    toAddress,
  ]);

  useEffect(() => {
    const canPrepareDirectSubmit =
      isValidAddress(formValues.to) &&
      !screenState.balanceError &&
      new BigNumber(stableAmountValue || 0).gt(0) &&
      !screenState.isLoading;

    if (
      isFocused &&
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      !chainItem?.isTestnet &&
      canPrepareDirectSubmit &&
      formValues.to &&
      stableAmountValue
    ) {
      prepareCountRef.current += 1;
      putScreenState({ buildTxsCount: prepareCountRef.current });
      prepareRef.current = prepareDirectSubmitMiniTx(prepareCountRef.current);
    }
  }, [
    isFocused,
    chainItem?.id,
    chainItem?.isTestnet,
    formValues.to,
    stableAmountValue,
    screenState.balanceError,
    screenState.isLoading,
    currentAccount?.type,
    prepareDirectSubmitMiniTx,
  ]);

  return {
    chainItem,

    sendNFTEvents: sendNFTEventsRef.current,
    formValuesStore: formValuesStoreRef.current,
    submitForm,
    formValues,
    resetFormValues,
    handleFieldChange,
    handleGasLevelChanged,
    scrollviewRef,
    handleIgnoreGasFeeChange,
    patchFormValues,
    handleFormValuesChange,

    onBottomAreaLayout,
    scrollViewStyle,
    scrollToBottom,

    whitelist,
    whitelistEnabled,
    computed,
    miniSignInstance,
  };
}
type FoundAccountResult = Awaited<
  ReturnType<ReturnType<typeof useFindAddressByWhitelist>['findAccount']>
>;
type ToAddressPositiveTips = {
  hasPositiveTips: boolean;
  inWhitelist: boolean;
  isRecentlySend: boolean;
  isMyImported?: boolean;
};
type InternalContext = {
  computed: {
    account: Account | null;
    addrDesc: AddrDescResponse['desc'] | null;
    collectionName?: string;
    fromAddress: string;
    chainItem: Chain | null;
    currentNFT: NFTItem | null;
    whitelistEnabled: boolean;
    canDirectSign: boolean;
    // toAddressInWhitelist: boolean;
    // toAddressIsRecentlySend: boolean;

    toAccount: FoundAccountResult['account'] | null;
    toAddressInContactBook: boolean;
    toAddressPositiveTips: ToAddressPositiveTips | null;
    toAddrCex: null | undefined | ProjectItem;
  };

  events: EventEmitter;
  formValuesStore: SendNFTFormValuesStore;
  scrollViewRef: React.MutableRefObject<KeyboardAwareScrollView | null>;
  scrollViewStyle: any;
  fns: {
    fetchContactAccounts: () => void;
  };
  callbacks: {
    submitForm: () => void;
    handleFieldChange: <T extends keyof FormSendNFT>(
      f: T,
      value: FormSendNFT[T],
    ) => void;
    handleGasLevelChanged: (gl?: GasLevel | null) => Promise<void> | void;
    handleIgnoreGasFeeChange: (b: boolean) => void;
    onBottomAreaLayout: (layout: any) => void;
    onGasInfoDebouncedLoaded: () => void;
  };
};
const DEFAULT_SEND_NFT_INTERNAL_CONTEXT: InternalContext = {
  computed: {
    account: null,
    addrDesc: null,
    collectionName: undefined,
    fromAddress: '',
    chainItem: null,
    currentNFT: null,
    whitelistEnabled: false,
    canDirectSign: false,
    toAccount: null,
    toAddressPositiveTips: null,
    toAddressInContactBook: false,
    toAddrCex: null,
  },

  events: null as any,
  formValuesStore: defaultSendNFTFormValuesStore,
  scrollViewRef: { current: null },
  scrollViewStyle: null,
  fns: {
    fetchContactAccounts: () => {},
  },
  callbacks: {
    submitForm: () => {},
    handleFieldChange: () => {},
    handleGasLevelChanged: () => {},
    handleIgnoreGasFeeChange: () => {},
    onBottomAreaLayout: () => {},
    onGasInfoDebouncedLoaded: () => {},
  },
};

const createSendNFTInternalStore = (initialState: InternalContext) =>
  createStore<InternalContext>()(
    zMutative<InternalContext>(() => initialState),
  );

type SendNFTInternalStore = ReturnType<typeof createSendNFTInternalStore>;

const defaultSendNFTInternalStore = createSendNFTInternalStore(
  DEFAULT_SEND_NFT_INTERNAL_CONTEXT,
);

const SendNFTInternalStoreContext =
  React.createContext<SendNFTInternalStore | null>(null);

export function SendNFTInternalContextProvider({
  value,
  children,
}: React.PropsWithChildren<{ value: InternalContext }>) {
  const storeRef = React.useRef<SendNFTInternalStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createSendNFTInternalStore(value);
  }

  React.useLayoutEffect(() => {
    storeRef.current?.setState(value, true);
  }, [value]);

  return React.createElement(
    SendNFTInternalStoreContext.Provider,
    { value: storeRef.current },
    children,
  );
}

function useSendNFTInternalStoreApi() {
  return (
    React.useContext(SendNFTInternalStoreContext) || defaultSendNFTInternalStore
  );
}

export function useSendNFTInternalContext() {
  return useStore(useSendNFTInternalStoreApi());
}

export function useSendNFTInternalSelector<T>(
  selector: (ctx: InternalContext) => T,
) {
  const store = useSendNFTInternalStoreApi();
  return useStore(store, selector);
}

export function useSendNFTInternalShallowSelector<T>(
  selector: (ctx: InternalContext) => T,
) {
  const store = useSendNFTInternalStoreApi();
  const shallowSelector = useShallow(selector);
  return useStore(store, shallowSelector);
}

export function useSendNFTFormValuesSelector<T>(
  selector: (values: FormSendNFT) => T,
) {
  const formValuesStore = useSendNFTInternalSelector(
    ctx => ctx.formValuesStore,
  );
  return useStore(formValuesStore, selector);
}

export function useSendNFTFormValuesShallowSelector<T>(
  selector: (values: FormSendNFT) => T,
) {
  const formValuesStore = useSendNFTInternalSelector(
    ctx => ctx.formValuesStore,
  );
  const shallowSelector = useShallow(selector);
  return useStore(formValuesStore, shallowSelector);
}

export function useSendNFTCanSubmit() {
  const { balanceError, isLoading } = useSendNFTScreenStateShallowSelector(
    state => ({
      balanceError: state.balanceError,
      isLoading: state.isLoading,
    }),
  );
  const { amount, to } = useSendNFTFormValuesShallowSelector(values => ({
    amount: values.amount,
    to: values.to,
  }));

  return (
    isValidAddress(to) &&
    !balanceError &&
    new BigNumber(amount || 0).gt(0) &&
    !isLoading
  );
}

export function subscribeEvent<T extends SendNFTEvents>(
  events: EventEmitter,
  type: T,
  cb: (payload: any) => void,
  options?: { disposeRets?: Function[] },
) {
  const { disposeRets } = options || {};
  const dispose = () => {
    events.off(type, cb);
  };

  if (disposeRets) {
    disposeRets.push(dispose);
  }

  events.on(type, cb);

  return dispose;
}
export function useInputBlurOnEvents(
  inputRef: React.RefObject<TextInput | null>,
) {
  const events = useSendNFTInternalSelector(ctx => ctx.events);
  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeEvent(
      events,
      SendNFTEvents.ON_PRESS_DISMISS,
      () => {
        inputRef.current?.blur();
      },
      { disposeRets },
    );

    subscribeEvent(
      events,
      SendNFTEvents.ON_SEND,
      () => {
        inputRef.current?.blur();
      },
      { disposeRets },
    );

    return () => {
      disposeRets.forEach(dispose => dispose());
    };
  }, [events, inputRef]);
}
