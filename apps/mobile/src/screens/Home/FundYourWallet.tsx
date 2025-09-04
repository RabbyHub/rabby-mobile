import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, TouchableOpacity, View } from 'react-native';

import RcIconImportCC from '@/assets2024/icons/home/IconImportCC.svg';
import RcIconReceiveCC from '@/assets2024/icons/home/IconReceiveCC.svg';
import RcIconBuyCC from '@/assets2024/icons/home/IconBuyCC.svg';
import RcIconRightArrow from '@/assets2024/icons/home/rightArrow.svg';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions } from '@react-navigation/native';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { SvgProps } from 'react-native-svg';
import React from 'react';

export const FundYourWallet = ({
  noAssetsList,
  onClose,
}: {
  noAssetsList: {
    title: string;
    desc: string;
    icon: React.FC<SvgProps>;
    onPress: () => void;
  }[];
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <>
      <Image
        source={require('@/assets2024/icons/home/buy-bg.png')}
        style={styles.bgb2}
      />
      <View style={styles.noAssetsContainer}>
        <Text style={styles.header}>
          {t('page.singleHome.emptyToken.title')}
        </Text>
        <Text style={styles.desc}>{t('page.singleHome.emptyToken.desc')}</Text>
        <View style={styles.list}>
          {noAssetsList.map(item => {
            return (
              <TouchableOpacity
                key={item.title}
                style={styles.noAssetsItem}
                onPress={() => {
                  onClose?.();
                  item.onPress?.();
                }}>
                <View style={styles.itemInner}>
                  <View style={styles.noAssetsIconWrapper}>
                    <item.icon
                      width={16.8}
                      height={16.8}
                      color={colors2024['brand-default-icon']}
                    />
                  </View>
                  <View style={styles.noAssetsRight}>
                    <Text style={styles.noAssetsItemName}>{item.title}</Text>
                    <Text style={styles.noAssetsItemDesc}>{item.desc}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
};

export const FoundYourWalletGuide = () => {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { navigation } = useSafeSetNavigationOptions();

  const noAssetsList = useMemo(
    () => [
      {
        title: t('page.nextComponent.multiAddressHome.importAddress'),
        desc: t('page.nextComponent.multiAddressHome.importAddressDesc'),
        icon: RcIconImportCC,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackAddress, {
              screen: RootNames.ImportMethods,
              params: {
                isNotNewUserProc: true,
                isFromEmptyAddress: true,
              },
            }),
          );
        },
      },
      {
        title: t('page.nextComponent.multiAddressHome.receiveCrypto'),
        desc: t('page.nextComponent.multiAddressHome.receiveCryptoDesc'),
        icon: RcIconReceiveCC,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackAddress, {
              screen: RootNames.ReceiveAddressList,
              params: {},
            }),
          );
        },
      },
      // {
      //   title: t('page.nextComponent.multiAddressHome.buyWithFiat'),
      //   desc: t('page.nextComponent.multiAddressHome.buyWithFiatDesc'),
      //   icon: RcIconBuyCC,
      //   onPress: () => {
      //     navigation.dispatch(
      //       StackActions.push(RootNames.StackTransaction, {
      //         screen: RootNames.MultiBuy,
      //         params: {},
      //       }),
      //     );
      //   },
      // },
    ],
    [t, navigation],
  );

  const onPress = () => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.FOUND_YOUR_WALLET_GUIDE,
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          height: 0,
          backgroundColor: 'transparent',
          overflow: 'visible',
          padding: 0,
          paddingTop: 0,
          paddingStart: 0,
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: [{ translateX: -25 }],
        },
      },
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      noAssetsList,
    });
  };
  return (
    <Pressable style={styles.foundGuideContainer} onPress={onPress}>
      <Image
        source={require('@/assets2024/icons/home/guide.png')}
        style={styles.bgb2}
      />
      <View style={styles.foundGuideContent}>
        <View style={styles.foundGuideTitleWrapper}>
          <Text style={styles.foundGuideTitle}>
            {t('page.nextComponent.multiAddressHome.foundGuideTitle')}
          </Text>
          <RcIconRightArrow
            width={17}
            height={21}
            color={colors2024['neutral-title-1']}
          />
        </View>
        <Text style={styles.foundGuideDesc}>
          {t('page.nextComponent.multiAddressHome.foundGuideDesc')}
        </Text>
      </View>
    </Pressable>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  noAssetsContainer: {
    marginHorizontal: 16,
    height: 434,
  },

  bgb2: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  noAssetsTitle: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 36,
    marginVertical: 42,
  },

  list: { gap: 12, paddingHorizontal: 0 },

  noAssetsItem: {
    height: 86,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
  },
  header: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    marginTop: 48,
    color: colors2024['neutral-title-1'],
  },
  desc: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    marginTop: 12,
    textAlign: 'center',
    marginBottom: 20,
    color: colors2024['neutral-secondary'],
  },

  itemInner: {
    flexDirection: 'row',
    gap: 12,
  },
  noAssetsIconWrapper: {
    width: 28,
    height: 28,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 9.8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAssetsRight: {
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  noAssetsItemName: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  noAssetsItemDesc: {
    maxWidth: '100%',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 20,
  },
  foundGuideContainer: {
    borderWidth: 1,
    borderColor: colors2024['brand-light-1'],
    backgroundColor: colors2024['brand-light-1'],
    height: 76,
    borderRadius: 12,
    marginLeft: 15,
    marginRight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  foundGuideContent: {
    gap: 4,
  },
  foundGuideTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontStyle: 'normal',
    fontWeight: '700',
  },
  foundGuideDesc: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
  },
  foundGuideTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
}));
