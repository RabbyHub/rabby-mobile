import React, { useMemo, useCallback, useRef } from 'react';
import * as Yup from 'yup';
import { intToHex } from '@ethereumjs/util';

import { preferenceService } from '@/core/services';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, Chain, formatTokenAmount } from '@debank/common';
import { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { openapi } from '@/core/request';
import { TFunction } from 'i18next';
import { isValidAddress } from '@ethereumjs/util';
import BigNumber from 'bignumber.js';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useContactAccounts } from '@/hooks/contact';
import { useAlias } from '@/hooks/alias';
import { UIContactBookItem } from '@/core/apis/contact';
import { ChainGas } from '@/core/services/preference';
import { useTranslation } from 'react-i18next';
import { apiContact, apiProvider } from '@/core/apis';
import { formatUsdValue } from '@/utils/number';
import { useFormik, useFormikContext } from 'formik';
import { useCurrentAccount } from '@/hooks/account';
import { useCheckAddressType } from '@/hooks/useParseAddress';
import { formatTxInputDataOnERC20 } from '@/utils/transaction';
import { ARB_LIKE_L2_CHAINS } from '@/constant/gas';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { abiCoder } from '@/core/apis/sendRequest';
import { Alert } from 'react-native';
import { devLog } from '@/utils/logger';

function makeDefaultToken(): TokenItem {
  return {
    id: 'eth',
    chain: 'eth',
    name: 'ETH',
    symbol: 'ETH',
    display_symbol: null,
    optimized_symbol: 'ETH',
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

const sendTokenScreenChainTokenAtom = atom({
  chainEnum: CHAINS_ENUM.ETH,
  currentToken: makeDefaultToken(),
});
export function useSendTokenScreenChainToken() {
  const [chainToken, _setChainToken] = useAtom(sendTokenScreenChainTokenAtom);
  const { chainEnum, currentToken } = chainToken;

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

  const { chainItem, isNativeToken } = useMemo(() => {
    const item = findChainByEnum(chainEnum);
    const isNativeToken =
      !!chainItem && currentToken?.id === chainItem.nativeTokenAddress;

    return {
      chainItem: item,
      isNativeToken,
    };
  }, [chainEnum, currentToken?.id]);
  const { putScreenState } = useSendTokenScreenState();

  const loadCurrentToken = useCallback(
    async (id: string, chainId: string, address: string) => {
      const t = await openapi.getToken(address, chainId, id);
      if (t) {
        putChainToken({ currentToken: t });
      }
      putScreenState({ isLoading: false });

      return t;
    },
    [putChainToken, putScreenState],
  );

  const setChainEnum = useCallback(
    (chain: CHAINS_ENUM) => {
      putChainToken({ chainEnum: chain });
    },
    [putChainToken],
  );

  const setCurrentToken = useCallback(
    (token: TokenItem) => {
      putChainToken({ currentToken: token });
    },
    [putChainToken],
  );

  const { currentTokenBalance, currentTokenPrice } = useMemo(() => {
    return {
      currentTokenBalance: formatTokenAmount(
        new BigNumber(currentToken.raw_amount_hex_str || 0)
          .div(10 ** currentToken.decimals)
          .toFixed(),
        4,
      ),
      currentTokenPrice: formatUsdValue(currentToken.price),
    };
  }, [currentToken]);

  return {
    putChainToken,
    chainItem,
    isNativeToken,

    chainEnum,
    setChainEnum,

    currentToken,
    setCurrentToken,
    loadCurrentToken,
    currentTokenBalance,
    currentTokenPrice,
  };
}
export type SendScreenState = {
  inited: boolean;

  showContactInfo: boolean;
  contactInfo: null | UIContactBookItem;

  showEditContactModal: boolean;
  showListContactModal: boolean;

  editBtnDisabled: boolean;
  cacheAmount: string;
  showWhitelistAlert: boolean;
  showGasReserved: boolean;
  balanceError: string | null;
  balanceWarn: string | null;
  isLoading: boolean;
  isSubmitLoading: boolean;
  estimateGas: number;
  temporaryGrant: boolean;
  gasList: GasLevel[];
  gasPriceMap: Record<string, { list: GasLevel[]; expireAt: number }>;
  gasSelectorVisible: boolean;
  selectedGasLevel: GasLevel | null;
  isGnosisSafe: boolean;

  safeInfo: {
    chainId: number;
    nonce: number;
  } | null;
};
const DFLT_SEND_STATE = {
  inited: false,

  showContactInfo: false,
  contactInfo: null,

  showEditContactModal: false,
  showListContactModal: false,

  editBtnDisabled: false,
  cacheAmount: '0',
  showWhitelistAlert: false,
  showGasReserved: false,
  balanceError: null,
  balanceWarn: null,
  isLoading: false,
  isSubmitLoading: false,
  estimateGas: 0,
  temporaryGrant: false,
  gasList: [],
  gasPriceMap: {},
  gasSelectorVisible: false,
  selectedGasLevel: null,
  isGnosisSafe: false,

  safeInfo: null,
};
const sendTokenScreenStateAtom = atom<SendScreenState>({ ...DFLT_SEND_STATE });
export function useSendTokenScreenState() {
  const [sendTokenScreenState, setSendScreenState] = useAtom(
    sendTokenScreenStateAtom,
  );

  const putScreenState = useCallback(
    (patch: Partial<SendScreenState>) => {
      setSendScreenState(prev => ({
        ...prev,
        ...patch,
      }));
    },
    [setSendScreenState],
  );

  return {
    sendTokenScreenState,
    putScreenState,
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
          if (!value) return true;

          if (value && isValidAddress(value)) return true;

          return false;
        },
      ),
  });

  return SendTokenSchema;
}

function calcGasCost({
  chainEnum,
  gasPriceMap,
}: {
  chainEnum: CHAINS_ENUM;
  gasPriceMap: Record<string, { list: GasLevel[]; expireAt: number }>;
}) {
  const targetChain = findChainByEnum(chainEnum)!;
  const gasList = gasPriceMap[targetChain.enum]?.list;

  if (!gasList) return new BigNumber(0);

  const lastTimeGas: ChainGas | null =
    preferenceService.getLastTimeGasSelection(targetChain.id);

  let gasLevel: GasLevel;
  if (lastTimeGas?.lastTimeSelect === 'gasPrice' && lastTimeGas.gasPrice) {
    // use cached gasPrice if exist
    gasLevel = {
      level: 'custom',
      price: lastTimeGas.gasPrice,
      front_tx_count: 0,
      estimated_seconds: 0,
      base_fee: 0,
      priority_price: null,
    };
  } else if (
    lastTimeGas?.lastTimeSelect &&
    lastTimeGas?.lastTimeSelect === 'gasLevel'
  ) {
    const target = gasList.find(item => item.level === lastTimeGas?.gasLevel)!;
    gasLevel = target;
  } else {
    // no cache, use the fast level in gasMarket
    gasLevel = gasList.find(item => item.level === 'fast')!;
  }
  const costTokenAmount = new BigNumber(gasLevel.price).times(21000).div(1e18);
  return costTokenAmount;
}

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
const sendTokenScreenFormAtom = atom<FormSendToken>({ ...DF_SEND_TOKEN_FORM });
export function useSendTokenForm() {
  const { t } = useTranslation();

  const { currentAccount } = useCurrentAccount();

  const {
    chainEnum,
    isNativeToken,
    currentToken,
    putChainToken,
    chainItem,
    loadCurrentToken,
  } = useSendTokenScreenChainToken();

  const { sendTokenScreenState: screenState, putScreenState } =
    useSendTokenScreenState();
  const { gasPriceMap } = screenState;

  const [formValues, setFormValues] = useAtom(sendTokenScreenFormAtom);
  // const [ formValues, setFormValues ] = React.useState<FormSendToken>({ ...DF_SEND_TOKEN_FORM });

  const { validationSchema } = useMemo(() => {
    return {
      validationSchema: makeSendTokenValidationSchema({ t }),
    };
  }, [t]);

  const { addressType } = useCheckAddressType(formValues.to, chainItem);

  const { isShowMessageDataForToken, isShowMessageDataForContract } =
    useMemo(() => {
      return {
        isShowMessageDataForToken: isNativeToken && addressType === 'EOA',
        isShowMessageDataForContract:
          isNativeToken && addressType === 'CONTRACT',
      };
    }, [isNativeToken, addressType]);

  const handleSubmit = useCallback(
    async ({
      to,
      amount,
      messageDataForSendToEoa,
      messageDataForContractCall,
    }: FormSendToken) => {
      putScreenState({ isSubmitLoading: true });
      const chain = findChainByServerID(currentToken.chain)!;
      const sendValue = new BigNumber(amount)
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
        try {
          const code = await apiProvider.requestETHRpc(
            {
              method: 'eth_getCode',
              params: [to, 'latest'],
            },
            chain.serverId,
          );
          if (screenState.estimateGas > 0) {
            params.gas = intToHex(screenState.estimateGas);
          } else if (
            code &&
            (code === '0x' || code === '0x0') &&
            !ARB_LIKE_L2_CHAINS.includes(chain.enum)
          ) {
            params.gas = intToHex(21000); // L2 has extra validation fee so can not set gasLimit as 21000 when send native token
          }
        } catch (e) {
          if (!ARB_LIKE_L2_CHAINS.includes(chain.enum)) {
            params.gas = intToHex(21000); // L2 has extra validation fee so can not set gasLimit as 21000 when send native token
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
        // await preferenceService.setLastTimeSendToken(currentAccount!.address, currentToken);
        // await persistPageStateCache();

        apiProvider.sendRequest(
          {
            method: 'eth_sendTransaction',
            params: [params],
            $ctx: {
              // ga: {
              //   category: 'Send',
              //   source: 'sendToken',
              //   trigger: filterRbiSource('sendToken', rbisource) && rbisource, // mark source module of `sendToken`
              // },
            },
          },
          INTERNAL_REQUEST_SESSION,
        );
        // window.close();
      } catch (e: any) {
        Alert.alert(e.message);
        console.error(e);
      }
    },
    [
      currentAccount,
      currentToken.chain,
      currentToken.decimals,
      currentToken.id,
      isNativeToken,
      isShowMessageDataForContract,
      isShowMessageDataForToken,
      putScreenState,
      screenState.estimateGas,
      screenState.safeInfo?.nonce,
      screenState.selectedGasLevel?.price,
      screenState.showGasReserved,
    ],
  );

  const formik = useFormik({
    initialValues: formValues,
    validationSchema,
    onSubmit: values => {
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
        isInUpdate?: boolean;
      },
    ) => {
      let { currentPartials } = opts || {};
      const currentValues = {
        ...formik.values,
        ...currentPartials,
      };

      const sendScreenStatePatch = {} as Partial<SendScreenState>;
      const { token, isInitFromCache } = opts || {};
      if (changedValues && changedValues.to) {
        sendScreenStatePatch.temporaryGrant = false;
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
        sendScreenStatePatch.editBtnDisabled = true;
        sendScreenStatePatch.showWhitelistAlert = false;
      } else {
        sendScreenStatePatch.showWhitelistAlert = true;
        sendScreenStatePatch.editBtnDisabled = false;
      }
      let resultAmount = currentValues.amount;
      if (!/^\d*(\.\d*)?$/.test(currentValues.amount)) {
        resultAmount = screenState.cacheAmount;
      }

      if (currentValues.amount !== screenState.cacheAmount) {
        if (screenState.showGasReserved && Number(resultAmount) > 0) {
          sendScreenStatePatch.showGasReserved = false;
        } else if (isNativeToken && !screenState.isGnosisSafe) {
          const gasCostTokenAmount = calcGasCost({ chainEnum, gasPriceMap });
          if (
            new BigNumber(targetToken.raw_amount_hex_str || 0)
              .div(10 ** targetToken.decimals)
              .minus(currentValues.amount)
              .minus(gasCostTokenAmount)
              .lt(0)
          ) {
            sendScreenStatePatch.balanceWarn = t(
              'page.sendToken.balanceWarn.gasFeeReservation',
            );
          } else {
            sendScreenStatePatch.balanceWarn = null;
          }
        }
      }

      if (
        new BigNumber(resultAmount || 0).isGreaterThan(
          new BigNumber(targetToken.raw_amount_hex_str || 0).div(
            10 ** targetToken.decimals,
          ),
        )
      ) {
        // Insufficient balance
        sendScreenStatePatch.balanceError = t(
          'page.sendToken.balanceError.insufficientBalance',
        );
      } else {
        sendScreenStatePatch.balanceError = null;
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

      sendScreenStatePatch.cacheAmount = resultAmount;
      const aliasName = apiContact.getAliasName(currentValues.to.toLowerCase());
      if (aliasName) {
        sendScreenStatePatch.contactInfo = {
          address: currentValues.to,
          name: aliasName,
        };
        sendScreenStatePatch.showContactInfo = true;
      } else if (screenState.contactInfo) {
        sendScreenStatePatch.contactInfo = null;
      }

      putScreenState(sendScreenStatePatch);

      return nextFormValues;
    },
    [
      chainEnum,
      screenState.cacheAmount,
      screenState.contactInfo,
      screenState.isGnosisSafe,
      screenState.showGasReserved,
      formik,
      currentToken,
      gasPriceMap,
      isNativeToken,
      putScreenState,
      t,
    ],
  );

  const handleFieldChange = useCallback(
    <T extends keyof FormSendToken>(f: T, value: FormSendToken[T]) => {
      formik.setFieldValue(f, value);
      setFormValues(prev => ({ ...prev, [f]: value }));

      const nextVal = { ...formik.values, [f]: value };
      handleFormValuesChange({ [f]: value }, { currentPartials: nextVal });
    },
    [formik, setFormValues, handleFormValuesChange],
  );

  const handleCurrentTokenChange = useCallback(
    async (token: TokenItem) => {
      if (screenState.showGasReserved) {
        putScreenState({ showGasReserved: false });
      }
      const account = preferenceService.getCurrentAccount();
      if (!account) {
        console.error('[handleCurrentTokenChange] no account');
      }
      if (token.id !== currentToken.id || token.chain !== currentToken.chain) {
        patchFormValues({
          amount: '',
        });
      }
      const nextChainItem = findChainByServerID(token.chain);
      putChainToken({
        chainEnum: nextChainItem?.enum ?? CHAINS_ENUM.ETH,
        currentToken: token,
      });

      // await persistPageStateCache({ currentToken: token });

      putScreenState({
        balanceError: null,
        balanceWarn: null,
        isLoading: true,
      });

      if (account) {
        await loadCurrentToken(token.id, token.chain, account.address);
      }
    },
    [
      screenState.showGasReserved,
      currentToken.chain,
      currentToken.id,
      loadCurrentToken,
      patchFormValues,
      putChainToken,
      putScreenState,
    ],
  );

  const handleChainChanged = useCallback(
    async (val: CHAINS_ENUM) => {
      const account = preferenceService.getCurrentAccount()!;
      // fallback to eth, but we don't expect this to happen
      const chain = findChainByEnum(val) || findChainByEnum(CHAINS_ENUM.ETH)!;

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
          amount: 0,
          price: 0,
          name: chain.nativeTokenSymbol,
          chain: chain.serverId,
          time_at: 0,
        },
      });

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
      putChainToken,
      loadCurrentToken,
      patchFormValues,
      putScreenState,
      handleFormValuesChange,
    ],
  );

  const { isAddrOnContactBook } = useContactAccounts();

  const { whitelist, enable: whitelistEnabled } = useWhitelist();
  const computed = useMemo(() => {
    const toAddressInWhitelist = !!whitelist.find(item =>
      addressUtils.isSameAddress(item, formValues.to),
    );
    return {
      toAddressIsValid: !!formValues.to && isValidAddress(formValues.to),
      toAddressInWhitelist,
      toAddressInContactBook: isAddrOnContactBook(formValues.to),

      isSubmitLoading: screenState.isSubmitLoading,
      showWhitelistAlert: screenState.showWhitelistAlert,
      temporaryGrant: screenState.temporaryGrant,
      canSubmit:
        isValidAddress(formValues.to) &&
        !screenState.balanceError &&
        new BigNumber(formValues.amount).gte(0) &&
        !screenState.isLoading &&
        (!whitelistEnabled ||
          screenState.temporaryGrant ||
          toAddressInWhitelist),
    };
  }, [
    whitelist,
    whitelistEnabled,
    isAddrOnContactBook,
    formValues,
    screenState,
  ]);

  const [toAliasName] = useAlias(formValues.to || '');

  return {
    chainEnum,
    chainItem,
    handleChainChanged,

    currentToken,
    handleCurrentTokenChange,

    formik,
    formValues,
    handleFieldChange,
    patchFormValues,
    handleFormValuesChange,

    toAliasName,
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

type InternalContext = {
  screenState: SendScreenState;
  formValues: FormSendToken;
  computed: {
    chainItem: Chain | null;
    currentToken: TokenItem | null;
    currentTokenBalance: string;
    currentTokenPrice: string;
    whitelistEnabled: boolean;
    canSubmit: boolean;
    toAddressInWhitelist: boolean;
    toAddressIsValid: boolean;
    toAddressInContactBook: boolean;
    toAliasName?: string;
  };

  formik: ReturnType<typeof useSendTokenFormikContext>;
  fns: {
    putScreenState: (patch: Partial<SendScreenState>) => void;
    handleFieldChange: <T extends keyof FormSendToken>(
      f: T,
      value: FormSendToken[T],
    ) => void;
  };
  callbacks: {
    handleCurrentTokenChange: (token: TokenItem) => void;
    // onFormValuesChange: (changedValues: Partial<FormSendToken>) => void;
  };
};
const SendTokenInternalContext = React.createContext<InternalContext>({
  screenState: { ...DFLT_SEND_STATE },
  formValues: { ...DF_SEND_TOKEN_FORM },
  computed: {
    chainItem: null,
    currentToken: null,
    currentTokenBalance: '',
    currentTokenPrice: '',
    whitelistEnabled: false,
    canSubmit: false,
    toAddressInWhitelist: false,
    toAddressIsValid: false,
    toAddressInContactBook: false,
    toAliasName: '',
  },

  formik: null as any,
  fns: {
    putScreenState: () => {},
    handleFieldChange: () => {},
  },
  callbacks: {
    handleCurrentTokenChange: () => {},
    // onFormValuesChange: () => {},
  },
});

export const SendTokenInternalContextProvider =
  SendTokenInternalContext.Provider;

export function useSendTokenInternalContext() {
  return React.useContext(SendTokenInternalContext);
}
