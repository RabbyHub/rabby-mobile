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
import { findChain, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { GasLevel, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { openapi } from '@/core/request';
import { TFunction } from 'i18next';
import { isValidAddress } from '@ethereumjs/util';
import BigNumber from 'bignumber.js';
import { useWhitelist } from '@/hooks/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useContactAccounts } from '@/hooks/contact';
import { UIContactBookItem } from '@/core/apis/contact';
import { ChainGas } from '@/core/services/preference';
import { apiContact, apiToken } from '@/core/apis';
import { formatSpeicalAmount } from '@/utils/number';
import { useFormik, useFormikContext } from 'formik';
import { useCurrentAccount } from '@/hooks/account';
import { getKRCategoryByType } from '@/utils/transaction';
import { matomoRequestEvent } from '@/utils/analytics';
import { toast } from '@/components/Toast';
import { bizNumberUtils } from '@rabby-wallet/biz-utils';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { StackActions } from '@react-navigation/native';

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

  addressToAddAsContacts: string | null;
  addressToEditAlias: string | null;
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

  addressToAddAsContacts: null,
  addressToEditAlias: null,
};
const sendTokenScreenStateAtom = atom<SendScreenState>({ ...DFLT_SEND_STATE });
export function useSendNFTScreenState() {
  const [sendNFTScreenState, setSendNFTScreenState] = useAtom(
    sendTokenScreenStateAtom,
  );

  const putScreenState = useCallback(
    (patch: Partial<SendScreenState>) => {
      setSendNFTScreenState(prev => ({
        ...prev,
        ...patch,
      }));
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
export function useSendNFTForm(nftToken?: NFTItem) {
  const { t } = useTranslation();

  const sendNFTEventsRef = useRef(new EventEmitter());
  const { currentAccount } = useCurrentAccount();

  const { sendNFTScreenState: screenState, putScreenState } =
    useSendNFTScreenState();

  // const [formValues, setFormValues] = useAtom(sendTokenScreenFormAtom);
  const [formValues, setFormValues] = React.useState<FormSendNFT>({
    ...DF_SEND_TOKEN_FORM,
  });

  const { validationSchema } = useMemo(() => {
    return {
      validationSchema: makeSendTokenValidationSchema({ t }),
    };
  }, [t]);

  const chainItem = findChain({ serverId: nftToken?.chain });
  const navigation = useRabbyAppNavigation();

  const handleSubmit = useCallback(
    async ({ to, amount }: FormSendNFT) => {
      if (!nftToken) return;
      sendNFTEventsRef.current.emit(SendNFTEvents.ON_SEND);

      putScreenState({ isSubmitLoading: true });

      try {
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

        await apiToken.transferNFT(
          {
            to,
            amount: bizNumberUtils.coerceInteger(amount),
            tokenId: nftToken.inner_id,
            chainServerId: nftToken.chain,
            contractId: nftToken.contract_id,
            abi: nftToken.is_erc1155 ? 'ERC1155' : 'ERC721',
          },
          {
            ga: {
              category: 'Send',
              source: 'sendNFT',
            },
          },
        );

        navigation.dispatch(
          StackActions.replace(RootNames.StackRoot, {
            screen: RootNames.Home,
          }),
        );
      } catch (e: any) {
        toast.info(e.message);
      } finally {
        putScreenState({ isSubmitLoading: false });
      }
    },
    [currentAccount, putScreenState, chainItem?.name, nftToken, navigation],
  );

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

  const { isAddrOnContactBook } = useContactAccounts({ autoFetch: true });

  const { whitelist, enable: whitelistEnabled } = useWhitelist();
  const computed = useMemo(() => {
    const toAddressInWhitelist = !!whitelist.find(item =>
      addressUtils.isSameAddress(item, formValues.to),
    );
    return {
      toAddressIsValid: !!formValues.to && isValidAddress(formValues.to),
      toAddressInWhitelist,
      toAddressInContactBook: isAddrOnContactBook(formValues.to),

      canSubmit:
        isValidAddress(formValues.to) &&
        new BigNumber(formValues.amount).gt(0) &&
        !screenState.isLoading &&
        (!whitelistEnabled ||
          screenState.temporaryGrant ||
          toAddressInWhitelist),
    };
  }, [
    whitelist,
    whitelistEnabled,
    isAddrOnContactBook,
    formValues.to,
    screenState,
    formValues.amount,
  ]);

  const resetFormValues = useCallback(() => {
    setFormValues({ ...DF_SEND_TOKEN_FORM });
    formik.resetForm();
  }, [setFormValues, formik]);

  return {
    chainItem,

    sendNFTEvents: sendNFTEventsRef.current,
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
export function useSendNFTFormikContext() {
  return useFormikContext<FormSendNFT>();
}

export function useSendNFTFormik() {
  const { formik } = useSendNFTInternalContext();

  return formik;
}

type InternalContext = {
  screenState: SendScreenState;
  formValues: FormSendNFT;
  computed: {
    chainItem: Chain | null;
    currentNFT: NFTItem | null;
    whitelistEnabled: boolean;
    canSubmit: boolean;
    toAddressInWhitelist: boolean;
    toAddressIsValid: boolean;
    toAddressInContactBook: boolean;
  };

  formik: ReturnType<typeof useSendNFTFormikContext>;
  events: EventEmitter;
  fns: {
    putScreenState: (patch: Partial<SendScreenState>) => void;
    fetchContactAccounts: () => void;
  };
  callbacks: {
    handleFieldChange: <T extends keyof FormSendNFT>(
      f: T,
      value: FormSendNFT[T],
    ) => void;
  };
};
const SendNFTInternalContext = React.createContext<InternalContext>({
  screenState: { ...DFLT_SEND_STATE },
  formValues: { ...DF_SEND_TOKEN_FORM },
  computed: {
    chainItem: null,
    currentNFT: null,
    whitelistEnabled: false,
    canSubmit: false,
    toAddressInWhitelist: false,
    toAddressIsValid: false,
    toAddressInContactBook: false,
  },

  formik: null as any,
  events: null as any,
  fns: {
    putScreenState: () => {},
    fetchContactAccounts: () => {},
  },
  callbacks: {
    handleFieldChange: () => {},
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
