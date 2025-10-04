import React, { useEffect, useState } from 'react';
import ScannerCC from '@/assets2024/icons/common/scanner-cc.svg';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { navigate } from '@/utils/navigation';
import { isValidHexAddress } from '@metamask/utils';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { useScanner } from '@/screens/Scanner/ScannerScreen';
import { useWhiteListAddress } from '../../hooks/useWhiteListAddress';
import { useRoute } from '@react-navigation/native';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { openapi } from '@/core/request';
import { debounce } from 'lodash';

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

const SendInputScreen = ({ cleanInput }: { cleanInput?: () => void }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [loading, setLoading] = useState(false);
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'SendInput'>
    >();
  const navParams = route.params || {};
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);

  const { navigateToSendScreen } = useSendRoutes();

  const { findAccountWithoutBalance } = useWhiteListAddress();

  const { t } = useTranslation();

  const handleDone = async () => {
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

      if (inWhitelist || isMyImported) {
        navigateToSendScreen({
          toAddress: account.address,
          addressBrandName: account.brandName,
        });
      } else {
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.CONFIRM_ADDRESS,
          account,
          bottomSheetModalProps: {
            enableDynamicSizing: true,
          },
          onCancel: () => {
            removeGlobalBottomSheetModal2024(id);
          },
          onConfirm: (acc, addressDesc) => {
            removeGlobalBottomSheetModal2024(id);
            navigateToSendScreen({
              addressBrandName: acc.brandName,
              addrDesc: addressDesc,
              toAddress: acc.address,
            });
          },
        });
      }
    } catch (err: any) {
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = React.useCallback((text: string) => {
    setError(undefined);
    setInput(text);
  }, []);

  React.useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner]);
  useEffect(() => {
    if (navParams?.autoScan) {
      navigate(RootNames.Scanner);
    }
  }, [navParams?.autoScan]);

  const onSubmitEditing = React.useCallback(() => {
    if (!error && ensResult && input !== ensResult.addr) {
      setInput(ensResult.addr);
      setEnsResult(null);
    }
  }, [error, ensResult, input]);

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
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleDone,
        loading: loading,
        disabled: !input || !!error,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          if (!input && !ensResult) {
            cleanInput?.();
          }
        }}>
        <View style={styles.container}>
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
                  onChangeText: handleSubmit,
                  onSubmitEditing: onSubmitEditing,
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableOpacity
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigate(RootNames.Scanner);
                    }}>
                    <ScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableOpacity>
                )}
              />
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

            <PasteButton
              style={styles.pasteButton}
              onPaste={text => {
                handleSubmit(text);
                Keyboard.dismiss();
              }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};

export default SendInputScreen;

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 24,
  },
  topContent: {
    alignItems: 'center',
    flexShrink: 0,
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginTop: 12,
    marginBottom: 16,
  },

  textContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    paddingTop: 8,
  },
  textArea: {
    marginTop: 10,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
    fontSize: 17,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  error: {
    textAlign: 'left',
  },
  pasteButton: {
    marginTop: 58,
  },
  ensResultBox: {
    // padding: 4,
    width: '100%',
    borderRadius: 16,
    display: 'flex',
    marginTop: 12,
    backgroundColor: ctx.colors2024['brand-light-1'],
  },

  ensResult: {
    paddingHorizontal: 16,
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
  ensText: {
    fontSize: 13,
    color: ctx.colors2024['neutral-body'],
    marginVertical: 12,
    marginHorizontal: 8,
  },
}));
