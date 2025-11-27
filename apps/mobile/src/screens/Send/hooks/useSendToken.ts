import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from 'react';
import { Alert, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Sentry from '@sentry/react-native';
import * as Yup from 'yup';
import { intToHex } from '@ethereumjs/util';
import { EventEmitter } from 'events';

import {
  customTestnetService,
  preferenceService,
  transactionHistoryService,
} from '@/core/services';
import { findChain, findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import {
  AddrDescResponse,
  GasLevel,
  ProjectItem,
  TokenItem,
  TokenItemWithEntity,
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
import { Account } from '@/core/services/preference';
import { apiContact, apiCustomTestnet, apiProvider } from '@/core/apis';
import { formatSpeicalAmount } from '@/utils/number';
import { useFormik, useFormikContext } from 'formik';
import { useCheckAddressType } from '@/hooks/useParseAddress';
import { formatTxInputDataOnERC20 } from '@/utils/transaction';
import {
  CAN_ESTIMATE_L1_FEE_CHAINS,
  CAN_NOT_SPECIFY_INTRINSIC_GAS_CHAINS,
  MINIMUM_GAS_LIMIT,
} from '@/constant/gas';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { abiCoder } from '@/core/apis/sendRequest';
import { zeroAddress } from '@ethereumjs/util';
import { customTestnetTokenToTokenItem } from '@/utils/token';
import { useFindChain } from '@/hooks/useFindChain';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { useSwitchSceneAccountOnSelectedTokenWithOwner } from '@/databases/hooks/token';
import { naviReplace } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import {
  useFocusEffect,
  useIsFocused,
  useRoute,
} from '@react-navigation/native';
import { sendScreenParamsAtom } from '@/hooks/useSendRoutes';
import { ITokenCheck } from '@/components/Token/TokenSelectorSheetModal';
import {
  isAccountSupportMiniApproval,
  makeAccountObject,
} from '@/utils/account';
import { usePollSendPendingCount } from './useSendPendingCount';
import { eventBus, EventBusListeners, EVENTS } from '@/utils/events';
import { useMemoizedFn } from 'ahooks';
import {
  useRecentSendToHistoryFor,
  useRecentSendPendingTx,
} from './useRecentSend';
import { last } from 'lodash';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useMiniSigner } from '@/hooks/useSigner';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { useSwapBridgeSlider } from '@/screens/Swap/hooks/slider';
import { tokenAmountBn } from '@/screens/Swap/utils';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { IExtractFromPromise } from '@/utils/type';
import { useFindAddressByWhitelist } from './useWhiteListAddress';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import { coerceNumber } from '@/utils/coerce';

function makeDefaultToken(): TokenItemWithEntity & {
  tokenId?: string;
} {
  return {
    id: 'eth',
    chain: 'eth',
    name: 'ETH',
    symbol: 'ETH',
    display_symbol: null,
    optimized_symbol: 'ETH',
    cex_ids: [],
    decimals: 18,
    logo_url:
      'https://static.debank.com/image/token/logo_url/eth/935ae4e4d1d12d59a99717a24f2540b5.png',
    price: 0,
    is_verified: true,
    is_core: true,
    is_wallet: true,
    time_at: 0,
    amount: 0,
  };
}

export const enum SendTokenEvents {
  'ON_PRESS_DISMISS' = 'ON_PRESS_DISMISS',
  'ON_SEND' = 'ON_SEND',
  'ON_SIGNED_SUCCESS' = 'ON_SIGNED_SUCCESS',
}

const sendTokenScreenChainTokenAtom = atom({
  chainEnum: CHAINS_ENUM.ETH,
  currentToken: makeDefaultToken(),
});
export function useSendTokenScreenChainToken() {
  const [chainToken, _setChainToken] = useAtom(sendTokenScreenChainTokenAtom);
  const { chainEnum, currentToken } = chainToken;
  const [, setRouteParams] = useAtom(sendScreenParamsAtom);

  const chainItem =
    useFindChain({
      enum: chainEnum,
    }) || null;
  /** @deprecated weried behavior */
  const currentTokenRef = useRef(currentToken);
  const putChainToken = useCallback(
    (values: Partial<typeof chainToken>) => {
      if (values.currentToken) {
        currentTokenRef.current = values.currentToken;
      }

      return _setChainToken(prev => {
        const nextVal = {
          ...prev,
          ...values,
        };

        return nextVal;
      });
    },
    [_setChainToken],
  );
  // devLog('currentToken.chain', currentToken.chain);

  const { isNativeToken } = useMemo(() => {
    const isNativeToken =
      !!chainItem && currentToken?.id === chainItem.nativeTokenAddress;

    return {
      isNativeToken,
    };
  }, [chainItem, currentToken?.id]);

  const setChainEnum = useCallback(
    (chain: CHAINS_ENUM) => {
      setRouteParams(pre => ({
        ...pre,
        chainEnum: chain,
      }));
      putChainToken({ chainEnum: chain });
    },
    [putChainToken, setRouteParams],
  );

  const setCurrentToken = useCallback(
    (token: TokenItem) => {
      setRouteParams(pre => ({
        ...pre,
        tokenId: token.id,
      }));
      putChainToken({ currentToken: token /* chainEnum: token.chain */ });
    },
    [putChainToken, setRouteParams],
  );

  return {
    putChainToken,
    chainItem,
    isNativeToken,

    chainEnum,
    setChainEnum,

    currentToken,
    setCurrentToken,
  };
}
export type SendScreenState = {
  inited: boolean;

  showContactInfo: boolean;
  contactInfo: null | UIContactBookItem;

  /** @deprecated pointless now, see addressToEditAlias */
  showEditContactModal: boolean;
  showListContactModal: boolean;

  editBtnDisabled: boolean;
  cacheAmount: string;
  tokenAmountForGas: string;
  showWhitelistAlert: boolean;

  gasList: GasLevel[];
  showGasReserved: boolean;
  isEstimatingGas: boolean;

  clickedMax: boolean;
  balanceError: string | null;
  balanceWarn: string | null;
  isLoading: boolean;
  isSubmitLoading: boolean;
  estimatedGas: number;
  reserveGasOpen: boolean;
  temporaryGrant: boolean;
  /** @deprecated */
  gasPriceMap: Record<string, { list: GasLevel[]; expireAt: number }>;
  gasSelectorVisible: boolean;
  selectedGasLevel: GasLevel | null;
  isGnosisSafe: boolean;

  safeInfo: {
    chainId: number;
    nonce: number;
  } | null;

  addressToAddAsContacts: string | null;
  addressToEditAlias: string | null;

  buildTxsCount?: number;

  agreeRequiredChecks: {
    forToAddress: boolean;
    forToken: boolean;
  };
  // toAddrAccountInfo: FoundAccountResult | null;
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

  gasList: [],
  showGasReserved: false,
  clickedMax: false,

  balanceError: null,
  balanceWarn: null,
  isLoading: false,
  isSubmitLoading: false,

  estimatedGas: 0,
  isEstimatingGas: false,

  reserveGasOpen: false,
  temporaryGrant: false,
  gasPriceMap: {},
  gasSelectorVisible: false,
  selectedGasLevel: null,
  isGnosisSafe: false,

  safeInfo: null,

  addressToAddAsContacts: null,
  addressToEditAlias: null,

  agreeRequiredChecks: {
    forToAddress: false,
    forToken: false,
  },
  // toAddrAccountInfo: null,
  toAddrDesc: null,
};
const sendTokenScreenStateAtom = atom<SendScreenState>({ ...DFLT_SEND_STATE });
export function useSendTokenScreenState() {
  const [sendTokenScreenState, setSendScreenState] = useAtom(
    sendTokenScreenStateAtom,
  );

  const putScreenState = useCallback<InternalContext['fns']['putScreenState']>(
    patchOrUpdateFunc => {
      setSendScreenState(prev => {
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
    [setSendScreenState],
  );

  const resetScreenState = useCallback(() => {
    setSendScreenState({ ...DFLT_SEND_STATE });
  }, [setSendScreenState]);

  return {
    sendTokenScreenState,
    putScreenState,
    resetScreenState,
  };
}

export function makeSendTokenValidationSchema(options: {
  t: TFunction<'translation', undefined>;
}) {
  const { t } = options;
  const SendTokenSchema = Yup.object<FormSendToken>().shape({
    to: Yup.string()
      .required(t('page.sendToken.sectionTo.addrValidator__empty'))
      .test(
        'is-web3-address',
        t('page.sendToken.sectionTo.addrValidator__invalid'),
        value => {
          // allow empty for this test
          if (!value) {
            return true;
          }

          if (value && isValidAddress(value)) {
            return true;
          }

          return false;
        },
      ),
  });

  return SendTokenSchema;
}

function findInstanceLevel(gasList: GasLevel[]) {
  if (gasList.length === 0) {
    return null;
  }
  return gasList.reduce((prev, current) =>
    prev.price >= current.price ? prev : current,
  );
}
const fetchGasList = async (
  chainItem: Chain | null,
  params: Tx,
  account: Account,
) => {
  const list: GasLevel[] = chainItem?.isTestnet
    ? await customTestnetService.getGasMarket({ chainId: chainItem.id })
    : await apiProvider.gasMarketV2(
        {
          chain: chainItem!,
          tx: params,
        },
        account,
      );

  return list;
};

const DEFAULT_GAS_USED = 21000;

export type FormSendToken = {
  to: string;
  amount: string;
  messageDataForSendToEoa: string;
  messageDataForContractCall: string;
};
const DF_SEND_TOKEN_FORM: FormSendToken = {
  to: '',
  amount: '',
  messageDataForSendToEoa: '',
  messageDataForContractCall: '',
};
// const sendTokenScreenFormAtom = atom<FormSendToken>({ ...DF_SEND_TOKEN_FORM });

/**
 * @description only called once at top level
 */
export function useSendTokenForm({
  toAddress,
  toAddressBrandName,
  isForMultipleAddress = false,
  disableItemCheck,
  currentAccount,
}: {
  toAddress?: string;
  toAddressBrandName?: string;
  isForMultipleAddress: boolean;
  disableItemCheck?: ITokenCheck;
  currentAccount: Account;
}) {
  const { t } = useTranslation();

  const sendTokenEventsRef = useRef(new EventEmitter());
  const account = currentAccount;
  const { switchAccountOnSelectedToken } =
    useSwitchSceneAccountOnSelectedTokenWithOwner('MakeTransactionAbout');

  const { chainEnum, isNativeToken, currentToken, putChainToken, chainItem } =
    useSendTokenScreenChainToken();
  const [, setRouteParams] = useAtom(sendScreenParamsAtom);

  const { sendTokenScreenState: screenState, putScreenState } =
    useSendTokenScreenState();

  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'MultiSend'>
    >();
  const multiNavParams = route.params;
  const [formValues, setFormValues] = React.useState<FormSendToken>({
    ...DF_SEND_TOKEN_FORM,
    to: toAddress || '',
  });

  const { addressType } = useCheckAddressType(
    formValues.to,
    chainItem,
    account,
  );

  const { isShowMessageDataForToken, isShowMessageDataForContract } =
    useMemo(() => {
      return {
        isShowMessageDataForToken: isNativeToken && addressType === 'EOA',
        isShowMessageDataForContract:
          isNativeToken && addressType === 'CONTRACT',
      };
    }, [isNativeToken, addressType]);

  const getParams = useCallback(
    ({
      to,
      amount,
      messageDataForSendToEoa,
      messageDataForContractCall,
    }: FormSendToken) => {
      const chain = findChainByServerID(currentToken.chain)!;
      const sendValue = new BigNumber(amount || 0)
        .multipliedBy(10 ** currentToken.decimals)
        .decimalPlaces(0, BigNumber.ROUND_DOWN);
      const dataInput = [
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
          ] as any[],
        } as const,
        [to, sendValue.toFixed(0)] as any[],
      ] as const;

      if (!isValidAddress(to)) {
        to = dataInput[1][0] = '0x0000000000000000000000000000000000000000';
      }

      const params: Record<string, any> = {
        chainId: chain.id,
        from: currentAccount!.address,
        to: currentToken.id,
        value: '0x0',
        data: abiCoder.encodeFunctionCall(dataInput[0], dataInput[1]),
        isSend: true,
      };
      if (screenState.safeInfo?.nonce != null) {
        params.nonce = screenState.safeInfo.nonce;
      }
      if (isNativeToken) {
        params.to = to;
        delete params.data;

        if (isShowMessageDataForToken && messageDataForSendToEoa) {
          const encodedValue = formatTxInputDataOnERC20(
            messageDataForSendToEoa,
          ).hexData;

          params.data = encodedValue;
        } else if (isShowMessageDataForContract && messageDataForContractCall) {
          params.data = messageDataForContractCall;
        }

        params.value = `0x${sendValue.toString(16)}`;
      }

      return params;
    },
    [
      currentAccount,
      currentToken.chain,
      currentToken.decimals,
      currentToken.id,
      isNativeToken,
      isShowMessageDataForContract,
      isShowMessageDataForToken,
      screenState,
    ],
  );

  useEffect(() => {
    setFormValues(prev => {
      return {
        ...DF_SEND_TOKEN_FORM,
        to: prev.to,
      };
    });
  }, [currentAccount?.type, currentAccount?.address]);

  const { validationSchema } = useMemo(() => {
    return {
      validationSchema: makeSendTokenValidationSchema({ t }),
    };
  }, [t]);

  const [{ error: loadGasListError }, loadGasList] = useAsyncFn(
    async () =>
      fetchGasList(chainItem, getParams(formValues) as Tx, currentAccount),
    [chainItem, formValues, putScreenState, currentAccount],
  );

  const loadGasListAndResolve = useCallback(async () => {
    const result = {
      isValidArray: true,
      gasList: [] as GasLevel[],
      instantGasLevel: null as null | GasLevel,
      normalGasLevel: null as null | GasLevel,
    };
    let reqResult: GasLevel[] = [];
    try {
      reqResult = await loadGasList();
      result.isValidArray = Array.isArray(reqResult);
    } catch (err) {
      result.isValidArray = false;
      console.error(err);
      Sentry.captureException(err);
    } finally {
      result.gasList = result.isValidArray ? reqResult : [];
      result.instantGasLevel = findInstanceLevel(result.gasList) || null;
      result.normalGasLevel =
        result.gasList.find(item => item.level === 'normal') || null;
    }

    return result;
  }, [loadGasList]);

  if (__DEV__ && loadGasListError) {
    console.error(loadGasListError);
  }

  useEffect(() => {
    loadGasListAndResolve().then(result => {
      result.isValidArray && putScreenState({ gasList: result.gasList });
    });
  }, [loadGasListAndResolve, putScreenState]);

  const { openDirect, prefetch: prefetchMiniSigner } = useMiniSigner({
    account,
    chainServerId: chainItem?.serverId,
    autoResetGasStoreOnChainChange: true,
  });

  const { runAsync: runFetchPendingCount } = usePollSendPendingCount({
    isForMultipleAddress: isForMultipleAddress,
  });
  const { runFetchLocalPendingTx } =
    useRecentSendPendingTx(isForMultipleAddress);

  /** @notice the formik will be new object every-time re-render, but most of its fields keep same */
  const formik = useFormik({
    initialValues: formValues,
    validationSchema,
    onSubmit: values => {
      values.amount = formatSpeicalAmount(values.amount);
      handleSubmit(values);
    },
  });

  const patchFormValues = useCallback(
    (changedValues: Partial<FormSendToken>) => {
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
      changedValues: Partial<FormSendToken> | null,
      opts?: {
        currentPartials?: Partial<FormSendToken>;
        token?: TokenItem;
        isInitFromCache?: boolean;
      },
    ) => {
      let { currentPartials } = opts || {};
      const currentValues = {
        ...formik.values,
        ...currentPartials,
      };

      const { token, isInitFromCache } = opts || {};
      if (changedValues && changedValues.to) {
        putScreenState({ temporaryGrant: false });
      }

      if (
        (!isInitFromCache && changedValues?.to) ||
        (!changedValues && currentValues.to)
      ) {
        currentValues.messageDataForSendToEoa = '';
        currentValues.messageDataForContractCall = '';
      }

      const targetToken = token || currentToken;
      // devLog('handleFormValuesChange:: token', token);
      // devLog(
      //   'handleFormValuesChange:: currentToken',
      //   currentToken,
      //   currentTokenRef.current === targetToken,
      // );
      if (!currentValues.to || !isValidAddress(currentValues.to)) {
        putScreenState({ editBtnDisabled: true, showWhitelistAlert: true });
      } else {
        putScreenState({ editBtnDisabled: false, showWhitelistAlert: true });
      }
      let resultAmount = currentValues.amount;
      if (!/^\d*(\.\d*)?$/.test(currentValues.amount)) {
        resultAmount = screenState.cacheAmount;
      }

      if (currentValues.amount !== screenState.cacheAmount) {
        if (screenState.showGasReserved && coerceNumber(resultAmount, 0) > 0) {
          putScreenState({ showGasReserved: false });
        } /*  else if (isNativeToken && !screenState.isGnosisSafe) {
          const gasCostTokenAmount = calcGasCost({ chainEnum, gasPriceMap });
          if (
            new BigNumber(targetToken.raw_amount_hex_str || 0)
              .div(10 ** targetToken.decimals)
              .minus(currentValues.amount)
              .minus(gasCostTokenAmount)
              .lt(0)
          ) {
            putScreenState({
              balanceWarn: t('page.sendToken.balanceWarn.gasFeeReservation'),
            });
          } else {
            putScreenState({ balanceWarn: null });
          }
        } */
      }

      if (
        new BigNumber(resultAmount || 0).isGreaterThan(
          new BigNumber(targetToken.raw_amount_hex_str || 0).div(
            10 ** targetToken.decimals,
          ),
        )
      ) {
        // Insufficient balance
        putScreenState({
          balanceError: t('page.sendToken.balanceError.insufficientBalance'),
        });
      } else {
        putScreenState({ balanceError: null });
      }

      if (
        changedValues?.amount === undefined &&
        coerceNumber(resultAmount) === 0
      ) {
        resultAmount = '';
      }

      const nextFormValues = {
        ...currentValues,
        to: currentValues.to,
        amount: resultAmount,
      };

      // await persistPageStateCache({
      //   values: nextFormValues,
      //   currentToken: targetToken,
      // });
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
      // chainEnum,
      // gasPriceMap,
      // isNativeToken,
      // screenState.isGnosisSafe,
      screenState.cacheAmount,
      screenState.contactInfo,
      screenState.showGasReserved,
      formik,
      currentToken,
      putScreenState,
      t,
    ],
  );

  const handleFieldChange = useCallback(
    <T extends keyof FormSendToken>(
      f: T,
      value: FormSendToken[T],
      options?: {
        /** @description maybe bad practice? */
        __NO_TRIGGER_FORM_VALUESCHANGE_CALLBACK__?: boolean;
      },
    ) => {
      formik.setFieldValue(f, value);
      setFormValues(prev => ({ ...prev, [f]: value }));

      const nextVal = { ...formik.values, [f]: value };
      const { __NO_TRIGGER_FORM_VALUESCHANGE_CALLBACK__ = false } =
        options || {};
      if (!__NO_TRIGGER_FORM_VALUESCHANGE_CALLBACK__) {
        handleFormValuesChange({ [f]: value }, { currentPartials: nextVal });
      }
    },
    [formik, setFormValues, handleFormValuesChange],
  );

  const prepareDirectSubmitMiniTx = useMemoizedFn(async (ref: number) => {
    const chain = findChain({
      serverId: currentToken.chain,
    })!;

    const { to, amount, messageDataForSendToEoa, messageDataForContractCall } =
      formValues;

    const params = getParams({
      to: to,
      amount: amount,
      messageDataForSendToEoa: messageDataForSendToEoa,
      messageDataForContractCall: messageDataForContractCall,
    });
    if (isNativeToken) {
      // L2 has extra validation fee so we can not set gasLimit as 21000 when send native token
      const couldSpecifyIntrinsicGas =
        !CAN_NOT_SPECIFY_INTRINSIC_GAS_CHAINS.includes(chain.enum);

      try {
        const code = await apiProvider.requestETHRpc(
          {
            method: 'eth_getCode',
            params: [to, 'latest'],
          },
          chain.serverId,
          account,
        );
        const notContract = !!code && (code === '0x' || code === '0x0');
        let gasLimit = 0;

        if (screenState.estimatedGas) {
          gasLimit = screenState.estimatedGas;
        }

        /**
         * we dont' need always fetch estimatedGas, if no `params.gas` set below,
         * `params.gas` would be filled on Tx Page.
         */
        if (gasLimit > 0) {
          params.gas = intToHex(gasLimit);
        } else if (notContract && couldSpecifyIntrinsicGas) {
          params.gas = intToHex(DEFAULT_GAS_USED);
        }
        if (!notContract) {
          // not pre-set gasLimit if to address is contract address
          delete params.gas;
        }
      } catch (e) {
        if (couldSpecifyIntrinsicGas) {
          params.gas = intToHex(DEFAULT_GAS_USED);
        }
      }
      if (
        isShowMessageDataForToken &&
        (messageDataForContractCall || messageDataForSendToEoa)
      ) {
        delete params.gas;
      }
      if (screenState.showGasReserved) {
        params.gasPrice = screenState.selectedGasLevel?.price;
      }
    }

    if (
      ref === prepareCountRef.current &&
      isAccountSupportMiniApproval(currentAccount?.type || '') &&
      !chain.isTestnet
    ) {
      const res = await apiProvider.sendRequest(
        {
          data: {
            method: 'eth_sendTransaction',
            params: [params],
            $ctx: {
              ga: {
                category: 'Send',
                source: 'sendToken',
                toAddress,
                trigger: 'sendToken',
              },
            },
          },
          session: INTERNAL_REQUEST_SESSION,
          account,
        },
        true,
      );
      const tx = res.params?.[0];

      if (ref === prepareCountRef.current) {
        if (tx) {
          prefetchMiniSigner({
            txs: [tx],
            ga: {
              category: 'Send',
              source: 'sendToken',
              toAddress,
              trigger: 'sendToken',
            },
            checkGasFeeTooHigh: true,
            synGasHeaderInfo: true,
          });
          return tx as Tx;
        }
      }
    }
  });

  const [ignoreMiniSignGasFee, setIgnoreMiniSignGasFee] = useState(false);
  const handleIgnoreGasFeeChange = useCallback((b: boolean) => {
    setIgnoreMiniSignGasFee(b);
  }, []);

  const handleSubmit = useCallback(
    async ({
      to,
      amount,
      messageDataForSendToEoa,
      messageDataForContractCall,
      isForceSignTx,
    }: FormSendToken & {
      isForceSignTx?: boolean;
    }) => {
      sendTokenEventsRef.current.emit(SendTokenEvents.ON_SEND);
      putScreenState({ isSubmitLoading: true });
      const chain = findChain({
        serverId: currentToken.chain,
      })!;

      const params = getParams({
        to,
        amount,
        messageDataForSendToEoa,
        messageDataForContractCall,
      });
      const directSubmit =
        isAccountSupportMiniApproval(currentAccount?.type || '') &&
        !chain.isTestnet;
      if (isNativeToken && (!directSubmit || isForceSignTx)) {
        // L2 has extra validation fee so we can not set gasLimit as 21000 when send native token
        const couldSpecifyIntrinsicGas =
          !CAN_NOT_SPECIFY_INTRINSIC_GAS_CHAINS.includes(chain.enum);

        try {
          const code = await apiProvider.requestETHRpc(
            {
              method: 'eth_getCode',
              params: [to, 'latest'],
            },
            chain.serverId,
            account,
          );
          const notContract = !!code && (code === '0x' || code === '0x0');
          let gasLimit = 0;

          if (screenState.estimatedGas) {
            gasLimit = screenState.estimatedGas;
          }

          /**
           * we dont' need always fetch estimatedGas, if no `params.gas` set below,
           * `params.gas` would be filled on Tx Page.
           */
          if (gasLimit > 0) {
            params.gas = intToHex(gasLimit);
          } else if (notContract && couldSpecifyIntrinsicGas) {
            params.gas = intToHex(DEFAULT_GAS_USED);
          }
          if (!notContract) {
            // not pre-set gasLimit if to address is contract address
            delete params.gas;
          }
        } catch (e) {
          if (couldSpecifyIntrinsicGas) {
            params.gas = intToHex(DEFAULT_GAS_USED);
          }
        }
        if (
          isShowMessageDataForToken &&
          (messageDataForContractCall || messageDataForSendToEoa)
        ) {
          delete params.gas;
        }
        putScreenState({ isSubmitLoading: false });
        if (screenState.showGasReserved) {
          params.gasPrice = screenState.selectedGasLevel?.price;
        }
      }
      try {
        await preferenceService.setLastTimeSendToken(
          currentAccount!.address,
          currentToken,
        );
        // await persistPageStateCache();
        if (
          !isForceSignTx &&
          isAccountSupportMiniApproval(currentAccount?.type || '') &&
          !chain.isTestnet
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

              transactionHistoryService.addSendTxHistory({
                token: currentToken,
                amount: Number(amount),
                to,
                from: currentAccount?.address!,
                chainId: chain.id,
                hash: last(res) || '',
                address: currentAccount?.address!,
                status: 'pending',
                createdAt: Date.now(),
              });

              runFetchPendingCount();
              runFetchLocalPendingTx();
              handleFieldChange('amount', '');
              sendTokenEventsRef.current.emit(
                SendTokenEvents.ON_SIGNED_SUCCESS,
              );
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
                  messageDataForSendToEoa,
                  messageDataForContractCall,
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

          return;
        } else {
          await apiProvider
            .sendRequest({
              data: {
                method: 'eth_sendTransaction',
                params: [params],
                $ctx: {
                  ga: {
                    category: 'Send',
                    source: 'sendToken',
                    toAddress,
                    // trigger: filterRbiSource('sendToken', rbisource) && rbisource, // mark source module of `sendToken`
                    trigger: 'sendToken',
                  },
                },
              },
              session: INTERNAL_REQUEST_SESSION,
              account,
            })
            .then(resp => {
              const hash = resp as string;
              console.debug('hash', hash);
              currentAccount.type !== KEYRING_CLASS.GNOSIS &&
                transactionHistoryService.addSendTxHistory({
                  token: currentToken,
                  amount: Number(amount),
                  to,
                  from: currentAccount?.address!,
                  chainId: chain.id,
                  hash,
                  address: currentAccount?.address!,
                  status: 'pending',
                  createdAt: Date.now(),
                });

              runFetchPendingCount();
              runFetchLocalPendingTx();
              handleFieldChange('amount', '');
              sendTokenEventsRef.current.emit(
                SendTokenEvents.ON_SIGNED_SUCCESS,
              );
            })
            .catch(err => {
              console.error(err);
              // toast.info(err.message);
            });
        }
      } catch (e: any) {
        Alert.alert(e.message);
        console.error(e);
      } finally {
        putScreenState({ isSubmitLoading: false });
      }
    },
    [
      ignoreMiniSignGasFee,
      prefetchMiniSigner,
      putScreenState,
      currentToken,
      getParams,
      currentAccount,
      isNativeToken,
      isShowMessageDataForToken,
      screenState.showGasReserved,
      screenState.estimatedGas,
      screenState.selectedGasLevel?.price,
      account,
      prepareDirectSubmitMiniTx,
      openDirect,
      runFetchPendingCount,
      runFetchLocalPendingTx,
      handleFieldChange,
      toAddress,
    ],
  );

  // useEffect(() => {
  //   toAddress && handleFieldChange('to', toAddress);
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [toAddress]);

  const estimateGasOnChain = useCallback(
    async (input?: {
      chainItem?: Chain | null;
      tokenItem?: TokenItem;
      currentAddress?: string;
    }) => {
      const result = { gasNumber: 0 };

      const doReturn = (nextGas = DEFAULT_GAS_USED) => {
        result.gasNumber = nextGas;

        putScreenState({ estimatedGas: result.gasNumber });
        return result;
      };

      const {
        chainItem: lastestChainItem = chainItem,
        tokenItem = currentToken,
        currentAddress = currentAccount?.address,
      } = input || {};

      if (!lastestChainItem?.needEstimateGas) {
        return doReturn(DEFAULT_GAS_USED);
      }
      if (!currentAddress) {
        return doReturn();
      }

      if (lastestChainItem.serverId !== tokenItem.chain) {
        console.warn(
          'estimateGasOnChain:: chain not matched!',
          lastestChainItem,
          tokenItem,
        );
        return result;
      }

      const to = formik.values.to;

      let _gasUsed: string = intToHex(DEFAULT_GAS_USED);
      try {
        _gasUsed = await apiProvider.requestETHRpc<string>(
          {
            method: 'eth_estimateGas',
            params: [
              {
                from: currentAddress,
                to: to && isValidAddress(to) ? to : zeroAddress(),
                gasPrice: intToHex(0),
                value: intToHex(0),
              },
            ],
          },
          lastestChainItem.serverId,
          account,
        );
      } catch (err) {
        console.error(err);
      }
      const gasUsed = new BigNumber(_gasUsed)
        .multipliedBy(1.5)
        .integerValue()
        .toNumber();

      return doReturn(Number(gasUsed));
    },
    [
      chainItem,
      currentToken,
      currentAccount?.address,
      formik.values.to,
      putScreenState,
      account,
    ],
  );

  const loadCurrentToken = useCallback(
    async (
      id: string,
      chainId: string,
      currentAddress: string,
      disableBalanceCheck?: boolean,
    ) => {
      const chain = findChain({
        serverId: chainId,
      });
      let result: TokenItem | null = null;
      if (chain?.isTestnet) {
        const res = await apiCustomTestnet.getCustomTestnetToken({
          address: currentAddress,
          chainId: chain.id,
          tokenId: id,
        });
        if (res) {
          result = customTestnetTokenToTokenItem(res);
        }
      } else {
        result = await openapi.getToken(currentAddress, chainId, id);
      }
      if (result) {
        estimateGasOnChain({
          chainItem: chain,
          tokenItem: result,
          currentAddress,
        });
        setRouteParams(pre => ({
          ...pre,
          tokenId: id,
        }));
        putChainToken({ currentToken: { ...result, tokenId: id } });
        putScreenState(prev => ({
          agreeRequiredChecks: {
            ...prev.agreeRequiredChecks,
            forToken: false,
          },
        }));
      }
      putScreenState({ isLoading: false });

      if (
        !disableBalanceCheck &&
        new BigNumber(formValues.amount || 0).isGreaterThan(
          new BigNumber(result?.raw_amount_hex_str || 0).div(
            10 ** (result?.decimals || 18),
          ),
        )
      ) {
        // Insufficient balance
        putScreenState({
          balanceError: t('page.sendToken.balanceError.insufficientBalance'),
        });
      } else {
        putScreenState({ balanceError: null });
      }

      return result;
    },
    [
      putScreenState,
      formValues.amount,
      estimateGasOnChain,
      setRouteParams,
      putChainToken,
      t,
    ],
  );

  const couldReserveGas = isNativeToken && !screenState.isGnosisSafe;

  const onGasChange = useCallback(
    ({
      gasLevel,
      updateTokenAmount = true,
      gasLimit = MINIMUM_GAS_LIMIT,
    }: {
      gasLevel: GasLevel;
      updateTokenAmount?: boolean;
      gasLimit?: number;
    }) => {
      const nextPartials = {} as Partial<SendScreenState>;
      nextPartials.selectedGasLevel = gasLevel;
      const gasTokenAmount = new BigNumber(gasLevel.price)
        .times(gasLimit)
        .div(1e18);
      nextPartials.tokenAmountForGas = gasTokenAmount.toFixed();
      putScreenState(nextPartials);

      if (updateTokenAmount && currentToken) {
        const diffValue = new BigNumber(currentToken.raw_amount_hex_str || 0)
          .div(10 ** currentToken.decimals)
          .minus(gasTokenAmount);

        if (diffValue.lt(0)) {
          putScreenState({ showGasReserved: false });
        }
        const amount = diffValue.gt(0) ? diffValue.toFixed() : '0';
        handleFieldChange('amount', amount, {
          __NO_TRIGGER_FORM_VALUESCHANGE_CALLBACK__: true,
        });
      }

      return gasTokenAmount;
    },
    [currentToken, handleFieldChange, putScreenState],
  );

  const handleMaxInfoChanged = useCallback(
    async (input?: { gasLevel: GasLevel }) => {
      if (!currentAccount) {
        return;
      }

      if (screenState.isLoading) {
        return;
      }
      if (screenState.isEstimatingGas) {
        return;
      }

      const tokenBalance = new BigNumber(
        currentToken.raw_amount_hex_str || 0,
      ).div(10 ** currentToken.decimals);
      let amount = tokenBalance.toFixed();
      const to = formik.values.to;

      const {
        gasLevel = screenState.selectedGasLevel ||
          (await loadGasListAndResolve().then(
            result => result.instantGasLevel,
          )),
      } = input || {};
      const needReserveGasOnSendToken = !!gasLevel && gasLevel?.price > 0;

      if (couldReserveGas && needReserveGasOnSendToken) {
        putScreenState({ showGasReserved: true, isEstimatingGas: true });
        try {
          const { gasNumber } = await estimateGasOnChain({
            chainItem,
            tokenItem: currentToken,
          });

          let gasTokenAmount = onGasChange({
            gasLevel: gasLevel,
            updateTokenAmount: false,
            gasLimit: gasNumber,
          });
          if (
            chainItem &&
            CAN_ESTIMATE_L1_FEE_CHAINS.includes(chainItem.enum)
          ) {
            const l1GasFee = await apiProvider.fetchEstimatedL1Fee(
              {
                txParams: {
                  chainId: chainItem.id,
                  from: currentAccount.address,
                  to: to && isValidAddress(to) ? to : zeroAddress(),
                  value: currentToken.raw_amount_hex_str,
                  gas: intToHex(DEFAULT_GAS_USED),
                  gasPrice: `0x${new BigNumber(gasLevel.price).toString(16)}`,
                  data: '0x',
                },
                account,
              },
              chainItem.enum,
            );
            gasTokenAmount = gasTokenAmount
              .plus(new BigNumber(l1GasFee).div(1e18))
              .times(1.1);
          }
          const tokenForSend = tokenBalance.minus(gasTokenAmount);
          amount = tokenForSend.gt(0) ? tokenForSend.toFixed() : '0';
          if (tokenForSend.lt(0)) {
            putScreenState({ showGasReserved: false });
          }
        } catch (e) {
          if (!screenState.isGnosisSafe) {
            // // Gas fee reservation required
            // setBalanceWarn(t('page.sendToken.balanceWarn.gasFeeReservation'));
            putScreenState({ showGasReserved: false });
          }
        } finally {
          putScreenState({ isEstimatingGas: false });
        }
      }

      const newValues = {
        ...formik.values,
        amount,
      };
      patchFormValues(newValues);
    },
    [
      currentAccount,
      screenState.isLoading,
      screenState.isEstimatingGas,
      screenState.selectedGasLevel,
      screenState.isGnosisSafe,
      currentToken,
      formik.values,
      loadGasListAndResolve,
      couldReserveGas,
      patchFormValues,
      putScreenState,
      estimateGasOnChain,
      chainItem,
      onGasChange,
      account,
    ],
  );
  const handleGasLevelChanged = useCallback(
    async (gl?: GasLevel | null) => {
      let gasLevel = gl
        ? gl
        : await loadGasListAndResolve().then(
            result => result.normalGasLevel || result.instantGasLevel,
          );

      if (gasLevel) {
        putScreenState({ reserveGasOpen: false, selectedGasLevel: gasLevel });
        handleMaxInfoChanged({ gasLevel });
      } else {
        putScreenState({ reserveGasOpen: false });
      }
    },
    [putScreenState, handleMaxInfoChanged, loadGasListAndResolve],
  );

  const handleSlider100 = useCallback(async () => {
    if (currentToken && couldReserveGas) {
      if (screenState.gasList) {
        const gasLevel = screenState.gasList.find(e => e.level === 'fast');
        if (gasLevel) {
          putScreenState({ selectedGasLevel: gasLevel });
          handleMaxInfoChanged({ gasLevel });
        } else {
          patchFormValues({ amount: tokenAmountBn(currentToken).toString(10) });
        }
      } else {
        patchFormValues({ amount: tokenAmountBn(currentToken).toString(10) });
      }
    } else {
      patchFormValues({ amount: tokenAmountBn(currentToken).toString(10) });
    }
  }, [
    currentToken,
    couldReserveGas,
    patchFormValues,
    putScreenState,
    handleMaxInfoChanged,
    screenState,
  ]);

  const handleClickMaxButton = useCallback(async () => {
    putScreenState(prev => ({ ...prev, clickedMax: true }));

    handleSlider100();
    // if (couldReserveGas) {
    //   putScreenState({ reserveGasOpen: true });
    // } else {
    //   handleMaxInfoChanged();
    // }
  }, [putScreenState, handleSlider100]);

  const {
    onChangeSlider,
    slider,
    setSlider,
    isDraggingSlider,
    setIsDraggingSlider,
  } = useSwapBridgeSlider({
    setAmount: (amount: string) => {
      patchFormValues({ amount });
    },
    fromToken: currentToken,
    handleSlider100: handleSlider100,
  });

  const handleCurrentTokenChange = useCallback(
    async (token: TokenItem) => {
      if (screenState.showGasReserved) {
        putScreenState({ showGasReserved: false });
      }
      if (!account) {
        console.error('[handleCurrentTokenChange] no account');
      }
      const newToken =
        token.id !== currentToken.id || token.chain !== currentToken.chain;
      if (newToken) {
        patchFormValues({
          amount: '',
        });
        setSlider(0);
        setIsDraggingSlider(false);
      }
      const nextChainItem = findChainByServerID(token.chain);
      putChainToken({
        chainEnum: nextChainItem?.enum ?? CHAINS_ENUM.ETH,
        currentToken: token,
      });
      setRouteParams(pre => ({
        ...pre,
        chainEnum: nextChainItem?.enum ?? CHAINS_ENUM.ETH,
        tokenId: token.id,
      }));
      putScreenState({
        estimatedGas: 0,
      });

      // await persistPageStateCache({ currentToken: token });

      putScreenState({
        balanceError: null,
        balanceWarn: null,
        isLoading: true,
      });

      if (account) {
        await loadCurrentToken(
          token.id,
          token.chain,
          account.address,
          newToken,
        );
      }
    },
    [
      screenState.showGasReserved,
      account,
      currentToken.id,
      currentToken.chain,
      putChainToken,
      setRouteParams,
      putScreenState,
      patchFormValues,
      loadCurrentToken,
      setSlider,
      setIsDraggingSlider,
    ],
  );

  const checkCexSupport = useCallback(
    async (token: TokenItem) => {
      const { reason } = disableItemCheck?.(token) || {};
      const confirmCallback = () => {
        if (!isForMultipleAddress) {
          handleCurrentTokenChange(token);
        } else {
          const { accountSwitchTo } = switchAccountOnSelectedToken({
            token,
            currentAccount,
          });
          if (!accountSwitchTo) {
            handleCurrentTokenChange(token);
          } else {
            const currChainItem = findChainByServerID(token.chain);
            naviReplace(RootNames.StackTransaction, {
              screen: RootNames.Send,
              params: {
                ...(multiNavParams || {}),
                chainEnum: currChainItem?.enum,
                tokenId: token.id,
              },
            });
          }
        }
      };
      if (toAddress && reason) {
        Alert.alert(reason, '', [
          {
            text: t('page.sendToken.noSupportBtns.cancel'),
            style: 'cancel',
          },
          {
            text: t('page.sendToken.noSupportBtns.confirm'),
            onPress: confirmCallback,
          },
        ]);
        return;
      }
      confirmCallback();
    },
    [
      currentAccount,
      disableItemCheck,
      handleCurrentTokenChange,
      isForMultipleAddress,
      multiNavParams,
      switchAccountOnSelectedToken,
      t,
      toAddress,
    ],
  );

  const handleChainChanged = useCallback(
    async (val: CHAINS_ENUM) => {
      putScreenState(prev => ({ ...prev, clickedMax: false }));
      // fallback to eth, but we don't expect this to happen
      const chain = findChainByEnum(val, { fallback: true })!;
      setRouteParams(pre => ({
        ...pre,
        chainEnum: val,
        tokenId: chain.nativeTokenAddress,
      }));

      putChainToken({
        chainEnum: val,
        currentToken: {
          id: chain.nativeTokenAddress,
          decimals: chain.nativeTokenDecimals,
          logo_url: chain.nativeTokenLogo,
          symbol: chain.nativeTokenSymbol,
          display_symbol: chain.nativeTokenSymbol,
          optimized_symbol: chain.nativeTokenSymbol,
          is_core: true,
          is_verified: true,
          is_wallet: true,
          cex_ids: [],
          amount: 0,
          price: 0,
          name: chain.nativeTokenSymbol,
          chain: chain.serverId,
          time_at: 0,
        },
      });
      putScreenState({ estimatedGas: 0 });

      let nextToken: TokenItem | null = null;
      try {
        nextToken = await loadCurrentToken(
          chain.nativeTokenAddress,
          chain.serverId,
          account.address,
        );
      } catch (error) {
        console.error(error);
      }

      patchFormValues({
        amount: '',
      });
      setSlider(0);
      setIsDraggingSlider(false);
      putScreenState({ showGasReserved: false });
      handleFormValuesChange(
        { amount: '' },
        {
          currentPartials: { amount: '' },
          ...(nextToken && { token: nextToken }),
        },
      );
    },
    [
      putScreenState,
      setRouteParams,
      putChainToken,
      patchFormValues,
      handleFormValuesChange,
      loadCurrentToken,
      account.address,
      setSlider,
      setIsDraggingSlider,
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
      toAddressIsCex:
        !!screenState.toAddrDesc?.cex?.id &&
        !!screenState.toAddrDesc?.cex?.is_deposit,
      toAddressInContactBook: isAddrOnContactBook(formValues.to),
      toAddressPositiveTips: toAddressPositiveTips,

      toAddrCex: cexList.find(
        item => item.id === screenState.toAddrDesc?.cex?.id,
      ),

      canSubmit:
        isValidAddress(formValues.to) &&
        !screenState.balanceError &&
        new BigNumber(formValues.amount).gte(0) &&
        !screenState.isLoading,

      canDirectSign:
        isAccountSupportMiniApproval(currentAccount?.type || '') &&
        !chainItem?.isTestnet,
    };
  }, [
    whitelist,
    formValues.to,
    toAccount,
    toAddressIsRecentlySend,
    foundToAccountInfo?.isMyImported,
    formValues.amount,
    cexList,
    isAddrOnContactBook,
    screenState.toAddrDesc,
    screenState.balanceError,
    screenState.isLoading,
    currentAccount?.type,
    chainItem?.isTestnet,
  ]);

  const resetFormValues = useCallback(() => {
    setFormValues({ ...DF_SEND_TOKEN_FORM });
    formik.resetForm();
  }, [setFormValues, formik]);

  const refreshCurrentToken = useMemoizedFn(async () => {
    return loadCurrentToken(
      currentToken.id,
      currentToken.chain,
      currentAccount!.address,
    );
  });

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
    stableAmountValue,
    formValues.messageDataForSendToEoa,
    formValues.messageDataForContractCall,
    currentAccount?.type,
    chainItem?.isTestnet,
    toAddress,
    account,
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
    formValues.messageDataForSendToEoa,
    formValues.messageDataForContractCall,
    currentAccount?.type,
    prepareDirectSubmitMiniTx,
  ]);

  useFocusEffect(
    useCallback(() => {
      eventBus.addListener(EVENTS.RELOAD_TX, refreshCurrentToken);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refreshCurrentToken);
      };
    }, [refreshCurrentToken]),
  );

  return {
    chainEnum,
    chainItem,
    handleChainChanged,

    currentToken,
    loadCurrentToken,
    checkCexSupport,
    handleCurrentTokenChange,

    handleGasLevelChanged,
    handleClickMaxButton,
    handleIgnoreGasFeeChange,
    onChangeSlider,
    setSlider,
    slider,

    sendTokenEvents: sendTokenEventsRef.current,
    formik,
    formValues,
    resetFormValues,
    handleFieldChange,
    patchFormValues,
    handleFormValuesChange,

    whitelist,
    whitelistEnabled,
    computed,
  };
}
export function useSendTokenFormikContext() {
  return useFormikContext<FormSendToken>();
}

export function useSendTokenFormik() {
  const { formik } = useSendTokenInternalContext();

  return formik;
}

type FoundAccountResult = IExtractFromPromise<
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
  formValues: FormSendToken;
  computed: {
    fromAddress: string;
    chainItem: Chain | null;
    currentToken: TokenItem | null;
    currentTokenBalance: string;
    whitelistEnabled: boolean;
    canSubmit: boolean;
    canDirectSign: boolean;
    toAccount: FoundAccountResult['account'] | null;
    toAddressIsCex: boolean;
    toAddressInContactBook: boolean;
    toAddressPositiveTips: ToAddressPositiveTips | null;
    toAddrCex: null | undefined | ProjectItem;
  };

  formik: ReturnType<typeof useSendTokenFormikContext>;
  events: EventEmitter;
  slider: number;
  fns: {
    putScreenState: (
      patch:
        | Partial<SendScreenState>
        | ((prev: SendScreenState) => Partial<SendScreenState>),
    ) => void;
    fetchContactAccounts: () => void;
    disableItemCheck: ITokenCheck;
  };
  callbacks: {
    handleCurrentTokenChange: (token: TokenItem) => void;
    checkCexSupport: (token: TokenItem) => void;
    handleFieldChange: <T extends keyof FormSendToken>(
      f: T,
      value: FormSendToken[T],
    ) => void;
    handleGasLevelChanged: (gl?: GasLevel | null) => Promise<void> | void;
    handleClickMaxButton: () => Promise<void> | void;
    handleIgnoreGasFeeChange: (b: boolean) => void;
    // onGasChange: (input: {
    //   gasLevel: GasLevel;
    //   updateTokenAmount?: boolean;
    //   gasLimit?: number;
    // }) => void;
    // onFormValuesChange: (changedValues: Partial<FormSendToken>) => void;
    onChangeSlider: (v: number, syncAmount?: boolean) => void;
    setSlider: (v: number) => void;
  };
};
const SendTokenInternalContext = React.createContext<InternalContext>({
  screenState: { ...DFLT_SEND_STATE },
  formValues: { ...DF_SEND_TOKEN_FORM },
  computed: {
    fromAddress: '',
    chainItem: null,
    currentToken: null,
    currentTokenBalance: '',
    whitelistEnabled: false,
    canSubmit: false,
    toAccount: null,
    toAddressIsCex: false,
    toAddressInContactBook: false,
    toAddressPositiveTips: null,
    canDirectSign: false,

    toAddrCex: null,
  },

  formik: null as any,
  events: null as any,
  slider: 0,
  fns: {
    putScreenState: () => {},
    fetchContactAccounts: () => {},
    disableItemCheck: () => ({
      disable: false,
      reason: '',
      simpleReason: '',
    }),
  },
  callbacks: {
    handleCurrentTokenChange: () => {},
    checkCexSupport: () => {},
    handleFieldChange: () => {},
    handleGasLevelChanged: () => {},
    handleClickMaxButton: () => {},
    handleIgnoreGasFeeChange: () => {},
    onChangeSlider: () => {},
    setSlider: () => {},
  },
});

export const SendTokenInternalContextProvider =
  SendTokenInternalContext.Provider;

export function useSendTokenInternalContext() {
  return React.useContext(SendTokenInternalContext);
}

export function subscribeEvent<T extends SendTokenEvents>(
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
  const { events } = useSendTokenInternalContext();
  useEffect(() => {
    const disposeRets = [] as Function[];
    subscribeEvent(
      events,
      SendTokenEvents.ON_PRESS_DISMISS,
      () => {
        inputRef.current?.blur();
      },
      { disposeRets },
    );

    subscribeEvent(
      events,
      SendTokenEvents.ON_SEND,
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
