import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { useTranslation, Trans } from 'react-i18next';
import RCIconRabbyWhite from '@/assets2024/icons/bridge/FeeRabbyWallet.svg';
// import RCIconRabbyWhite from '@/assets/icons/swap/rabby.svg'; // Ensure this is a compatible React Native SVG component
import ImgMetaMask from '@/assets/icons/swap/metamask.png';
import ImgPhantom from '@/assets/icons/swap/phantom.png';
import ImgRabbyWallet from '@/assets/icons/swap/rabby-wallet.png';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
// import { Button } from '@components2024/swap';
import { Button } from '@/components2024/Button';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEX } from '@/constant/swap';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const swapFee = [
  {
    name: 'MetaMask',
    logo: ImgMetaMask,
    rate: '0.875%',
  },
  {
    name: 'Phantom',
    logo: ImgPhantom,
    rate: '0.85%',
  },
  {
    name: 'Rabby Wallet',
    logo: ImgRabbyWallet,
    rate: '0.25%',
  },
];

const bridgeList = [
  {
    name: 'MetaMask',
    logo: ImgMetaMask,
    rate: '0.875%',
  },
  {
    name: 'Rabby Wallet',
    logo: ImgRabbyWallet,
    rate: '0.25%',
  },
];

const fee = {
  swap: swapFee,
  bridge: bridgeList,
};

export const RabbyFeePopup = ({
  visible,
  onClose,
  type = 'swap',
  dexFeeDesc,
  dexName,
}: {
  visible: boolean;
  onClose: () => void;
  type?: keyof typeof fee;
  dexFeeDesc?: string;
  dexName?: string;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });
  const { sheetModalRef } = useSheetModal();

  const hasSwapDexFee = useMemo(() => {
    return type === 'swap' && dexName && dexFeeDesc && DEX?.[dexName]?.logo;
  }, [type, dexName, dexFeeDesc]);

  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const snapPoints = useMemo(
    () => [
      Math.min(type === 'swap' ? (hasSwapDexFee ? 740 : 700) : 620, height),
    ],
    [type, hasSwapDexFee, height],
  );

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [sheetModalRef, visible]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      snapPoints={snapPoints}
      enableDismissOnClose
      onDismiss={onClose}
      handleStyle={styles.sheetBg}
      backgroundStyle={styles.sheetBg}>
      <BottomSheetScrollView>
        <View style={[styles.contentContainer, { paddingBottom: 20 + bottom }]}>
          <View style={styles.iconContainer}>
            <RCIconRabbyWhite width={70} height={70} />
          </View>

          <Text style={styles.title}>{t('page.swap.rabbyFee.title')}</Text>

          <Text style={styles.description}>
            <Trans
              t={t}
              i18nKey={
                type === 'swap'
                  ? t('page.swap.rabbyFee.swapDesc')
                  : t('page.swap.rabbyFee.bridgeDesc')
              }
              components={{
                1: <Text style={styles.highlightText} />,
              }}
            />
          </Text>

          <View style={styles.header}>
            <Text style={styles.headerText}>
              {t('page.swap.rabbyFee.wallet')}
            </Text>
            <Text style={styles.headerText}>
              {t('page.swap.rabbyFee.rate')}
            </Text>
          </View>

          <View style={styles.listContainer}>
            {fee[type].map((item, idx, list) => (
              <View
                key={item.name}
                style={[
                  styles.listItem,
                  idx === list.length - 1 ? styles.noBorder : {},
                ]}>
                <View style={styles.itemLeft}>
                  <Image source={item.logo} style={styles.logo} />
                  <Text
                    style={[
                      styles.itemText,
                      item.name === 'Rabby Wallet' ? styles.highItem : {},
                    ]}>
                    {item.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.itemText,
                    item.name === 'Rabby Wallet' ? styles.highItem : {},
                  ]}>
                  {item.rate}
                </Text>
              </View>
            ))}
          </View>

          <SwapAggregatorFee dexName={dexName} feeDexDesc={dexFeeDesc} />

          <View style={styles.buttonContainer}>
            <Button
              type="primary"
              onPress={onClose}
              title={t('page.swap.rabbyFee.button')}
            />
          </View>
        </View>
      </BottomSheetScrollView>
    </AppBottomSheetModal>
  );
};

function SwapAggregatorFee({
  dexName,
  feeDexDesc,
}: {
  dexName?: string;
  feeDexDesc?: string;
}) {
  const { styles } = useTheme2024({ getStyle });
  const { width } = useWindowDimensions();
  if (dexName && feeDexDesc && DEX?.[dexName]?.logo) {
    return (
      <View style={styles.dexFeeContainer}>
        <Image source={DEX[dexName].logo} style={styles.dexFeeLogo} />
        <View>
          <Text style={[styles.dexFeeText, { maxWidth: width - 40 - 14 - 2 }]}>
            {feeDexDesc}
          </Text>
        </View>
      </View>
    );
  }
  return null;
}

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  sheetBg: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  iconContainer: {
    width: 70,
    height: 70,
    marginVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 45,
    backgroundColor: colors['blue-default'],
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
    marginVertical: 12,
  },
  description: {
    fontSize: 17,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 22,
    color: colors2024['neutral-secondary'],
  },
  highlightText: {
    color: colors['neutral-body'],
    fontWeight: '700',
  },
  header: {
    backgroundColor: colors2024['neutral-bg-2'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 0.5,
    // borderBottomColor: colors2024['neutral-line'],
    borderColor: colors2024['neutral-line'],
    marginTop: 20,
    height: 52,
    alignItems: 'center',
    // marginBottom: 8,
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontSize: 17,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    lineHeight: 22,
  },
  listContainer: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors2024['neutral-line'],
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    // borderRadius: 6,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 63,
    borderBottomWidth: 0.5,
    borderBottomColor: colors['neutral-line'],
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  itemText: {
    color: colors2024['neutral-body'],
    fontSize: 16,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    lineHeight: 20,
  },
  highItem: {
    color: colors['neutral-title-1'],
    fontWeight: '700',
  },
  dexFeeContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 0,
    marginTop: 20,
    gap: 3,
  },
  dexFeeLogo: {
    flexBasis: 14,
    width: 14,
    height: 14,
    borderRadius: 999999,
  },
  dexFeeText: {
    flexShrink: 0,
    fontSize: 13,
    color: colors['neutral-foot'],
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    marginVertical: 20,
  },
}));
