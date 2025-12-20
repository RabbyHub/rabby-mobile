import React from 'react';
import { View, Image, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import IconHardWare from '@/assets2024/icons/common/IconHardWare.png';
import IconImport from '@/assets2024/icons/common/IconImport.svg';
import IconCreate from '@/assets2024/icons/common/IconCreate.svg';
import IconSyncRabby from '@/assets2024/icons/common/iconSyncExtension.svg';

import { naviPush } from '@/utils/navigation';
import { AppRootName, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ListItem } from '@/components2024/ListItem/ListItem';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  shouldRedirectToSetPasswordBefore2024: ReturnType<
    typeof useSetPasswordFirst
  >['shouldRedirectToSetPasswordBefore2024'];
}

export const AddAddressSelectMethod: React.FC<Props> = ({
  onDone,
  shouldRedirectToSetPasswordBefore2024,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <Text style={styles.title}>
        {t('page.nextComponent.addAddress.selectAddMethod')}
      </Text>
      <View style={styles.section}>
        <ListItem
          disableArrow={true}
          onPress={async () => {
            if (
              await shouldRedirectToSetPasswordBefore2024({
                backScreen: RootNames.CreateSelectMethod,
              })
            ) {
              onDone();
              return;
            }

            naviPush(RootNames.StackAddress, {
              screen: RootNames.CreateSelectMethod,
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.createAddress')}
          Icon={<IconCreate style={styles.icon} />}
        />
        <ListItem
          disableArrow={true}
          onPress={() => {
            naviPush(RootNames.StackAddress, {
              screen: RootNames.ImportMethods,
              params: {
                isNotNewUserProc: true,
              },
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.importAddress')}
          Icon={<IconImport style={styles.icon} />}
        />
        <ListItem
          disableArrow={true}
          onPress={() => {
            naviPush(RootNames.StackAddress, {
              screen: RootNames.ImportHardwareAddress,
            });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.hardwareWallet')}
          Icon={<Image source={IconHardWare} style={styles.icon} />}
        />

        <ListItem
          disableArrow={true}
          onPress={() => {
            preferenceService.setReportActionTs(
              REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION,
            );
            naviPush(RootNames.Scanner, { syncExtension: true });
            onDone();
          }}
          style={styles.importItem}
          title={t('page.nextComponent.addAddress.syncRabbyExtension')}
          Icon={<IconSyncRabby style={styles.icon} />}
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
  title: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: ctx.colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 0,
    marginTop: 12,
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
    // height: 88,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    // borderRadius: 30,
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
