import React, {
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import { Alert, TextInput } from 'react-native';
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
import { atom, useAtom } from 'jotai';
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
import { useFormik, useFormikContext } from 'formik';
import { getKRCategoryByType } from '@/utils/transaction';
import { matomoRequestEvent } from '@/utils/analytics';
import { toast } from '@/components/Toast';
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
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { useMemoizedFn } from 'ahooks';
import { abiCoder } from '@/core/apis/sendRequest';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useFindAddressByWhitelist } from '@/screens/Send/hooks/useWhiteListAddress';

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
const sendTokenScreenStateAtom = atom<SendScreenState>({ ...DFLT_SEND_STATE });
export function useSendNFTScreenState() {
  const [sendNFTScreenState, setSendNFTScreenState] = useAtom(
    sendTokenScreenStateAtom,
  );

  const putScreenState = useCallback<InternalContext['fns']['putScreenState']>(
    patchOrUpdateFunc => {
      setSendNFTScreenState(prev => {
        const patch =
          typeof patchOrUpdateFunc === 'function'
            ? patchOrUpdateFunc(prev)
            : patchOrUpdateFunc;

        return {
          ...prev,
          ...patch,
        };
      });
    },
    [setSendNFTScreenState],
  );

  const resetScreenState = useCallback(() => {
    setSendNFTScreenState({ ...DFLT_SEND_STATE });
  }, [setSendNFTScreenState]);

  return {
    sendNFTScreenState,
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

  const { sendNFTScreenState: screenState, putScreenState } =
    useSendNFTScreenState();

  const [formValues, setFormValues] = React.useState<FormSendNFT>({
    ...DF_SEND_TOKEN_FORM,
    to: toAddress || '',
  });

  const { validationSchema } = useMemo(() => {
    return {
      validationSchema: makeSendTokenValidationSchema({ t }),
    };
  }, [t]);

  const chainItem = findChain({ serverId: nftToken?.chain });

  const { openDirect, prefetch } = useMiniSigner({
    account: currentAccount,
    chainServerId: chainItem?.serverId,
    autoResetGasStoreOnChainChange: true,
  });

  const scrollviewRef = useRef<KeyboardAwareScrollView>(null);
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

  const navigation = useRabbyAppNavigation();

  const [ignoreMiniSignGasFee, setIgnoreMiniSignGasFee] = useState(false);
  const handleIgnoreGasFeeChange = useCallback((b: boolean) => {
    setIgnoreMiniSignGasFee(b);
  }, []);

  /** @notice the formik will be new object every-time re-render, but most of its fields keep same */
  const formik = useFormik({
    initialValues: formValues,
    validationSchema,
    onSubmit: values => {
      const formattedValues = {
        ...values,
        amount: formatSpeicalAmount(values.amount),
      };
      handleSubmit(formattedValues);
    },
  });

  const patchFormValues = useCallback(
    (changedValues: Partial<FormSendNFT>) => {
      setFormValues(prev => {
        let nextState = {
          ...prev,
          ...changedValues,
        };

        formik.setFormikState(fprev => {
          return { ...fprev, values: nextState };
        });

        return nextState;
      });
    },
    [formik, setFormValues],
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
        ...formik.values,
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
        resultAmount = screenState.cacheAmount;
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

      formik.setFormikState(prev => ({ ...prev, values: nextFormValues }));
      patchFormValues(nextFormValues);
      putScreenState({
        cacheAmount: resultAmount,
        ...(!resultAmount && { showGasReserved: false }),
      });
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
    [
      patchFormValues,
      screenState.cacheAmount,
      screenState.contactInfo,
      formik,
      putScreenState,
      t,
    ],
  );

  const handleFieldChange = useCallback(
    <T extends keyof FormSendNFT>(f: T, value: FormSendNFT[T]) => {
      formik.setFieldValue(f, value);
      setFormValues(prev => ({ ...prev, [f]: value }));

      const nextVal = { ...formik.values, [f]: value };
      handleFormValuesChange({ [f]: value }, { currentPartials: nextVal });
    },
    [formik, setFormValues, handleFormValuesChange],
  );

  const prepareDirectSubmitMiniTx = useMemoizedFn(async (ref: number) => {
    if (!nftToken || !currentAccount) return;

    const { to, amount } = formValues;

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
      putScreenState,
      chainItem?.name,
      nftToken,
      navigation,
    ],
  );

  const handleGasLevelChanged = useCallback(
    async (gl?: GasLevel | null) => {
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
    },
    [
      /* putScreenState */
    ],
  );

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
        reFetch();
        setTimeout(() => {
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

      canSubmit:
        isValidAddress(formValues.to) &&
        !screenState.balanceError &&
        new BigNumber(formValues.amount).gt(0) &&
        !screenState.isLoading,

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
    screenState,
    formValues.amount,
    cexList,
    currentAccount?.type,
    chainItem?.isTestnet,
  ]);

  const resetFormValues = useCallback(() => {
    setFormValues({ ...DF_SEND_TOKEN_FORM });
    formik.resetForm();
  }, [setFormValues, formik]);

  const prepareRef = useRef<Promise<Tx | void>>();
  const prepareCountRef = useRef(0);

  const isFocused = useIsFocused();
  const stableAmountValue = useDebouncedValue(formValues.amount, 300);

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
    if (
      isFocused &&
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      !chainItem?.isTestnet &&
      computed.canSubmit &&
      formValues.to &&
      stableAmountValue
    ) {
      prepareCountRef.current += 1;
      putScreenState({ buildTxsCount: prepareCountRef.current });
      prepareRef.current = prepareDirectSubmitMiniTx(prepareCountRef.current);
    }
  }, [
    putScreenState,
    isFocused,
    chainItem?.id,
    chainItem?.isTestnet,
    computed.canSubmit,
    formValues.to,
    stableAmountValue,
    currentAccount?.type,
    prepareDirectSubmitMiniTx,
  ]);

  return {
    chainItem,

    sendNFTEvents: sendNFTEventsRef.current,
    formik,
    formValues,
    resetFormValues,
    handleFieldChange,
    handleGasLevelChanged,
    scrollviewRef,
    handleIgnoreGasFeeChange,
    patchFormValues,
    handleFormValuesChange,

    whitelist,
    whitelistEnabled,
    computed,
  };
}
export function useSendNFTFormikContext() {
  return useFormikContext<FormSendNFT>();
}

export function useSendNFTFormik() {
  const { formik } = useSendNFTInternalContext();

  return formik;
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
  screenState: SendScreenState;
  formValues: FormSendNFT;
  computed: {
    fromAddress: string;
    chainItem: Chain | null;
    currentNFT: NFTItem | null;
    whitelistEnabled: boolean;
    canSubmit: boolean;
    canDirectSign: boolean;
    // toAddressInWhitelist: boolean;
    // toAddressIsRecentlySend: boolean;

    toAccount: FoundAccountResult['account'] | null;
    toAddressInContactBook: boolean;
    toAddressPositiveTips: ToAddressPositiveTips | null;
    toAddrCex: null | undefined | ProjectItem;
  };

  formik: ReturnType<typeof useFormik<FormSendNFT>>;
  events: EventEmitter;
  fns: {
    putScreenState: (
      patch:
        | Partial<SendScreenState>
        | ((prev: SendScreenState) => Partial<SendScreenState>),
    ) => void;
    fetchContactAccounts: () => void;
  };
  callbacks: {
    handleFieldChange: <T extends keyof FormSendNFT>(
      f: T,
      value: FormSendNFT[T],
    ) => void;
    handleGasLevelChanged: (gl?: GasLevel | null) => Promise<void> | void;
    handleIgnoreGasFeeChange: (b: boolean) => void;
  };
};
const SendNFTInternalContext = React.createContext<InternalContext>({
  screenState: { ...DFLT_SEND_STATE },
  formValues: { ...DF_SEND_TOKEN_FORM },
  computed: {
    fromAddress: '',
    chainItem: null,
    currentNFT: null,
    whitelistEnabled: false,
    canSubmit: false,
    canDirectSign: false,
    toAccount: null,
    toAddressPositiveTips: null,
    toAddressInContactBook: false,
    toAddrCex: null,
  },

  formik: null as any,
  events: null as any,
  fns: {
    putScreenState: () => {},
    fetchContactAccounts: () => {},
  },
  callbacks: {
    handleFieldChange: () => {},
    handleGasLevelChanged: () => {},
    handleIgnoreGasFeeChange: () => {},
  },
});

export const SendNFTInternalContextProvider = SendNFTInternalContext.Provider;

export function useSendNFTInternalContext() {
  return React.useContext(SendNFTInternalContext);
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
export function useInputBlurOnEvents(inputRef: React.RefObject<TextInput>) {
  const { events } = useSendNFTInternalContext();
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
