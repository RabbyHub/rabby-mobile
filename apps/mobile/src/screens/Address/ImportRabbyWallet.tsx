import React from 'react';
import { View, ScrollView, Pressable, Image, Keyboard } from 'react-native';

import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { Text } from '@/components/Typography';
import { Card } from '@/components2024/Card';
import { RootNames } from '@/constant/layout';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { Trans, useTranslation } from 'react-i18next';
import { IS_IOS } from '@/core/native/utils';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';

import HelpSVG from '@/assets2024/icons/common/help.svg';
import IconSyncExtension from '@/assets2024/icons/common/iconSyncExtension.svg';

const IconIcloudSrc = require('@/assets2024/icons/common/IconIcloud.png');
const IconGoogleDriveSrc = require('@/assets2024/icons/common/IconGoogleDrive.png');

type ImportRabbyWalletProps = NativeStackScreenProps<
  RootStackParamsList,
  'ImportRabbyWallet'
>;

function ImportRabbyWallet(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<ImportRabbyWalletProps['navigation']>();
  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();

  const handleSyncExtension = React.useCallback(() => {
    navigation.navigate(RootNames.Scanner, { syncExtension: true });
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION,
    );
  }, [navigation]);

  const handleCloudRestore = React.useCallback(() => {
    Keyboard.dismiss();
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.RESTORE_FROM_CLOUD,
      shouldRedirect2SetPassword: shouldRedirectToSetPasswordBefore2024,
      onDone: () => {
        setTimeout(() => {
          removeGlobalBottomSheetModal2024(id);
        }, 0);
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024]);

  const handleCreateNewWallet = React.useCallback(() => {
    navigation.navigate(RootNames.SetupWallet);
  }, [navigation]);

  const handleHelp = React.useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      bottomSheetModalProps: {
        enableDismissOnClose: true,
        snapPoints: ['40%'],
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
      },
      title: t('page.nextComponent.importAddress.tips.title'),
      sections: [
        {
          description: t('page.nextComponent.importAddress.tips.description'),
        },
      ],
      nextButtonProps: {
        title: (
          <Text style={styles.modalNextButtonText}>
            {t('page.nextComponent.importAddress.tips.gotIt')}
          </Text>
        ),
        titleStyle: styles.modalNextButtonText,
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  }, [t, styles]);

  return (
    <NormalScreenContainer overwriteStyle={styles.wrapper}>
      <View style={styles.container}>
        {/* Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {t('page.newUserOnboarding.restoreWallet.subtitle')}
          </Text>

          {/* Sync Rabby Extension Option */}
          <Card style={styles.importItem} onPress={handleSyncExtension}>
            <View style={styles.itemContent}>
              <View style={styles.iconContainer}>
                <IconSyncExtension width={40} height={40} />
              </View>
              <Text style={styles.itemTitle}>
                {t('page.nextComponent.addAddress.syncRabbyExtension')}
              </Text>
            </View>
          </Card>

          {/* Import from iCloud/Google Drive Option */}
          <Card style={styles.importItem} onPress={handleCloudRestore}>
            <View style={styles.itemContent}>
              <View style={styles.iconContainer}>
                <Image
                  source={IS_IOS ? IconIcloudSrc : IconGoogleDriveSrc}
                  style={styles.cloudIcon}
                />
              </View>
              <Text style={styles.itemTitle}>
                {IS_IOS
                  ? t('page.nextComponent.importAddress.ImportCloud', {
                      cloud: 'iCloud',
                    })
                  : t('page.nextComponent.importAddress.ImportCloud', {
                      cloud: 'Google Drive',
                    })}
              </Text>
            </View>
          </Card>

          {/* Create New Wallet Link */}
          <View style={styles.linkWrapper}>
            <Text style={styles.linkText}>
              <Trans
                i18nKey="page.newUserOnboarding.common.orYouCanCreateNewWallet"
                t={t}
                components={{
                  clickable: (
                    <Text
                      key="clickable"
                      style={styles.linkTextHighlight}
                      onPress={handleCreateNewWallet}
                    />
                  ),
                }}
              />
            </Text>
          </View>
        </ScrollView>

        {/* Bottom Help */}
        <Pressable style={styles.tipWrapper} onPress={handleHelp}>
          <Text style={styles.tipText}>
            {t('page.nextComponent.importAddress.tips.entry')}
          </Text>
          <HelpSVG
            width={20}
            height={20}
            color={colors2024['neutral-secondary']}
          />
        </Pressable>
      </View>
    </NormalScreenContainer>
  );
}

const getStyles = createGetStyles2024(ctx => ({
  wrapper: {
    flex: 1,
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  subtitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
    textAlign: 'center',
    marginBottom: 24,
  },
  importItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: ctx.colors2024['neutral-card-1'],
    borderWidth: 0,
    shadowColor: 'rgba(55, 56, 63, 0.02)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cloudIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
  },
  itemTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    color: ctx.colors2024['neutral-title-1'],
  },
  linkWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  linkTextHighlight: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: ctx.colors2024['brand-default'],
  },
  tipWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 40,
    paddingTop: 16,
  },
  tipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    color: ctx.colors2024['neutral-secondary'],
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    backgroundColor: ctx.colors2024['brand-default'],
    color: ctx.colors2024['neutral-InvertHighlight'],
  },
}));

export default ImportRabbyWallet;
