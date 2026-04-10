import React from 'react';
import { View, ScrollView, Pressable, StyleSheet, Image } from 'react-native';

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
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';

import RightArrowSVG from '@/assets2024/icons/common/right-cc.svg';
import HelpSVG from '@/assets2024/icons/common/help.svg';

// Wallet brand icons
import MetaMaskSVG from '@/assets/icons/wallet/metamask.svg';
import CoinbaseSVG from '@/assets/icons/wallet/coinbase.svg';
import GreenDotsSVG from '@/assets2024/icons/wallet/green-dots.svg';
import PurpleWalletSVG from '@/assets2024/icons/wallet/purple-wallet.svg';
import OtherWalletSVG from '@/assets2024/icons/wallet/other-wallet.svg';

// Hardware wallet icons
import LedgerPNG from '@/assets2024/icons/wallet/ledger.png';
import TrezorPNG from '@/assets2024/icons/wallet/trezor.png';
import OneKeyPNG from '@/assets2024/icons/wallet/onekey.png';
import KeystonePNG from '@/assets2024/icons/wallet/keystone.png';

type SelectImportMethodProps = NativeStackScreenProps<
  RootStackParamsList,
  'SelectImportMethod'
>;

function SelectImportMethod(): JSX.Element {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const navigation = useNavigation<SelectImportMethodProps['navigation']>();

  const handleSeedPhraseOrPrivateKey = React.useCallback(() => {
    navigation.navigate(RootNames.ImportSecret);
  }, [navigation]);

  const handleHardwareWallet = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.ImportHardwareAddress,
    });
    preferenceService.setReportActionTs(
      REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE,
    );
  }, [navigation]);

  const handleTips = React.useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      bottomSheetModalProps: {
        enableDismissOnClose: true,
        snapPoints: ['48%'],
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
        titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
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
          {/* Seed Phrase or Private Key Option */}
          <Card
            style={styles.importItem}
            onPress={handleSeedPhraseOrPrivateKey}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                {t('page.nextComponent.addAddress.seedPhraseOrPrivateKey')}
              </Text>
              <View style={styles.iconRow}>
                <MetaMaskSVG width={20} height={20} />
                <GreenDotsSVG width={20} height={20} />
                <PurpleWalletSVG width={20} height={20} />
                <OtherWalletSVG width={20} height={20} />
                <CoinbaseSVG width={20} height={20} />
              </View>
            </View>
            <View style={styles.arrowWrapper}>
              <RightArrowSVG
                width={12}
                height={12}
                color={colors2024['neutral-title-1']}
              />
            </View>
          </Card>

          {/* Hardware Wallet Option */}
          <Card style={styles.importItem} onPress={handleHardwareWallet}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                {t('page.nextComponent.addAddress.hardwareWallet')}
              </Text>
              <View style={styles.iconRow}>
                <Image source={LedgerPNG} style={styles.hardwareIcon} />
                <Image source={TrezorPNG} style={styles.hardwareIcon} />
                <Image source={OneKeyPNG} style={styles.hardwareIcon} />
                <Image source={KeystonePNG} style={styles.hardwareIcon} />
              </View>
            </View>
            <View style={styles.arrowWrapper}>
              <RightArrowSVG
                width={12}
                height={12}
                color={colors2024['neutral-title-1']}
              />
            </View>
          </Card>
        </ScrollView>

        {/* Bottom Tips */}
        <Pressable style={styles.tipWrapper} onPress={handleTips}>
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
    backgroundColor: ctx.colors2024['neutral-bg-0'],
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  importItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 24,
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
    flex: 1,
    gap: 12,
  },
  itemTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    color: ctx.colors2024['neutral-title-1'],
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  hardwareIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
  },
  arrowWrapper: {
    width: 26,
    height: 26,
    borderRadius: 100,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingBottom: 67,
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

export default SelectImportMethod;
