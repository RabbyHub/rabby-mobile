import { Account } from '@/core/services/preference';
import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { apiContact, apisPerps } from '@/core/apis';
import React, { useEffect, useMemo } from 'react';
import { ellipsisAddress } from '@/utils/address';
import { CaretArrowIconCC } from '@/components/Icons/CaretArrowIconCC';
import RcCaretDownSmallCC from '@/assets2024/icons/common/caret-down-small-cc.svg';
import { HeaderBackPressable, useRabbyAppNavigation } from '@/hooks/navigation';
import { AccountSelectorPopup } from '@/components2024/AccountSelector/AccountSelectorPopup';
import { KeyringAccountWithAlias } from '@/core/apis/account';
import useProtocolListStore from '@/store/protocols';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { formatNetworth } from '@/utils/math';

import { formatUsdValue } from '@/utils/number';
import { useShallow } from 'zustand/shallow';
import { dappService } from '@/core/services';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useAppChainStore from '@/store/appchain';
import useAsync from 'react-use/lib/useAsync';

const PngPolymarket = require('@/assets2024/icons/prediction/polymarket.png');
const PngHyperliquid = require('@/assets2024/icons/perps/hyperliquid.png');
const PngAster = require('@/assets2024/icons/perps/aster.png');
const PngLighter = require('@/assets2024/icons/perps/lighter.png');
const PngAave = require('@/assets2024/icons/lending/aave.png');
const PngSpark = require('@/assets2024/icons/lending/spark.png');
const PngVenus = require('@/assets2024/icons/lending/venus.png');

export type DappSelectItem = {
  id: string;
  name: string;
  icon: number;
  url?: string;
  description?: string;
  rightText?: string;
  onPress?: (item: DappSelectItem) => void;
  themeColor: string;
  TVL: string;
  value?: string;
  remoteUrl?: string;
};

const PREDICTION: DappSelectItem[] = [
  {
    id: 'polymarket',
    name: 'Polymarket',
    icon: PngPolymarket,
    url: 'https://polymarket.com/',
    themeColor: 'rgba(22, 82, 240, 0.06)',
    TVL: '$156.396b',
  },
];

const LENDING: DappSelectItem[] = [
  {
    id: 'aave',
    name: 'Aave',
    icon: PngAave,
    url: 'https://app.aave.com',
    themeColor: 'rgba(147, 145, 247, 0.10)',
    TVL: '$33.803b',
  },
  {
    id: 'spark',
    name: 'Spark',
    icon: PngSpark,
    url: 'https://app.spark.fi/my-portfolio',
    themeColor: 'rgba(252, 105, 137, 0.08)',
    TVL: '$5.977b',
  },
  {
    id: 'venus',
    name: 'Venus',
    icon: PngVenus,
    url: 'https://app.venus.io',
    themeColor: 'rgba(58, 121, 253, 0.08)',
    TVL: '$1.635b',
  },
];

const PERPS: DappSelectItem[] = [
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    icon: PngHyperliquid,
    url: 'https://app.hyperliquid.xyz/',
    themeColor: 'rgba(175, 249, 229, 0.15)',
    TVL: '$156.396b',
  },
  {
    id: 'aster',
    name: 'Aster',
    icon: PngAster,
    url: 'https://www.asterdex.com/trade/pro/futures/BTCUSDT',
    themeColor: 'rgba(247, 212, 172, 0.16)',
    TVL: '$124.388b',
  },
  {
    id: 'lighter',
    name: 'Lighter',
    icon: PngLighter,
    url: 'https://app.lighter.xyz/trade/LIT_USDC',
    themeColor: 'rgba(11, 11, 11, 0.06)',
    TVL: '$116.548b',
  },
];

export const INNER_DAPP_LIST = {
  PREDICTION,
  LENDING,
  PERPS,
} as const;

const getOriginKey = (url?: string) => {
  if (!url) {
    return undefined;
  }
  const origin = safeGetOrigin(url) || safeGetOrigin(`https://${url}`) || url;
  return origin ? origin.toLowerCase() : undefined;
};

const AccountItem = ({
  account,
  isShowAccountList,
  onPress,
  onCloseAccountList,
  onSelectAccount,
  disablePopup,
}: {
  account?: Account;
  isShowAccountList?: boolean;
  onPress?: () => void;
  onCloseAccountList?: () => void;
  onSelectAccount?: (account: Account) => void;
  disablePopup?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const alias = React.useMemo(() => {
    if (!account?.address) {
      return;
    }
    return apiContact.getAliasName(account?.address);
  }, [account?.address]);

  if (!account) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          onPress?.();
        }}
        disabled={!account}>
        <View style={styles.container}>
          {account ? (
            <View style={styles.addressContainer}>
              <WalletIcon
                style={styles.walletIcon}
                width={18}
                height={18}
                type={account.brandName}
                address={account.address}
              />
              <Text style={styles.address}>
                {alias || ellipsisAddress(account?.address)}
              </Text>
              <CaretArrowIconCC
                dir="down"
                style={[isShowAccountList ? styles.reverseCaret : null]}
                width={18}
                height={18}
                bgColor={colors2024['neutral-bg-5']}
                lineColor={colors2024['neutral-title-1']}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      {!disablePopup ? (
        <AccountSelectorPopup
          visible={!!isShowAccountList}
          onClose={onCloseAccountList}
          value={account}
          onChange={nextAccount => {
            onSelectAccount?.(nextAccount);
            onCloseAccountList?.();
          }}
        />
      ) : null}
    </>
  );
};

const DappSelect = (props: {
  activeId: string;
  list: DappSelectItem[];
  title?: string;
  onSelect?: (item: DappSelectItem) => void;
}) => {
  const { activeId, list, title, onSelect } = props;
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { height } = useWindowDimensions();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const [visible, setVisible] = React.useState(false);
  const maxHeight = React.useMemo(() => height - 200, [height]);

  const activeItem = list.find(item => item.id === activeId);
  const sheetTitle = title ?? 'Select Dapp';

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }
    modalRef.current?.dismiss();
  }, [visible]);

  const handleOpen = React.useCallback(() => {
    setVisible(true);
  }, []);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
  }, []);

  const handleSelect = React.useCallback(
    (item: DappSelectItem) => {
      item.onPress?.(item);
      onSelect?.(item);
      setVisible(false);
    },
    [onSelect],
  );

  if (!activeItem) {
    return null;
  }

  return (
    <>
      <TouchableOpacity style={styles.leftGroup} onPress={handleOpen}>
        <View
          style={[
            styles.marketPill,
            { backgroundColor: activeItem.themeColor },
          ]}>
          <FastImage
            style={styles.marketIcon}
            defaultSource={activeItem.icon}
            source={
              activeItem?.remoteUrl
                ? { uri: activeItem?.remoteUrl }
                : activeItem.icon
            }
          />
          <View style={styles.marketTextGroup}>
            <Text style={styles.marketText}>{activeItem.name}</Text>
            <RcCaretDownSmallCC
              style={styles.marketCaret}
              color={colors2024['neutral-info']}
            />
          </View>
        </View>
      </TouchableOpacity>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0', //isLight ? 'bg0' : 'bg1',
        })}
        onDismiss={handleDismiss}
        enableDynamicSizing
        enableContentPanningGesture
        maxDynamicContentSize={maxHeight}>
        <BottomSheetScrollView>
          <AutoLockView style={styles.sheetContainer}>
            {sheetTitle ? (
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            ) : null}
            <View style={styles.sheetList}>
              {list.map(item => {
                const rightText = item.rightText ?? item.value;

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}>
                    <View
                      style={[
                        styles.sheetItem,
                        item.id === activeId && styles.sheetItemActive,
                      ]}>
                      <View style={styles.sheetItemLeft}>
                        <FastImage
                          style={styles.sheetItemIcon}
                          defaultSource={item.icon}
                          source={
                            item?.remoteUrl
                              ? { uri: item?.remoteUrl }
                              : item.icon
                          }
                        />
                        <View style={styles.sheetItemTextGroup}>
                          <Text style={styles.sheetItemTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.description ? (
                            <Text
                              style={styles.sheetItemSubtitle}
                              numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                          {item.TVL ? (
                            <Text
                              style={styles.sheetItemMeta}
                              numberOfLines={1}>
                              {`TVL:${item.TVL}`}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {rightText ? (
                        <Text style={styles.sheetItemRight} numberOfLines={1}>
                          {rightText}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AutoLockView>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};
export const DappFrameAccountHeader_LAYOUT = {
  height: 38,
};
export const DappFrameAccountHeader = (props: {
  account?: Account | KeyringAccountWithAlias;
  onPressAccountList?: () => void;
  isShowAccountList?: boolean;
  title?: React.ReactNode;
  activeId: string;
  dAppList: DappSelectItem[];
  dappSelectTitle?: string;
  onSelectDapp?: (item: DappSelectItem) => void;
  onSelectAccount?: (account: Account) => void;
  rightAddon?: React.ReactNode;
  disableAccountPopup?: boolean;
}) => {
  const {
    account,
    onPressAccountList,
    isShowAccountList,
    title,
    activeId,
    dAppList,
    dappSelectTitle,
    onSelectDapp,
    onSelectAccount,
    rightAddon,
    disableAccountPopup,
  } = props;

  const navigation = useRabbyAppNavigation();
  const { styles } = useTheme2024({ getStyle });
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] =
    React.useState(false);
  const isAccountSelectorControlled = isShowAccountList !== undefined;
  const accountSelectorVisible = isAccountSelectorControlled
    ? !!isShowAccountList
    : isAccountSelectorOpen;
  const protocolMap = useProtocolListStore(
    useShallow(state => state.protocolMap),
  );

  const defiValueByOrigin = React.useMemo(() => {
    const address = account?.address?.toLowerCase();
    if (!address) {
      return new Map<string, number>();
    }
    const protocols = protocolMap[address] || [];

    if (!protocols.length) {
      return new Map<string, number>();
    }
    const map = new Map<string, number>();
    protocols.forEach(protocol => {
      const originKey = getOriginKey(protocol.site_url);
      if (!originKey) {
        return;
      }
      const netWorth = Number(protocol.netWorth || 0);
      if (Number.isNaN(netWorth)) {
        return;
      }
      map.set(originKey, (map.get(originKey) || 0) + netWorth);
    });
    return map;
  }, [account?.address, protocolMap]);

  // const hyperliquidAccountValue = usePerpsStore(
  //   useShallow(s => s.accountSummary?.accountValue),
  // );

  const appChainMap = useAppChainStore(useShallow(s => s.appChainMap));
  const currentAddressAppChainMap = useMemo(() => {
    const map = new Map<string, number>();
    if (account?.address) {
      const appChainList = appChainMap[account?.address.toLowerCase()] || [];
      appChainList.forEach(appChain => {
        const originKey = getOriginKey(appChain.site_url);
        if (!originKey) {
          return;
        }
        const netWorth = Number(appChain.netWorth || 0);
        map.set(originKey, (map.get(originKey) || 0) + netWorth);
      });
    }
    return map;
  }, [account?.address, appChainMap]);

  const { value: hyperliquidAccountValue } = useAsync(async () => {
    if (account?.address) {
      const sdk = apisPerps.getPerpsSDK();
      const info = await sdk.info.getClearingHouseState(account?.address);
      return info?.marginSummary?.accountValue;
    }
  }, [account?.address]);

  useEffect(() => {
    if (account?.address) {
      useAppChainStore.getState().getAppChains(account?.address);
    }
  }, [account?.address]);

  const dappListWithValue = React.useMemo(() => {
    if (!dAppList.length) {
      return dAppList;
    }
    return dAppList.map(item => {
      if (item.id === 'hyperliquid') {
        return {
          ...item,
          value: formatUsdValue(hyperliquidAccountValue || 0),
        };
      }

      const originKey = getOriginKey(item.url);

      const originPngIds = ['venus', 'hyperliquid'];
      const hasValue = originKey
        ? defiValueByOrigin.has(originKey) ||
          currentAddressAppChainMap.has(originKey)
        : false;

      if (!originKey || !hasValue) {
        return {
          ...item,
          value: undefined,
          remoteUrl: originPngIds.includes(item.id)
            ? undefined
            : dappService.getDapp(originKey || item.url || '')?.info
                ?.logo_url || undefined,
        };
      }
      const netWorth =
        defiValueByOrigin.get(originKey) ||
        currentAddressAppChainMap.get(originKey) ||
        0;

      return {
        ...item,
        value: formatNetworth(netWorth),
        remoteUrl: originPngIds.includes(item.id || '')
          ? undefined
          : dappService.getDapp(originKey || item.url || '')?.info?.logo_url ||
            undefined,
      };
    });
  }, [
    dAppList,
    defiValueByOrigin,
    hyperliquidAccountValue,
    currentAddressAppChainMap,
  ]);

  const headerLeft = React.useCallback(() => {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: 0,
        }}>
        <HeaderBackPressable />
        <DappSelect
          activeId={activeId}
          list={dappListWithValue}
          title={dappSelectTitle}
          onSelect={onSelectDapp}
        />
      </View>
    );
  }, [activeId, dappSelectTitle, dappListWithValue, onSelectDapp]);

  const handleOpenAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(true);
    }
    onPressAccountList?.();
  }, [isAccountSelectorControlled, onPressAccountList]);

  const handleCloseAccountSelector = React.useCallback(() => {
    if (!isAccountSelectorControlled) {
      setIsAccountSelectorOpen(false);
    }
  }, [isAccountSelectorControlled]);

  const handleSelectAccount = React.useCallback(
    (nextAccount: Account) => {
      onSelectAccount?.(nextAccount);
      if (!isAccountSelectorControlled) {
        setIsAccountSelectorOpen(false);
      }
    },
    [isAccountSelectorControlled, onSelectAccount],
  );

  const headerRight = React.useCallback(() => {
    const accountItem = (
      <AccountItem
        account={account}
        isShowAccountList={accountSelectorVisible}
        onPress={handleOpenAccountSelector}
        onCloseAccountList={handleCloseAccountSelector}
        onSelectAccount={handleSelectAccount}
        disablePopup={disableAccountPopup}
      />
    );

    if (!rightAddon) {
      return accountItem;
    }

    return (
      <View style={styles.headerRight}>
        {rightAddon}
        {accountItem}
      </View>
    );
  }, [
    account,
    accountSelectorVisible,
    disableAccountPopup,
    handleCloseAccountSelector,
    handleOpenAccountSelector,
    handleSelectAccount,
    rightAddon,
    styles.headerRight,
  ]);

  const { top } = useSafeAreaInsets();

  const header = React.useCallback(() => {
    return (
      <View
        style={{
          marginTop: top,
          height: DappFrameAccountHeader_LAYOUT.height,
          paddingHorizontal: 12,
        }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          {headerLeft()}
          {headerRight()}
        </View>
      </View>
    );
  }, [headerLeft, headerRight, top]);

  React.useEffect(() => {
    navigation.setOptions({
      header,
      // headerLeft,
      // headerTitle: () => title || <>{null}</>,
      // headerRight,
    });
  }, [header, headerLeft, headerRight, navigation, title]);

  return null;
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },

  addressContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletIcon: {},
  address: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: colors2024['neutral-foot'],
  },
  reverseCaret: {
    transform: [{ rotate: '180deg' }],
  },

  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    width: 14,
    height: 14,
    transform: [{ rotate: '180deg' }],
  },
  marketPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: 'rgba(22, 82, 240, 0.06)',
  },
  marketIcon: {
    width: 20,
    height: 20,
    borderRadius: 20,
  },
  marketTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  marketText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  marketCaret: {
    width: 10,
    height: 8,
    transform: [
      {
        rotate: '-90deg',
      },
    ],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetContainer: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  sheetTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    marginBottom: 20,
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  sheetItemActive: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: colors2024['brand-light-2'],
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sheetItemIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
  },
  sheetItemTextGroup: {
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  sheetItemTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  sheetItemSubtitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sheetItemMeta: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  sheetItemRight: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    marginLeft: 12,
  },
}));
