import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PasteTextArea } from './components/PasteTextArea';
import { QandASection } from './components/QandASection';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { apiMnemonic } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { requestKeyring } from '@/core/apis/keyring';
import { toast } from '@/components/Toast';

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

  const handleConfirm = React.useCallback(() => {
    setImporting(true);
    importToastHiddenRef.current = toast.show('Importing...', {
      duration: 100000,
    });
    apiMnemonic
      .generateKeyringWithMnemonic(mnemonics, passphrase)
      .then(async ({ keyringId, isExistedKR }) => {
        const keyring = apiMnemonic.getKeyringByMnemonic(mnemonics, passphrase);
        const firstAddress = requestKeyring(
          KEYRING_TYPE.HdKeyring,
          'getAddresses',
          keyringId ?? null,
          0,
          1,
        );
        try {
          const importedAccounts = isExistedKR
            ? await keyring?.getAccounts()
            : await requestKeyring(
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
            return navigate(RootNames.StackAddress, {
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
        } catch (error) {}

        navigate(RootNames.ImportHardware, {
          type: KEYRING_TYPE.HdKeyring,
          mnemonics,
          passphrase,
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
          setError(err.message);
        }
      })
      .finally(() => {
        importToastHiddenRef.current?.();
        setImporting(false);
      });
  }, [duplicateAddressModal, mnemonics, passphrase]);

  React.useEffect(() => {
    setError(undefined);
  }, [mnemonics]);

  React.useEffect(() => {
    if (scanner.text) {
      setMnemonics(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Confirm')}
      onPressButton={handleConfirm}
      btnProps={{
        loading: importing,
      }}>
      <PasteTextArea
        style={styles.textArea}
        value={mnemonics}
        onChange={setMnemonics}
        placeholder="Enter your seed phrase  with space"
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
