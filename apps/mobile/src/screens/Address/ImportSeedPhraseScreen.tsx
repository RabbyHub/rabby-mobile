import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PasteTextArea } from './components/PasteTextArea';
import { QandASection } from './components/QandASection';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { apiMnemonic } from '@/core/apis';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { requestKeyring } from '@/core/apis/keyring';
import { toast } from '@/components/Toast';
import { useFocusEffect } from '@react-navigation/native';
import * as bip39 from '@scure/bip39';
import * as import_english from '@scure/bip39/wordlists/english';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    itemAddressWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 4,
    },
    qAndASection: {
      marginBottom: 24,
    },
    textArea: {
      marginBottom: 32,
    },
  });

export const ImportSeedPhraseScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [mnemonics, setMnemonics] = React.useState<string>('');
  const [passphrase, setpassphrase] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const duplicateAddressModal = useDuplicateAddressModal();
  const scanner = useScanner();

  const [importing, setImporting] = React.useState(false);
  const importToastHiddenRef = React.useRef<() => void>(() => {});

  const importSeedPhrase = React.useCallback(() => {
    apiMnemonic
      .generateKeyringWithMnemonic(mnemonics, passphrase, true)
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
              passphrase,
              firstAddress as any,
              true,
            );
            return navigateDeprecated(RootNames.StackAddress, {
              screen: RootNames.ImportSuccess,
              params: {
                type: KEYRING_TYPE.HdKeyring,
                brandName: KEYRING_CLASS.MNEMONIC,
                isFirstImport: true,
                address: [firstAddress?.[0].address],
                mnemonics,
                passphrase,
                keyringId: keyringId || undefined,
                isExistedKR,
              },
            });
          }
        } catch (error) {
          console.log('error', error);
        }
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportMoreAddress,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            mnemonics,
            passphrase,
            keyringId: keyringId || undefined,
            isExistedKR,
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
          try {
            bip39.mnemonicToEntropy(mnemonics?.trim(), import_english.wordlist);
          } catch (e) {
            if ((e as any).message.includes('Unknown letter:')) {
              let errorWords: string[] = [];
              mnemonics.split(/\s+/).forEach(word => {
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
  }, [duplicateAddressModal, mnemonics, passphrase]);

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
      buttonText={t('global.Confirm')}
      onPressButton={handleConfirm}
      btnProps={{
        loading: importing,
      }}>
      <PasteTextArea
        enableScan
        style={styles.textArea}
        value={mnemonics}
        onChange={importing ? undefined : setMnemonics}
        placeholder="Enter your seed phrase with space"
        error={error}
      />
      <QandASection
        style={styles.qAndASection}
        question={t('page.newAddress.seedPhrase.whatIsASeedPhrase.question')}
        answer={t('page.newAddress.seedPhrase.whatIsASeedPhrase.answer')}
      />
      <QandASection
        style={styles.qAndASection}
        question={t(
          'page.newAddress.seedPhrase.isItSafeToImportItInRabby.question',
        )}
        answer={t(
          'page.newAddress.seedPhrase.isItSafeToImportItInRabby.answer',
        )}
      />
    </FooterButtonScreenContainer>
  );
};
