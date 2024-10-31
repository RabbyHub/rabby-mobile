import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import React, { useCallback, useRef, useState } from 'react';

import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  input,
  TextInput,
  StyleProp,
  TextStyle,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

import { default as RcIconHelp } from '@/assets/icons/nextComponent/IconHelp.svg';
import { RootNames } from '@/constant/layout';
import { RootStackParamsList } from '@/navigation-type';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  KEYRING_CATEGORY,
  KEYRING_CLASS,
  KEYRING_TYPE,
} from '@rabby-wallet/keyring-utils';
import { default as RcIconBackupCloud } from '@/assets/icons/nextComponent/IconBackupCloud.svg';
import { default as RcIconBackupManual } from '@/assets/icons/nextComponent/IconBackupManual.svg';
import { ICloudIcon } from '@/assets/icons/address/icloud-icon';
import { GDriveIcon } from '@/assets/icons/address/gdrive-icon';
import { shuffle, sortBy, range } from 'lodash';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '@/components2024/Card';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { ProgressBar } from '@/components2024/progressBar';
import { useRequest } from 'ahooks';
import { apiMnemonic } from '@/core/apis';
import { generateKeyringWithMnemonic } from '@/core/apis/mnemonic';
import { requestKeyring } from '@/core/apis/keyring';
import useAsync from 'react-use/lib/useAsync';
import { ellipsisAddress } from '@/utils/address';
import { contactService } from '@/core/services';
import { navigate } from '@/utils/navigation';
import { IS_IOS } from '@/core/native/utils';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

type AddressStackProps = NativeStackScreenProps<
  RootStackParamsList,
  'StackAddress'
>;
function MainListBlocks() {
  const { t } = useTranslation();
  const [newAddress, setNewAddress] = useState('');
  const [addressAlias, setAddressAlias] = useState('Seed Phrase 1 #1');
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const nav = useNavigation();

  const handleBackupToCloud = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SEED_PHRASE_BACKUP_TO_CLOUD,
      // bottomSheetModalProps: {
      //   enableDynamicSizing: true,
      //   maxDynamicContentSize: 460,
      // },
      onDone: isNoMnemonic => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
        if (isNoMnemonic) {
          nav.goBack();
        }
      },
    });
  }, [nav]);

  const handleBackupToPaper = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP,
      onDone: isNoMnemonic => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
        if (isNoMnemonic) {
          nav.goBack();
        }
      },
    });
  }, [nav]);

  const handleContinue = useCallback(() => {
    contactService.setAlias({
      address: newAddress,
      alias: addressAlias,
    });
    console.log('exe handleContinue');
    navigate(RootNames.StackAddress2024, {
      screen: RootNames.CreateNewAddressSecond,
    });
  }, [newAddress, addressAlias]);

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
      }}>
      <View style={[styles.container]}>
        <ProgressBar amount={3} currentCount={3} />
        <Text style={[styles.text]}>
          {t('page.nextComponent.createNewAddress.backupSeedPhrase')}
        </Text>
        <Card style={styles.listItem} onPress={handleBackupToCloud}>
          <ListItem
            Icon={RcIconBackupCloud}
            title={t('page.nextComponent.createNewAddress.icloudBackup')}
          />
          <Text style={styles.quickTag}>{'Quick'}</Text>
        </Card>
        <Card onPress={handleBackupToPaper} style={styles.listItem}>
          <ListItem
            Icon={RcIconBackupManual}
            title={t('page.newAddress.seedPhrase.manuallyBackup')}
          />
        </Card>

        <View style={styles.bottomContainer}>
          <Text style={[styles.tipText]}>
            {t('page.nextComponent.createNewAddress.whatIsSeedPhrase')}
          </Text>
          <RcIconHelp />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function CreateNewAddressThird(): JSX.Element {
  return (
    <NormalScreenContainer>
      <MainListBlocks />
    </NormalScreenContainer>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    marginTop: -12,
    marginBottom: -68,
    borderRadius: 16,
  },
  quickTag: {
    position: 'absolute',
    right: 24,
    top: 32,
    color: colors2024['blue-default'],
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    width: 44,
    height: 24,
    padding: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors2024['blue-light-4'],
  },
  listItem: {
    position: 'relative',
    width: '100%',
    marginBottom: 16,
    borderRadius: 30,
    display: 'flex',
    alignItems: 'flex-start',
    height: 88,
  },
  bottomContainer: {
    width: '100%',
    position: 'absolute',
    height: 20,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    bottom: 40,
  },
  text: {
    color: colors2024['neutral-secondary'],
    fontWeight: '400',
    fontSize: 17,
    marginTop: 34,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  tipText: {
    color: colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginRight: 8,
    fontFamily: 'SF Pro Rounded',
  },
  container: {
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  inputContainer: {
    marginVertical: 8,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  inputInner: {
    width: '100%',
    textAlignVertical: 'center',
    height: 54,
    padding: 0,
    fontSize: 36,
    border: 0,
    backgroundColor: 'transparent',
    lineHeight: 42,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
}));

export default CreateNewAddressThird;
