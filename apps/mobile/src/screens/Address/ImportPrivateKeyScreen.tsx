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

export const ImportPrivateKeyScreen = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [privateKey, setPrivateKey] = React.useState<string>('');

  const handleConfirm = React.useCallback(() => {
    apiPrivateKey
      .importPrivateKey(privateKey)
      .then(([{ address }]) => {
        navigate(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess,
          params: {
            type: KEYRING_TYPE.SimpleKeyring,
            brandName: KEYRING_CLASS.PRIVATE_KEY,
            address,
          },
        });
      })
      .catch(err => {
        console.error(err);
        toast.show(err.message);
      });
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
