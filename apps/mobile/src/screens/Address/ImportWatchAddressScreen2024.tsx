import { RcIconScannerCC } from '@/assets/icons/address';
import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { apisAddress } from '@/core/apis';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import { isValidHexAddress } from '@metamask/utils';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import React, { useEffect } from 'react';
import {
  Keyboard,
  TouchableOpacity,
  View,
  TouchableWithoutFeedback,
} from 'react-native';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { createGetStyles2024 } from '@/utils/styles';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { useTranslation } from 'react-i18next';
import { useScanner } from '../Scanner/ScannerScreen';
import { ellipsisAddress } from '@/utils/address';
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

export const ImportWatchAddressScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<INPUT_ERROR>();
  const scanner = useScanner();
  const [ensResult, setEnsResult] = React.useState<null | {
    addr: string;
    name: string;
  }>(null);

  const { t } = useTranslation();
  const duplicateAddressModal = useDuplicateAddressModal();

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
      Keyboard.dismiss();
      await apisAddress.addWatchAddress(address);
      replaceToFirst(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.WatchAddressKeyring,
          address: address,
          alias: ellipsisAddress(address),
          brandName: KEYRING_CLASS.WATCH,
        },
      });
    } catch (err: any) {
      if (err.name === 'DuplicateAccountError') {
        duplicateAddressModal.show({
          address: err.message,
          brandName: KEYRING_CLASS.WATCH,
          type: KEYRING_TYPE.WatchAddressKeyring,
        });
      } else {
        setError(err.message);
      }
    }
  };

  const handleSubmit = React.useCallback((text: string) => {
    setInput(text);
  }, []);

  const onSubmitEditing = React.useCallback(() => {
    if (!error && ensResult && input !== ensResult.addr) {
      setInput(ensResult.addr);
      setEnsResult(null);
    }
  }, [error, ensResult, input]);

  React.useEffect(() => {
    if (scanner.text) {
      setInput(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

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
            <WalletIcon
              type={KEYRING_TYPE.WatchAddressKeyring}
              width={40}
              height={40}
              style={styles.icon}
            />
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
                  placeholder: 'Address / ENS',
                  value: input,
                  blurOnSubmit: true,
                  returnKeyType: 'done',
                  onSubmitEditing: onSubmitEditing,
                  onChangeText: handleSubmit,
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableOpacity
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigateDeprecated(RootNames.Scanner);
                    }}>
                    <RcIconScannerCC
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
              }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};

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
