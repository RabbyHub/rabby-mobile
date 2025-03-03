import React from 'react';
import { RcIconScannerCC } from '@/assets/icons/address';
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
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { openapi } from '@/core/request';

enum INPUT_ERROR {
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  ADDRESS_EXIST = 'ADDRESS_EXIST',
  REQUIRED = 'REQUIRED',
}

const ERROR_MESSAGE = {
  [INPUT_ERROR.INVALID_ADDRESS]:
    "The address you're are trying to import is invalid",
  [INPUT_ERROR.ADDRESS_EXIST]:
    "The address you're are trying to import is duplicated",
  [INPUT_ERROR.REQUIRED]: 'Please input address',
};

const SendInputScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const scanner = useScanner();
  const navigation = useRabbyAppNavigation();

  const { findAccount } = useWhiteListAddress(true);

  const { t } = useTranslation();

  const handleDone = async () => {
    if (!input) {
      setError(INPUT_ERROR.REQUIRED);
      return;
    }

    let address = input;
    if (!isValidHexAddress(address as any)) {
      setError(INPUT_ERROR.INVALID_ADDRESS);
      return;
    }
    try {
      Keyboard.dismiss();
      const { inWhitelist, account } = findAccount(address);
      const { desc } = await openapi.addrDesc(address);
      if (inWhitelist) {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.Send,
          params: {
            toAddress: account.address,
            cexDes: desc.cex,
            addressBrandName: account.brandName,
          },
        });
      } else {
        navigation.push(RootNames.StackTransaction, {
          screen: RootNames.ConfirmAddress,
          params: {
            account,
          },
        });
      }
    } catch (err: any) {}
  };

  const handleSubmit = React.useCallback((text: string) => {
    setInput(text);
  }, []);

  React.useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleDone,
        disabled: !input || !!error,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
                  {},
                  error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: 'Enter Address',
                  value: input,
                  blurOnSubmit: true,
                  returnKeyType: 'done',
                  onChangeText: handleSubmit,
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableOpacity
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigate(RootNames.Scanner);
                    }}>
                    <RcIconScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableOpacity>
                )}
              />
              {error && (
                <Text style={styles.errorMessage}>{ERROR_MESSAGE[error]}</Text>
              )}
            </View>

            <PasteButton
              style={styles.pasteButton}
              onPaste={text => {
                handleSubmit(text);
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
    paddingHorizontal: 20,
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
  icon: {
    width: 40,
    height: 40,
  },
  itemAddressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  qAndASection: {
    marginBottom: 24,
  },
  textContainer: {
    marginTop: 20,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  textArea: {
    marginTop: 14,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
  },
  error: {
    textAlign: 'left',
  },
  pasteButton: {
    marginTop: 58,
  },
  tipWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    marginBottom: 28,
  },
}));
