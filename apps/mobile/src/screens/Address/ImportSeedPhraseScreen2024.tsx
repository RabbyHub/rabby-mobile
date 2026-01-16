import { useTheme2024 } from '@/hooks/theme';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import HdKeyring from '@rabby-wallet/eth-hd-keyring';
import { apiMnemonic } from '@/core/apis';
import { navigateDeprecated, replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { requestKeyring } from '@/core/apis/keyring';
import { toast } from '@/components2024/Toast';
import { useFocusEffect } from '@react-navigation/native';
import * as bip39 from '@scure/bip39';
import * as import_english from '@scure/bip39/wordlists/english';
import PasteButton from '@/components2024/PasteButton';
import { NextInput } from '@/components2024/Form/Input';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  Keyboard,
  Pressable,
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
import { useSetPasswordFirst } from '@/hooks/useLock';
import { useImportAddressProc } from '@/hooks/address/useNewUser';
import { useShowImportMoreAddressPopup } from '@/hooks/useShowImportMoreAddressPopup';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import {
  isNewlyInputTextSameWithContentFromClipboard,
  onPastedSensitiveData,
} from '@/utils/clipboard';

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
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const { setConfirmCB } = useImportAddressProc();
  const formatMnemonics = useMemo(() => {
    const trimMnemonics = mnemonics?.trim();
    const splitMnemonics = trimMnemonics.split(/\s+|,|\n/).filter(Boolean);
    return splitMnemonics.join(' ');
  }, [mnemonics]);

  const { showImportMorePopup } = useShowImportMoreAddressPopup();

  const importSeedPhrase = React.useCallback(() => {
    return apiMnemonic
      .generateKeyringWithMnemonic(formatMnemonics, '', true)
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
              formatMnemonics,
              '',
              firstAddress as any,
              true,
            );
            return replaceToFirst(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess2024,
              params: {
                type: KEYRING_TYPE.HdKeyring,
                brandName: KEYRING_CLASS.MNEMONIC,
                isFirstImport: true,
                address: [firstAddress?.[0].address],
                mnemonics: formatMnemonics,
                passphrase: '',
                keyringId: keyringId || undefined,
                isExistedKR,
              },
            });
          }
        } catch (error) {
          console.log('error', error);
        }
        showImportMorePopup({
          type: KEYRING_TYPE.HdKeyring,
          brandName: KEYRING_CLASS.MNEMONIC,
          mnemonics: formatMnemonics,
          passphrase: '',
          keyringId: keyringId || undefined,
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
            bip39.mnemonicToEntropy(formatMnemonics, import_english.wordlist);
          } catch (e) {
            if ((e as any).message.includes('Unknown letter:')) {
              let errorWords: string[] = [];
              formatMnemonics.split(/\s+/).forEach(word => {
                let v = word?.trim();
                if (v && !import_english.wordlist.includes(v)) {
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
  }, [duplicateAddressModal, formatMnemonics, showImportMorePopup]);

  const verfiyMnemonics = React.useCallback(() => {
    try {
      const splitMnemonics = formatMnemonics.split(' ');
      const errorList: Array<{ index: number; word: string }> = [];
      for (let index = 0; index < splitMnemonics.length; index++) {
        const word = splitMnemonics[index];
        let v = word?.trim();
        if (v && !import_english.wordlist.includes(v)) {
          errorList.push({
            index,
            word: v,
          });
        }
      }

      if (errorList.length) {
        setError(
          `${t('background.error.errorWords', {
            count: errorList.length,
          })}: ${errorList.map(i => i.word).join(',')}`,
        );
        return false;
      }
      if (!HdKeyring.validateMnemonic(formatMnemonics)) {
        setError(t('background.error.invalidMnemonic'));
        return false;
      }
      return true;
    } catch {
      setError(t('background.error.invalidMnemonic'));
      return false;
    }
  }, [formatMnemonics, t]);

  const handleConfirm = React.useCallback(async () => {
    // verify mnemonics for setPassword
    if (!verfiyMnemonics()) {
      return;
    }

    if (
      await shouldRedirectToSetPasswordBefore2024({
        backScreen: RootNames.ImportSuccess2024,
        isFirstImportPassword: true,
      })
    ) {
      preferenceService.setReportActionTs(
        REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM,
      );
      setConfirmCB(importSeedPhrase);
      return;
    }
    setImporting(true);
    importToastHiddenRef.current = toast.show('Importing...', {
      duration: 100000,
    });

    setTimeout(() => {
      importSeedPhrase();
    }, 10);
  }, [
    importSeedPhrase,
    setConfirmCB,
    shouldRedirectToSetPasswordBefore2024,
    verfiyMnemonics,
  ]);

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
        disabled: !formatMnemonics || !!error,
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
                  error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: t('page.importSeedPhrase.enterYourSeedPhrase'),
                  value: mnemonics,
                  secureTextEntry: true,
                  textContentType: 'none',
                  blurOnSubmit: true,
                  returnKeyType: 'done',
                  onChangeText: text => {
                    if (importing) {
                      return;
                    }
                    setMnemonics(text);
                    isNewlyInputTextSameWithContentFromClipboard(text).then(
                      isSame => {
                        if (isSame) {
                          onPastedSensitiveData({ type: 'seedPhrase' });
                        }
                      },
                    );
                  },
                }}
                // eslint-disable-next-line react/no-unstable-nested-components
                customIcon={ctx => (
                  <TouchableView
                    style={ctx.wrapperStyle}
                    onPress={() => {
                      navigateDeprecated(RootNames.Scanner);
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
                onPastedSensitiveData({ type: 'seedPhrase' });
              }}
            />
          </View>

          <Pressable
            style={styles.tipWrapper}
            onPress={() => {
              const modalId = createGlobalBottomSheetModal2024({
                name: MODAL_NAMES.DESCRIPTION,
                title: t('page.newAddress.whatIsSeedPhrase.title'),
                sections: [
                  {
                    description: t(
                      'page.newAddress.whatIsSeedPhrase.description1',
                    ),
                  },
                  {
                    title: t('page.newAddress.whatIsSeedPhrase.title1'),
                    description: t(
                      'page.newAddress.whatIsSeedPhrase.description2',
                    ),
                  },
                  {
                    title: t('page.newAddress.whatIsSeedPhrase.title2'),
                    description: t(
                      'page.newAddress.whatIsSeedPhrase.description3',
                    ),
                  },
                  {
                    title: t('page.newAddress.whatIsSeedPhrase.title3'),
                    description: t(
                      'page.newAddress.whatIsSeedPhrase.description4',
                    ),
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
            <Text style={styles.tip}>
              {t('page.newAddress.whatIsSeedPhrase.title')}
            </Text>
            <HelpIcon style={styles.tipIcon} />
          </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};
