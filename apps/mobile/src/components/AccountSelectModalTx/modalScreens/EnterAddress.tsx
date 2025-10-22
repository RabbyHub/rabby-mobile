import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated } from '@/utils/navigation';
import { isValidHexAddress } from '@metamask/utils';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import {
  onScannerEvent,
  ScannerEventType,
  useScanner,
} from '@/screens/Scanner/ScannerScreen';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { openapi } from '@/core/request';
import { debounce, throttle } from 'lodash';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import { useAccountSelectModalInternal } from '../hooks';
import { SelectAccountSheetModalSizes } from '../layout';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { RcIconScannerCC } from '@/assets/icons/address';
import { Button } from '@/components2024/Button';
import { AddressEditorBadge } from '../AddressEditorBadge';
import usePrevious from 'react-use/lib/usePrevious';
import { Account } from '@/core/services/preference';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

const debouncedGetEnsAddress = debounce(
  (
    input: string,
    callback: (result: any) => void,
    errorCallback: (e: any) => void,
  ) => {
    openapi.getEnsAddressByName(input).then(callback).catch(errorCallback);
  },
  500,
  { leading: false, trailing: true },
);

const ScreenPanelEnterAddress = ({
  onCleanupInput,
}: {
  onCleanupInput?: () => void;
}) => {
  const { cbOnScanStageChanged } = useAccountSelectModalInternal();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, _setInput] = React.useState(
    __DEV__
      ? '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85'
      : // __DEV__ ? 'hongbo.eth'
        '',
  );
  const setInput = useCallback((text: string) => {
    _setInput(text);
    setEnsResult(null);
  }, []);
  const [error, setError] = React.useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);

  const { findAccountWithoutBalance } = useWhiteListAddress();

  const { t } = useTranslation();

  const { foundAccountInfo } = useMemo(() => {
    let info: null | ReturnType<typeof findAccountWithoutBalance> = null;
    if (isValidHexAddress(input as `0x${string}`)) {
      info = findAccountWithoutBalance(input, undefined); // clear input when enter screen
    }
    return {
      foundAccountInfo: info,
    };
  }, [findAccountWithoutBalance, input]);

  // const { isAddrOnWhitelist, addWhitelist, removeWhitelist } = useWhitelist();
  // const { accounts } = useAccounts({
  //   disableAutoFetch: true,
  // });
  // const setInWhitelist = useCallback(
  //   async (bool: boolean) => {
  //     if (bool) {
  //       const isImported = accounts.some(i =>
  //         addressUtils.isSameAddress(i.address, account.address),
  //       );
  //       matomoRequestEvent({
  //         category: 'Send Popup Usage',
  //         action: isImported
  //           ? 'Send_AddWhitelist_imported'
  //           : 'Send_AddWhitelist_notImported',
  //       });
  //       return addWhitelist(account.address, {
  //         hasValidated: true,
  //         onAdded: () => {
  //           toast.success(t('page.whitelist.addSuccessful'));
  //         },
  //       });
  //     } else {
  //       return removeWhitelist(account.address);
  //     }
  //   },
  //   [account.address, addWhitelist, removeWhitelist, t, accounts],
  // );

  const handleDone = useCallback(async () => {
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }

    let address = input;
    if (ensResult && input !== ensResult.addr) {
      address = ensResult.addr;
    }
    if (!isValidHexAddress(address as any)) {
      setError(INPUT_ERROR.INVALID_ADDRESS);
      return;
    }
    try {
      setLoading(true);
      Keyboard.dismiss();
      const { inWhitelist, account, isMyImported } = findAccountWithoutBalance(
        address,
        undefined,
      );

      // TODO: no need this, just confirm it
      if (inWhitelist || isMyImported) {
        // navigateToSendScreen({
        //   toAddress: account.address,
        //   addressBrandName: account.brandName,
        // });
      } else {
        // const id = createGlobalBottomSheetModal2024({
        //   name: MODAL_NAMES.CONFIRM_ADDRESS,
        //   account,
        //   bottomSheetModalProps: {
        //     enableDynamicSizing: true,
        //   },
        //   onCancel: () => {
        //     removeGlobalBottomSheetModal2024(id);
        //   },
        //   onConfirm: (acc, addressDesc) => {
        //     removeGlobalBottomSheetModal2024(id);
        //     // navigateToSendScreen({
        //     //   addressBrandName: acc.brandName,
        //     //   addrDesc: addressDesc,
        //     //   toAddress: acc.address,
        //     // });
        //   },
        // });
      }
    } catch (err: any) {
      console.error('[EnterAddress] err', err);
    } finally {
      setLoading(false);
    }
  }, [ensResult, findAccountWithoutBalance, input]);

  const handleInputChange = React.useCallback(
    (text: string) => {
      setError(undefined);
      setInput(text);
    },
    [setInput],
  );

  React.useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner, setInput]);

  useEffect(() => {
    const unsubscribe = onScannerEvent(
      ScannerEventType.navBack,
      throttle(() => {
        cbOnScanStageChanged('end');
      }, 300),
    );
    return () => {
      unsubscribe();
    };
  }, [cbOnScanStageChanged]);

  const { currentScreen } = useAccountSelectModalInternal();

  // TODO: finish autoscan logic
  const prevScreen = usePrevious(currentScreen);
  useEffect(() => {
    if (prevScreen !== 'enter-addr' && currentScreen === 'enter-addr') {
    }
  }, [currentScreen, prevScreen]);

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb: 20,
  });

  const onSubmitEditing = React.useCallback(() => {
    if (!error && ensResult && input !== ensResult.addr) {
      setInput(ensResult.addr);
    }
  }, [error, ensResult, input, setInput]);

  useEffect(() => {
    if (!input) {
      setError(undefined);
      return;
    }
    if (isValidHexAddress(input as `0x${string}`)) {
      setError(undefined);
      return;
    }

    debouncedGetEnsAddress(
      input,
      result => {
        if (result && result.addr) {
          setEnsResult(result);
          setError(undefined);
        } else {
          setEnsResult(null);
          setError(INPUT_ERROR.INVALID_ADDRESS);
        }
      },
      () => {
        setEnsResult(null);
        setError(INPUT_ERROR.INVALID_ADDRESS);
      },
    );
  }, [input]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        if (!input && !ensResult) {
          onCleanupInput?.();
        }
      }}>
      <View style={[styles.container, { paddingBlock: safeSizes.containerPb }]}>
        <View style={styles.topContent}>
          <View>
            <NextInput.TextArea
              style={styles.textContainer}
              inputStyle={styles.textArea}
              tipText={''}
              hasError={!!error}
              fieldErrorTextStyle={styles.error}
              containerStyle={Object.assign(
                {
                  borderRadius: 16,
                },
                error
                  ? {}
                  : {
                      borderColor: 'transparent',
                    },
              )}
              inputProps={{
                placeholder: t('page.sendPoly.innerEnterAddress'),
                placeholderTextColor: colors2024['neutral-secondary'],
                value: input,
                blurOnSubmit: true,
                autoFocus: true,
                returnKeyType: 'done',
                onChangeText: handleInputChange,
                onSubmitEditing: onSubmitEditing,
              }}
              customIcon={ctx => (
                <View style={[ctx.wrapperStyle, styles.customIconContainer]}>
                  <PasteButton
                    style={styles.pasteButton}
                    cleanClipboardAfterPaste={false}
                    onPaste={text => {
                      handleInputChange(text);
                      Keyboard.dismiss();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      cbOnScanStageChanged('start');
                      setTimeout(() => {
                        navigateDeprecated(RootNames.Scanner);
                      }, 200);
                    }}>
                    <RcIconScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
            <View style={styles.afterInput}>
              {!error && !ensResult && foundAccountInfo?.account && (
                <AddressEditorBadge
                  style={styles.addressEditor}
                  account={foundAccountInfo?.account}
                />
              )}
              {!error && ensResult && input === ensResult.addr && (
                <Text style={styles.ensText}>ENS: {ensResult.name}</Text>
              )}

              {!error && ensResult && input !== ensResult.addr && (
                <TouchableOpacity
                  style={styles.ensResultBox}
                  onPress={() => {
                    Keyboard.dismiss();
                    setInput(ensResult.addr);
                  }}>
                  <Text style={styles.ensResult}>{ensResult.addr}</Text>
                </TouchableOpacity>
              )}
              {error && (
                <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.bottomContent}>
          <Button
            type={'primary'}
            {...{
              title: t('global.Confirm'),
              onPress: handleDone,
              loading: loading,
              disabled: !input || !!error,
            }}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ScreenPanelEnterAddress;

const getStyles = createGetStyles2024(ctx => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: SelectAccountSheetModalSizes.sectionPx,
    paddingTop: 16,
  },
  topContent: {
    alignItems: 'center',
    flexShrink: 0,
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginBottom: 16,
  },

  textContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    paddingTop: 8,
    position: 'relative',
  },
  textArea: {
    marginTop: 10,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  customIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pasteButton: {
    borderWidth: 0,
    width: 'auto',
    // ...makeDebugBorder(),
  },
  error: {
    textAlign: 'left',
  },
  ensResultBox: {
    paddingHorizontal: 12,
    width: '100%',
    borderRadius: 16,
    display: 'flex',
    backgroundColor: ctx.colors2024['brand-light-1'],
  },

  afterInput: {
    marginTop: 16,
    flexDirection: 'row',
  },

  ensResult: {
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 14,
    borderRadius: 16,
    // overflow: 'hidden',
    color: ctx.colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
  },
  addressEditor: {
    alignSelf: 'flex-start',
  },
  ensText: {
    fontSize: 13,
    color: ctx.colors2024['neutral-body'],
  },

  bottomContent: {
    width: '100%',
  },
}));
