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
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { openapi } from '@/core/request';
import { debounce, throttle } from 'lodash';
import { useWhiteListAddress } from '@/screens/Send/hooks/useWhiteListAddress';
import { useAccountSelectModalCtx } from '../hooks';
import { SelectAccountSheetModalSizes } from '../layout';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { RcIconScannerCC } from '@/assets/icons/address';
import { Button } from '@/components2024/Button';
import { AddressEditorBadge } from '../AddressEditorBadge';
import { touchedFeedback } from '@/utils/touch';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

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
  newValue,
}: {
  onCleanupInput?: () => void;
  newValue?: string;
}) => {
  const { fnNavTo, cbOnSelectedAccount } = useAccountSelectModalCtx();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, _setInput] = React.useState(
    __DEV__
      ? ''
      : // __DEV__ ? '0x5853eD4f26A3fceA565b3FBC698bb19cdF6DEB85'
        // __DEV__ ? 'hongbo.eth'
        '',
  );
  const setInput = useCallback((text: string) => {
    _setInput(text);
    setEnsResult(null);
  }, []);
  const [error, setError] = React.useState<INPUT_ERROR>();
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
      info = findAccountWithoutBalance(input, { useEllipsisAsFallback: false }); // clear input when enter screen
    }
    return {
      foundAccountInfo: info,
    };
  }, [findAccountWithoutBalance, input]);

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

      cbOnSelectedAccount?.(account);
    } catch (err: any) {
      console.error('[EnterAddress] err', err);
    } finally {
      setLoading(false);
    }
  }, [ensResult, input, findAccountWithoutBalance, cbOnSelectedAccount]);

  const handleInputChange = React.useCallback(
    (text: string) => {
      setError(undefined);
      setInput(text);
    },
    [setInput],
  );

  const { safeSizes } = useSafeAndroidBottomSizes({
    containerPb: SIZES.bottomContentH + SIZES.containerPb,
    bottomContentBottom: 0,
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

  useEffect(() => {
    if (newValue) {
      setInput(newValue);
    }
  }, [newValue, setInput]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        if (!input && !ensResult) {
          onCleanupInput?.();
        }
      }}>
      <View
        style={[styles.container, { paddingBottom: safeSizes.containerPb }]}>
        <BottomSheetScrollView contentContainerStyle={styles.topContent}>
          <View>
            <NextInput.TextArea
              as="BottomSheetTextInput"
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
                <View
                  style={[
                    ctx.wrapperStyle,
                    styles.customIconContainer,
                    {
                      right: 0,
                      paddingRight: 0,
                    },
                  ]}>
                  <PasteButton
                    style={styles.pasteButton}
                    cleanClipboardAfterPaste={!__DEV__}
                    onPaste={text => {
                      handleInputChange(text);
                      Keyboard.dismiss();
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      touchedFeedback();
                      fnNavTo('scan-qr-code', { nextScanFor: 'enter-addr' });
                    }}
                    style={{
                      height: '100%',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      paddingRight: 20,
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
                    touchedFeedback();
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
        </BottomSheetScrollView>

        <View
          style={[
            styles.bottomContent,
            {
              bottom: safeSizes.bottomContentBottom,
            },
          ]}>
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

const SIZES = {
  bottomContentH: 56,
  containerPb: 30,
};
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
    paddingBottom: SIZES.bottomContentH + SIZES.containerPb,
    // ...makeDebugBorder('red'),
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
    position: 'absolute',
    bottom: 0,
    // ...makeDebugBorder(),
    height: SIZES.bottomContentH,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
}));
