import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { apiMnemonic } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { requestKeyring } from '@/core/apis/keyring';
import { toast } from '@/components/Toast';
import { useFocusEffect } from '@react-navigation/native';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as bip39 from '@scure/bip39';
import PasteButton from '@/components2024/PasteButton';
import { NextInput } from '@/components2024/Form/Input';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import SeedPhrase from '@/assets2024/icons/common/seed-phrase.svg';
import TouchableView from '@/components/Touchable/TouchableView';
import { RcIconScannerCC } from '@/assets/icons/address';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    // TODO: get card1 color
    // backgroundColor: ctx.colors2024['card1'],
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
    // marginTop: 8,
    // ...makeDebugBorder(),
  },
  topContent: {
    alignItems: 'center',
    flexShrink: 0,
    // height: '100%',
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
  },
  pasteButton: {
    marginTop: 58,
  },
  tipWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    gap: 4,
    width: '100%',
    // ...makeDebugBorder('yellow'),
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

export const ImportSeedPhraseScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const [mnemonics, setMnemonics] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const duplicateAddressModal = useDuplicateAddressModal();
  const scanner = useScanner();

  const [importing, setImporting] = React.useState(false);
  const importToastHiddenRef = React.useRef<() => void>(() => {});

  const importSeedPhrase = React.useCallback(() => {
    apiMnemonic
      .generateKeyringWithMnemonic(mnemonics, '', true)
      .then(async ({ keyringId, isExistedKR }) => {
        const firstAddress = await requestKeyring(
          KEYRING_TYPE.HdKeyring,
          'getAddresses',
          keyringId ?? null,
          0,
          1,
        );
        try {
          const importedAccounts = await requestKeyring(
            KEYRING_TYPE.HdKeyring,
            'getAccounts',
            keyringId ?? null,
          );
          if (
            !importedAccounts ||
            (importedAccounts?.length < 1 && !!firstAddress?.length)
          ) {
            await new Promise(resolve => setTimeout(resolve, 1));
            await apiMnemonic.activeAndPersistAccountsByMnemonics(
              mnemonics,
              '',
              firstAddress as any,
              true,
            );
            return navigate(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess2024,
              params: {
                type: KEYRING_TYPE.HdKeyring,
                brandName: KEYRING_CLASS.MNEMONIC,
                isFirstImport: true,
                address: [firstAddress?.[0].address],
                mnemonics,
                passphrase: '',
                keyringId: keyringId || undefined,
                isExistedKR,
              },
            });
          }
        } catch (error) {
          console.log('error', error);
        }

        navigate(RootNames.ImportMoreAddress, {
          type: KEYRING_TYPE.HdKeyring,
          mnemonics,
          passphrase: '',
          keyringId: keyringId || undefined,
          isExistedKR,
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
          try {
            bip39.mnemonicToEntropy(mnemonics?.trim(), wordlist);
          } catch (e) {
            if ((e as any).message.includes('Unknown letter:')) {
              let errorWords: string[] = [];
              mnemonics.split(/\s+/).forEach(word => {
                let v = word?.trim();
                if (v && !wordlist.includes(v)) {
                  errorWords.push(v);
                }
              });
              setError(
                `invalid ${errorWords.length > 1 ? 'words' : 'word'} found: ` +
                  errorWords.join(', '),
              );
            } else {
              setError(err.message);
            }
          }
        }
      })
      .finally(() => {
        importToastHiddenRef.current?.();
        setImporting(false);
      });
  }, [duplicateAddressModal, mnemonics]);

  const handleConfirm = React.useCallback(() => {
    setImporting(true);
    importToastHiddenRef.current = toast.show('Importing...', {
      duration: 100000,
    });

    setTimeout(() => {
      importSeedPhrase();
    }, 10);
  }, [importSeedPhrase]);

  React.useEffect(() => {
    setError(undefined);
  }, [mnemonics]);

  React.useEffect(() => {
    if (scanner.text) {
      setMnemonics(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  useFocusEffect(() => {
    return () => {
      importToastHiddenRef.current?.();
    };
  });

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleConfirm,
        loading: importing,
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.topContent}>
            <SeedPhrase style={styles.icon} />
            <View>
              <NextInput.TextArea
                style={styles.textContainer}
                tipText={error}
                hasError={!!error}
                inputStyle={styles.textArea}
                containerStyle={Object.assign(
                  {},
                  !!error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: 'Enter your seed phrase',
                  value: mnemonics,
                  onChangeText: text => {
                    if (importing) {
                      return;
                    }
                    setMnemonics(text);
                  },
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
                if (importing) {
                  return;
                }
                setMnemonics(text);
              }}
            />
          </View>

          <View style={styles.tipWrapper}>
            <Text style={styles.tip}>What's a Seed Phrase</Text>
            <HelpIcon
              style={styles.tipIcon}
              onPress={() => {
                const modalId = createGlobalBottomSheetModal2024({
                  name: MODAL_NAMES.DESCRIPTION,
                  title: "What is a 'Seed phrase'",
                  sections: [
                    {
                      description:
                        'A seed phrase is a series of words used to access and control your address. You can use it to recover your address on any device.',
                    },
                    {
                      title: 'Backup',
                      description:
                        'If you lose your seed phrase, you won’t be able to restore your wallet.',
                    },
                    {
                      title: 'Never Share It',
                      description:
                        'Never share your seed phrase—anyone with access to it can control your funds.',
                    },
                    {
                      title: 'Safety',
                      description:
                        'Your seed phrase is stored locally on your device and encrypted with your password. Only you can access it. Rabby cannot retrieve or access your seed phrase.',
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
                    titleStyle: StyleSheet.flatten([
                      styles.modalNextButtonText,
                    ]),
                    onPress: () => {
                      removeGlobalBottomSheetModal2024(modalId);
                    },
                  },
                });
              }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};
