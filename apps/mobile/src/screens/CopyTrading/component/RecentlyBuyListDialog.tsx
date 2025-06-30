import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';

import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import {
  Dimensions,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Image,
  Linking,
} from 'react-native';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import ImgTwitter from '@/assets2024/icons/copyTrading/ImgTwitter.png';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { CopyTradeTokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AssetAvatar } from '@/components';
import { getTokenSymbol } from '@/utils/token';
import { Button } from '@/components2024/Button';
import { useMemoizedFn, useRequest } from 'ahooks';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { findChain } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';
import { BuyItem, SkeletonBuyItem } from './BuyItem';
import { RcIconRightCC, RcIconSelectCC } from '@/assets/icons/common';

import { TokenInfo } from './TokenInfo';
import { SmartWallets } from './SmartWallets';
import { SameNameTokens } from './SameNameTokens';

export type DialogProps = {
  tradingTokenItem: CopyTradeTokenItem;
  onClose?: () => void;
};

enum TabType {
  tokenInfo = 'tokenInfo',
  smartWallets = 'smartWallets',
  sameNameTokens = 'sameNameTokens',
}

export default function RecentlyBuyListDialog({
  tradingTokenItem,
  onClose,
}: RNViewProps & DialogProps) {
  const { t } = useTranslation();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  // Tab state management
  const [activeTab, setActiveTab] = useState<TabType>(TabType.tokenInfo);

  const tabBarData = React.useMemo(() => {
    return [
      { key: TabType.tokenInfo, label: t('page.copyTrading.tokenInfo') },
      { key: TabType.smartWallets, label: t('page.copyTrading.smartWallets') },
      {
        key: TabType.sameNameTokens,
        label: t('page.copyTrading.sameNameTokens'),
      },
    ];
  }, [t]);

  const handleBuyPress = useMemoizedFn((item: CopyTradeTokenItem) => {
    const chain = findChain({
      serverId: item.chain,
    });
    onClose?.();
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.MultiSwap,
      params: {
        chainEnum: chain?.enum ?? CHAINS_ENUM.ETH,
        tokenId: item?.id,
        type: 'Buy',
        isFromCopyTrading: true,
      },
    });
  });

  // Render skeleton items when loading
  const renderSkeletonList = useMemoizedFn(() => {
    return (
      <View>
        {Array.from({ length: 2 }).map((_, index) => (
          <SkeletonBuyItem key={index} />
        ))}
      </View>
    );
  });

  const handleTwitterPress = useMemoizedFn(async () => {
    const symbol = getTokenSymbol(tradingTokenItem);
    const searchQuery = encodeURIComponent(symbol);

    const appUrls = [
      `twitter://search?query=${searchQuery}`,
      `x://search?query=${searchQuery}`,
    ];
    const webUrl = `https://x.com/search?q=${searchQuery}`;

    try {
      for (const appUrl of appUrls) {
        const canOpen = await Linking.canOpenURL(appUrl);
        if (canOpen) {
          await Linking.openURL(appUrl);
          return;
        }
      }

      await Linking.openURL(webUrl);
    } catch (error) {
      console.error('Failed to open Twitter/X:', error);
      try {
        await Linking.openURL(webUrl);
      } catch (fallbackError) {
        console.error('Failed to open web URL:', fallbackError);
      }
    }
  });

  const TabContentComponent = useMemo(() => {
    switch (activeTab) {
      case TabType.tokenInfo:
        return <TokenInfo tradingTokenItem={tradingTokenItem} />;
      case TabType.smartWallets:
        return <SmartWallets tradingTokenItem={tradingTokenItem} />;
      case TabType.sameNameTokens:
        return <SameNameTokens tradingTokenItem={tradingTokenItem} />;
    }
  }, [activeTab, tradingTokenItem]);

  return (
    <AutoLockView style={styles.container}>
      {/* Header with token info */}
      <BottomSheetHandlableView style={styles.headerContainer}>
        <View style={styles.header}>
          <View style={styles.tokenHeader}>
            <AssetAvatar
              logo={tradingTokenItem?.logo_url}
              size={36}
              chain={tradingTokenItem?.chain}
              chainSize={16}
            />
            <Text
              style={styles.tokenName}
              numberOfLines={1}
              ellipsizeMode="tail">
              {getTokenSymbol(tradingTokenItem)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.tokenHeaderTwitter}
            onPress={handleTwitterPress}>
            <Image source={ImgTwitter} style={styles.tokenHeaderTwitterIcon} />
            <Text
              style={styles.twitterName}
              numberOfLines={1}
              ellipsizeMode="tail">
              {t('page.copyTrading.twitterNews')}
            </Text>
            <RcIconRightCC
              width={18}
              height={18}
              color={colors2024['neutral-title-1']}
            />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {tabBarData.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem]}
              onPress={() => setActiveTab(tab.key)}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetHandlableView>

      <View style={styles.scrollContent}>{TabContentComponent}</View>

      {/* Fixed bottom button */}
      <View style={styles.bottomButton}>
        <Button
          type="primary"
          title={t('page.copyTrading.buy')}
          onPress={() => handleBuyPress(tradingTokenItem)}
        />
      </View>
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    height: '100%',
    // paddingHorizontal: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  headerContainer: {
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  trendChart: {
    width: '100%',
    height: 100,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  skeletonBorder: {
    borderRadius: 4,
    backgroundColor: colors2024['neutral-bg-5'],
  },
  header: {
    height: 38,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tokenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',

    padding: 6,
  },
  tokenHeaderTwitterIcon: {
    width: 20,
    height: 20,
  },
  tokenHeaderTwitter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 100,
    padding: 6,
  },
  twitterName: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  tokenName: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  scrollContent: {
    flex: 1,
  },
  listHeader: {
    paddingBottom: 0,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  priceSection: {
    gap: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  price: {
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  priceChangeLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  priceChange: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  dateTime: {
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  recentBuy: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  bottomButton: {
    paddingHorizontal: 20,
    paddingTop: 12,
    height: 115,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  tabItem: {
    // padding: 8,
    paddingHorizontal: 2,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 4,
    color: colors2024['neutral-secondary'],
    position: 'relative',
  },
  tabText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tabTextActive: {
    fontWeight: '700',
    color: colors2024['neutral-body'],
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors2024['neutral-body'],
  },
}));
