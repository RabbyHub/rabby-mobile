import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PasteTextArea } from './components/PasteTextArea';
import { FooterButtonScreenContainer } from '@/components/ScreenContainer/FooterButtonScreenContainer';
import { apiPrivateKey } from '@/core/apis';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { useScanner } from '../Scanner/ScannerScreen';
import { createGetStyles2024 } from '@/utils/styles';
import { Text, View } from 'react-native';
import HelpIcon from '@/assets2024/icons/common/help.svg';
import PrivateKeyIcon from '@/assets2024/icons/common/private-key.svg';
import PasteButton from '@/components2024/PasteButton';
import { createGlobalBottomSheetModal2024 } from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { NextInput } from '@/components2024/Form/Input';
import TouchableView from '@/components/Touchable/TouchableView';
import { RcIconScannerCC } from '@/assets/icons/address';

export const ImportPrivateKeyScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const [privateKey, setPrivateKey] = React.useState<string>('');
  const [error, setError] = React.useState<string>();
  const duplicateAddressModal = useDuplicateAddressModal();
  const scanner = useScanner();

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

  React.useEffect(() => {
    if (scanner.text) {
      setPrivateKey(scanner.text);
      scanner.clear();
    }
  }, [scanner]);

  return (
    <FooterButtonScreenContainer
      buttonText={t('global.Confirm')}
      onPressButton={handleConfirm}>
      <View style={styles.container}>
        <PrivateKeyIcon style={styles.icon} />
        <NextInput.TextArea
          style={styles.textArea}
          tipText={error}
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

        <PasteButton
          style={styles.pasteButton}
          onPaste={text => {
            setPrivateKey(text);
          }}
        />
        <View style={styles.tipWrapper}>
          <Text style={styles.tip}>Is it safe to import into Rabby</Text>
          <HelpIcon
            style={styles.tipIcon}
            onPress={() => {
              createGlobalBottomSheetModal2024({
                name: MODAL_NAMES.PRIVATE_KEY,
              });
            }}
          />
        </View>
      </View>
    </FooterButtonScreenContainer>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    height: '100%',
    width: '100%',
    marginTop: 8,
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
  textArea: {
    marginTop: 20,
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
    marginTop: 260,
  },
  tip: {
    color: ctx.colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
  },
  tipIcon: {
    width: 16,
    height: 16,
  },
}));
