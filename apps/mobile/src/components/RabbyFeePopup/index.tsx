import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import RCIconRabbyWhite from '@/assets/icons/swap/rabby.svg'; // Ensure this is a compatible React Native SVG component
import ImgMetaMask from '@/assets/icons/swap/metamask.png';
import ImgPhantom from '@/assets/icons/swap/phantom.png';
import ImgRabbyWallet from '@/assets/icons/swap/rabby-wallet.png';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { Button } from '../Button';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DEX } from '@/constant/swap';

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
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { sheetModalRef } = useSheetModal();

  const hasSwapDexFee = useMemo(() => {
    return type === 'swap' && dexName && dexFeeDesc && DEX?.[dexName]?.logo;
  }, [type, dexName, dexFeeDesc]);

  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();

  const snapPoints = useMemo(
    () => [
      Math.min(type === 'swap' ? (hasSwapDexFee ? 574 : 548) : 520, height),
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
      <View style={[styles.contentContainer, { paddingBottom: 20 + bottom }]}>
        <View style={styles.iconContainer}>
          <RCIconRabbyWhite width={36} height={30} />
        </View>

        <Text style={styles.title}>{t('page.swap.rabbyFee.title')}</Text>

        <Text style={styles.description}>
          {type === 'swap'
            ? t('page.swap.rabbyFee.swapDesc')
            : t('page.swap.rabbyFee.bridgeDesc')}
        </Text>

        <View style={styles.header}>
          <Text style={styles.headerText}>
            {t('page.swap.rabbyFee.wallet')}
          </Text>
          <Text style={styles.headerText}>{t('page.swap.rabbyFee.rate')}</Text>
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
                <Text style={styles.itemText}>{item.name}</Text>
              </View>
              <Text style={styles.itemText}>{item.rate}</Text>
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
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

const getStyles = createGetStyles(colors => ({
  sheetBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: colors['neutral-bg-2'],
  },
  iconContainer: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 26,
    backgroundColor: colors['blue-default'],
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '500',
    color: colors['neutral-title1'],
    marginVertical: 12,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: colors['neutral-body'],
    lineHeight: 21,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 12,
    color: colors['neutral-foot'],
  },
  listContainer: {
    width: '100%',
    borderWidth: 0.5,
    borderColor: colors['neutral-line'],
    borderRadius: 6,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-title1'],
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
  },
}));
