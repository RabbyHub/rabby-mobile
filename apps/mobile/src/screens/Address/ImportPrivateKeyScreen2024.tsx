import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { apiPrivateKey } from '@/core/apis';
import { navigate, replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import PrivateKeyIcon from '@/assets2024/icons/common/private-key.svg';
import PasteButton from '@/components2024/PasteButton';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { NextInput } from '@/components2024/Form/Input';
import TouchableView from '@/components/Touchable/TouchableView';
import { RcIconScannerCC } from '@/assets/icons/address';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useImportAddressProc } from '@/hooks/address/useNewUser';

export const ImportPrivateKeyScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const duplicateAddressModal = useDuplicateAddressModal();
  const scanner = useScanner();

  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { setConfirmCB } = useImportAddressProc();

  const importPrivateKey = React.useCallback(() => {
    return apiPrivateKey
      .importPrivateKey(privateKey)
      .then(([account]) => {
        replaceToFirst(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess2024,
          params: {
            type: KEYRING_TYPE.SimpleKeyring,
            brandName: KEYRING_CLASS.PRIVATE_KEY,
            address: account.address,
          },
        });
      })
      .catch(err => {
        console.error(err);
        if (err.name === 'DuplicateAccountError') {
          duplicateAddressModal.show({
            address: err.message,
            brandName: KEYRING_CLASS.PRIVATE_KEY,
            type: KEYRING_TYPE.SimpleKeyring,
          });
        } else {
          setError(err.message);
        }
      });
  }, [duplicateAddressModal, privateKey]);

  const handleConfirm = React.useCallback(() => {
    if (
      shouldRedirectToSetPasswordBefore2024({
        backScreen: RootNames.ImportSuccess2024,
        isFirstImportPassword: true,
      })
    ) {
      setConfirmCB(importPrivateKey);
      return;
    }
    importPrivateKey();
  }, [importPrivateKey, setConfirmCB, shouldRedirectToSetPasswordBefore2024]);

  React.useEffect(() => {
    setError(undefined);
  }, [privateKey]);

  React.useEffect(() => {
    if (scanner.text) {
      setPrivateKey(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleConfirm,
        disabled: !privateKey || !!error,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.topContent}>
            <PrivateKeyIcon style={styles.icon} />
            <View>
              <NextInput.TextArea
                style={styles.textContainer}
                inputStyle={styles.textArea}
                tipText={error}
                hasError={!!error}
                fieldErrorTextStyle={styles.error}
                containerStyle={Object.assign(
                  {},
                  !!error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: 'Enter your Private Key',
                  value: privateKey,
                  onChangeText: setPrivateKey,
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableView
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigate(RootNames.Scanner);
                    }}>
                    <RcIconScannerCC
                      style={ctx.iconStyle}
                      color={colors2024['neutral-title-1']}
                    />
                  </TouchableView>
                )}
              />
            </View>

            <PasteButton
              style={styles.pasteButton}
              onPaste={text => {
                setPrivateKey(text);
              }}
            />
          </View>
          <Pressable
            style={styles.tipWrapper}
            onPress={() => {
              const modalId = createGlobalBottomSheetModal2024({
                name: MODAL_NAMES.DESCRIPTION,
                title: "What's a private key",
                sections: [
                  {
                    description:
                      'A private key is a string of letters and numbers used to access and control your address. You can use it to recover your address on any device.',
                  },
                  {
                    title: 'Backup',
                    description:
                      'If you lose your private key, you won’t be able to restore your wallet.',
                  },
                  {
                    title: 'Never Share It',
                    description:
                      'Never share your private key—anyone with access to it can control your funds.',
                  },
                  {
                    title: 'Safety',
                    description:
                      'Your private key is stored locally on your device and encrypted with your password. Only you can access it. Rabby cannot retrieve or access your private key.',
                  },
                ],
                bottomSheetModalProps: {
                  enableContentPanningGesture: true,
                  enablePanDownToClose: true,
                },
                nextButtonProps: {
                  title: (
                    <Text style={styles.modalNextButtonText}>I Got It.</Text>
                  ),
                  titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
                  onPress: () => {
                    removeGlobalBottomSheetModal2024(modalId);
                  },
                },
              });
            }}>
            <Text style={styles.tip}>What is 'Private Key'</Text>
            <HelpIcon style={styles.tipIcon} />
          </Pressable>
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
    alignItems: 'center',
    gap: 4,
    width: '100%',
    marginBottom: 28,
  },
  tip: {
    color: ctx.colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
    fontFamily: 'SF Pro Rounded',
  },
  tipIcon: {
    width: 16,
    height: 16,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: ctx.colors2024['neutral-InvertHighlight'],
    backgroundColor: ctx.colors2024['brand-default'],
  },
}));
