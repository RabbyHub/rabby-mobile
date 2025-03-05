import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, TouchableOpacity, View } from 'react-native';

import RcIconImport from '@/assets2024/icons/home/IconImport.svg';
import RcIconReceive from '@/assets2024/icons/home/IconReceive.svg';
import RcIconBuy from '@/assets2024/icons/home/IconBuy.svg';

import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StackActions } from '@react-navigation/native';

export const FundYourWallet = () => {
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle });

  const noAssetsList = useMemo(
    () => [
      {
        title: t('page.nextComponent.multiAddressHome.importAddress'),
        desc: t('page.nextComponent.multiAddressHome.importAddressDesc'),
        icon: RcIconImport,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackAddress, {
              screen: RootNames.ImportMethods,
              params: {
                isNotNewUserProc: true,
              },
            }),
          );
        },
      },
      {
        title: t('page.nextComponent.multiAddressHome.receiveCrypto'),
        desc: t('page.nextComponent.multiAddressHome.receiveCryptoDesc'),
        icon: RcIconReceive,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackAddress, {
              screen: RootNames.ReceiveAddressList,
              params: {},
            }),
          );
        },
      },
      {
        title: t('page.nextComponent.multiAddressHome.buyWithFiat'),
        desc: t('page.nextComponent.multiAddressHome.buyWithFiatDesc'),
        icon: RcIconBuy,
        // iconStyle: styles.buyIcon,
        onPress: () => {
          navigation.dispatch(
            StackActions.push(RootNames.StackTransaction, {
              screen: RootNames.MultiBuy,
              params: {},
            }),
          );
        },
      },
    ],
    [t, navigation],
  );
  return (
    <View style={styles.noAssetsContainer}>
      <Image
        source={require('@/assets2024/icons/home/buy-bg.png')}
        style={styles.bgb2}
      />
      <Text style={styles.noAssetsTitle}>
        {t('page.nextComponent.multiAddressHome.fundYourWallet')}
      </Text>
      <View style={styles.list}>
        {noAssetsList.map(item => {
          return (
            <TouchableOpacity
              key={item.title}
              style={styles.noAssetsItem}
              onPress={item.onPress}>
              <View style={styles.itemInner}>
                <View style={styles.noAssetsIconWrapper}>
                  <item.icon width={16.8} height={16.8} />
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
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  noAssetsContainer: {
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 24,
    overflow: 'hidden',
    marginHorizontal: 16,
    height: 488,
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

  list: { gap: 12, paddingHorizontal: 16 },

  noAssetsItem: {
    height: 98,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
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
}));
