import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PasteTextArea } from './components/PasteTextArea';
import { QandASection } from './components/QandASection';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { apiPrivateKey } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';

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

export const ImportPrivateKeyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const duplicateAddressModal = useDuplicateAddressModal();

  const handleConfirm = React.useCallback(() => {
    apiPrivateKey
      .importPrivateKey(privateKey)
      .then(([account]) => {
        navigate(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess,
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

  React.useEffect(() => {
    setError(undefined);
  }, [privateKey]);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Confirm')}
      onPressButton={handleConfirm}>
      <PasteTextArea
        style={styles.textArea}
        value={privateKey}
        onChange={setPrivateKey}
        placeholder="Enter your Private Key"
        error={error}
      />
      <QandASection
        style={styles.qAndASection}
        question={t('page.newAddress.privateKey.whatIsAPrivateKey.question')}
        answer={t('page.newAddress.privateKey.whatIsAPrivateKey.answer')}
      />
      <QandASection
        style={styles.qAndASection}
        question={t(
          'page.newAddress.privateKey.isItSafeToImportItInRabby.question',
        )}
        answer={t(
          'page.newAddress.privateKey.isItSafeToImportItInRabby.answer',
        )}
      />
    </FooterButtonScreenContainer>
  );
};
