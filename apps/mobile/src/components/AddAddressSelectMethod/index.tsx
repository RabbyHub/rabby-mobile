import { apiMnemonic } from '@/core/apis';
import { detectCloudIsAvailable } from '@/core/utils/cloudBackup';
import React from 'react';
import { ActivityIndicator, View, Text, Image } from 'react-native';
import { toast, toastWithIcon } from '../Toast';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import IconHardWare from '@/assets2024/icons/common/IconHardWare.png';
import IconImport from '@/assets2024/icons/common/IconImport.svg';
import IconCreate from '@/assets2024/icons/common/IconCreate.svg';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
}

export const AddAddressSelectMethod: React.FC<Props> = ({ onDone }) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  React.useEffect(() => {
    detectCloudIsAvailable().then(isAvailable => {
      if (!isAvailable) {
        // setStep('backup_not_available');
        toast.show(
          t('page.newAddress.seedPhrase.backupErrorCloudNotAvailable'),
        );
        onDone();
      }
    });
  }, [onDone, t]);

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View style={styles.section}>
        <ListItem
          onPress={() => {
            navigate(RootNames.StackAddress2024, {
              screen: RootNames.CreateSelectMethod,
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.createAddress')}
          Icon={<IconCreate style={styles.icon} />}
        />
        <ListItem
          onPress={() => {
            navigate(RootNames.StackAddress, {
              screen: RootNames.ImportMethods,
              params: {
                hasCurrentAddress: true,
              },
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.importAddress')}
          Icon={<IconImport style={styles.icon} />}
        />
        <ListItem
          onPress={() => {
            navigate(RootNames.StackAddress, {
              screen: RootNames.ImportHardwareAddress,
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.hardwareWallet')}
          Icon={<Image source={IconHardWare} style={styles.icon} />}
        />
      </View>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    display: 'flex',
    paddingTop: 0,
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  icon: {
    width: 40,
    height: 40,
  },
  section: {
    width: '100%',
    padding: 24,
    // marginBottom: 20,
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
  },
  item: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  importItem: {
    height: 88,
    paddingHorizontal: 20,
    paddingVertical: 24,
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 30,
    borderWidth: 1,
    borderColor: ctx.colors2024['neutral-line'],
    justifyContent: 'space-between',
    padding: 0,
    gap: 12,
  },
  importType: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
}));
