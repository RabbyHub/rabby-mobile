import React, { useCallback, useEffect, useMemo } from 'react';
import { View, SectionList, RefreshControl, Platform } from 'react-native';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { AssetAvatar, Text } from '@/components';
import { RcIconMore } from '@/assets/icons/home';
import { RootNames } from '@/constant/layout';
import { useRoute } from '@react-navigation/native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { WrapperDappActionsMemoItem } from '../Home/components/ProtocolMoreItem';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { toast } from '@/components2024/Toast';
import { AbstractPortfolio, AbstractProject } from '../Home/types';
import { useMemoizedFn } from 'ahooks';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { resetNavigationTo } from '@/hooks/navigation';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { useTriggerTagAssets } from '../Home/hooks/refresh';
import { preferenceService } from '@/core/services';
import { useMyAccounts } from '@/hooks/account';
import { apisAddressBalance } from '@/hooks/useCurrentBalance';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import BigNumber from 'bignumber.js';
import { useLoadAssets } from '../Search/useAssets';
import { formatNetworth } from '@/utils/math';
import { getDisplayedPortfolioUsdValue } from '../Home/utils/converAssets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_ANDROID } from '@/core/native/utils';
import { ellipsisAddress } from '@/utils/address';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { Button } from '@/components2024/Button';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { usePortfolios } from '../Home/hooks/usePortfolio';
import { isAppChain } from '../Home/utils/appchain';
import RcIconInfoCC from '@/assets2024/icons/offlineChain/info-cc.svg';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { matomoRequestEvent } from '@/utils/analytics';
import { GetRootScreenRouteProp } from '@/navigation-type';

type SectionListItem = {
  data: AbstractPortfolio[];
  project: AbstractProject;
  address: string;
  type: KEYRING_TYPE;
  aliasName: string;
  totalUsdValue: BigNumber;
};

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export const RightMore: React.FC<{
  token: AbstractProject;
  refreshBalance: () => void;
  refreshTags: () => void;
}> = ({ token, refreshBalance, refreshTags }) => {
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();

  const menuActions = React.useMemo(() => {
    if (!token) {
      return [];
    }
    return [
      {
        title: token._isFold
          ? t('page.tokenDetail.action.unfold')
          : t('page.tokenDetail.action.fold'),
        icon: token._isFold
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
        androidIconName: token._isFold
          ? 'ic_rabby_menu_unfold'
          : 'ic_rabby_menu_fold',
        key: 'fold',
        action() {
          if (token._isFold) {
            preferenceService.manualUnFoldDefi(token.id);
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldDefi(token.id);
            toast.success(t('page.tokenDetail.actionsTips.fold_success'));
          }
          token._isFold = !token._isFold;
          refreshTags();
        },
      },
      {
        title: token._isExcludeBalance
          ? t('page.tokenDetail.action.includeBalance')
          : t('page.tokenDetail.action.excludeBalance'),
        icon: token._isExcludeBalance
          ? isDarkTheme
            ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance_dark.png')
            : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_include_balance.png')
          : isDarkTheme
          ? require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance_dark.png')
          : require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_exclude_balance.png'),
        key: 'balance',
        androidIconName: token._isExcludeBalance
          ? 'ic_rabby_menu_include_balance'
          : 'ic_rabby_menu_exclude_balance',
        action() {
          if (token._isExcludeBalance) {
            preferenceService.includeBalanceToken({
              id: token.id,
              chainid: token.chain!,
              type: 'defi',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.includeBalance_success'),
            );
          } else {
            preferenceService.excludeBalance({
              id: token.id,
              chainid: token.chain!,
              type: 'defi',
            });
            toast.success(
              t('page.tokenDetail.actionsTips.excludeBalance_success'),
            );
          }
          token._isExcludeBalance = !token._isExcludeBalance;
          refreshTags();
          refreshBalance();
        },
      },
    ] as MenuAction[];
  }, [token, t, isDarkTheme, refreshTags, refreshBalance]);

  return (
    <DropDownMenuView
      menuConfig={{
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'press' }}>
      <CustomTouchableOpacity hitSlop={hitSlop}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </DropDownMenuView>
  );
};

export const useFallbackAccount = () => {
  const accounts = useMyAccounts({
    disableAutoFetch: true,
  });
  const firstAccount = accounts[0];
  useEffect(() => {
    if (!preferenceService.getFallbackAccount()) {
      preferenceService.setCurrentAccount(firstAccount);
    }
  }, [firstAccount]);
  return firstAccount || preferenceService.getFallbackAccount();
};

export const DeFiDetailScreen = () => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { setNavigationOptions, navigation } = useSafeSetNavigationOptions();
  const route = useRoute<GetRootScreenRouteProp<'DeFiDetail'>>();
  if (!route.params) {
    throw new Error('[DefiDetail] route.params is undefined');
  }

  const {
    data: routeData,
    portfolioList,
    isSingleAddress,
    account: routeAccount,
  } = route.params;

  const fallbackAccount = useFallbackAccount();

  const finalAccount = useMemo(
    () => routeAccount || fallbackAccount,
    [fallbackAccount, routeAccount],
  );

  const { data: currentPortfolio, updateSpecificProtocol } = usePortfolios(
    finalAccount?.address,
    false,
  );

  const data = useMemo(
    // 优先使用内存defi列表中的实时数据，兜底用页面参数数据
    () => currentPortfolio.find(item => item.id === routeData.id) || routeData,
    [currentPortfolio, routeData],
  );

  const isFromAppChain = useMemo(() => {
    return isAppChain(data?.chain || '');
  }, [data?.chain]);

  const { t } = useTranslation();
  const { deFiRefresh, singleDeFiRefresh } = useTriggerTagAssets();

  const refreshTag = useCallback(() => {
    if (isSingleAddress) {
      singleDeFiRefresh();
    } else {
      deFiRefresh();
    }
  }, [deFiRefresh, isSingleAddress, singleDeFiRefresh]);

  const getHeaderTitle = useMemoizedFn(() => {
    return (
      <View style={styles.headerArea}>
        <AssetAvatar
          logo={data?.logo || sectionsMultiProject[0]?.project?.logo}
          logoStyle={styles.assetIcon}
          size={40}
          chain={
            isFromAppChain
              ? ''
              : data?.chain || sectionsMultiProject[0]?.project?.chain
          }
          chainSize={16}
        />
        <Text style={styles.tokenSymbol} numberOfLines={1} ellipsizeMode="tail">
          {/* {token?.name} */}
          {ellipsisOverflowedText(
            data?.name || sectionsMultiProject[0]?.project?.name,
            20,
          )}
        </Text>
      </View>
    );
  });

  const navBack = useCallback(() => {
    if (navigation?.canGoBack()) {
      navigation.goBack();
    } else if (navigation) {
      resetNavigationTo(navigation, 'Home');
    }
  }, [navigation]);

  const getHeaderLeft = useMemoizedFn(() => {
    return (
      <CustomTouchableOpacity
        style={styles.backButtonStyle}
        hitSlop={24}
        onPress={navBack}>
        <RcIconHeaderBack
          width={24}
          height={24}
          color={colors2024['neutral-title-1']}
        />
      </CustomTouchableOpacity>
    );
  });

  const getHeaderRight = useMemoizedFn(() => {
    return (
      <RightMore
        token={data}
        refreshBalance={() =>
          apisAddressBalance.triggerUpdate({
            address: finalAccount?.address,
            force: false,
            fromScene: 'DefiDetail',
          })
        }
        refreshTags={refreshTag}
      />
    );
  });

  const { openTab } = useBrowser();

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerLeft: getHeaderLeft,
      headerRight: getHeaderRight,
    });
  }, [getHeaderTitle, setNavigationOptions, getHeaderLeft, getHeaderRight]);

  const { getCacheTop10Assets, refreshing, portfoliosMap, loadSpecificDefi } =
    useLoadAssets();

  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });

  const sectionsMultiProject = useMemo(() => {
    const sectionsList: SectionListItem[] = [];
    if (isSingleAddress) {
      const currAddressPortfolio = currentPortfolio?.find(
        item => item.id === data?.id,
      );
      if (!currAddressPortfolio || !data) {
        return sectionsList;
      }
      sectionsList.push({
        data: currAddressPortfolio._portfolios || portfolioList,
        project: currAddressPortfolio,
        totalUsdValue: new BigNumber(currAddressPortfolio?.netWorth || 0),
        type: finalAccount.type,
        address: finalAccount.address,
        aliasName:
          finalAccount.aliasName || ellipsisAddress(finalAccount.address),
      });
      return sectionsList;
    }

    const tempList: {
      data: SectionListItem['data'];
      project: SectionListItem['project'];
      totalUsdValue: SectionListItem['totalUsdValue'];
      address: SectionListItem['address'];
    }[] = [];
    Object.keys(portfoliosMap).forEach(address => {
      const portfolios = portfoliosMap[address];

      portfolios?.map(portfolio => {
        if (portfolio.id === data?.id && portfolio.chain === data?.chain) {
          tempList.push({
            data: portfolio._portfolios,
            project: portfolio,
            totalUsdValue: getDisplayedPortfolioUsdValue(portfolio._portfolios),
            address,
          });
        }
      });
    });

    accounts.forEach(account => {
      const idx = tempList.findIndex(item =>
        isSameAddress(item.address, account.address),
      );
      if (idx > -1) {
        sectionsList.push({
          ...tempList[idx]!,
          type: account.type,
          aliasName: account.aliasName || ellipsisAddress(account.address),
        });
      }
    });
    return sectionsList.sort((a, b) =>
      new BigNumber(b.totalUsdValue).comparedTo(new BigNumber(a.totalUsdValue)),
    );
  }, [
    isSingleAddress,
    data,
    portfoliosMap,
    accounts,
    currentPortfolio,
    portfolioList,
    finalAccount.type,
    finalAccount.address,
    finalAccount.aliasName,
  ]);

  // 来自同一个地址的totalUsdValue不重复计算
  const sumNetWorth = useMemo(() => {
    const addressMap = new Map<string, SectionListItem>();
    sectionsMultiProject.forEach(item => {
      if (!addressMap.has(item.address.toLowerCase())) {
        addressMap.set(item.address.toLowerCase(), item);
      }
    });
    const res = Array.from(addressMap.values()).reduce((pre, cur) => {
      return pre.plus(cur.totalUsdValue);
    }, new BigNumber(0));
    return res ? formatNetworth(res.toNumber()) : data?._netWorth || 0;
  }, [data?._netWorth, sectionsMultiProject]);

  const handleRefresh = useCallback(async () => {
    try {
      if (isSingleAddress) {
        await updateSpecificProtocol(data?.id, data?.chain || '');
      } else {
        const addresses = [
          ...new Set(sectionsMultiProject.map(section => section.address)),
        ];
        await Promise.all(
          addresses.map(address =>
            loadSpecificDefi(address, data?.id, data?.chain || ''),
          ),
        );
      }
    } catch (error) {
      console.error('Failed to refresh specific protocol:', error);
    }
  }, [
    data?.chain,
    data?.id,
    isSingleAddress,
    loadSpecificDefi,
    sectionsMultiProject,
    updateSpecificProtocol,
  ]);

  const renderItem = useCallback(
    ({
      item,
      section,
    }: {
      item: AbstractPortfolio;
      section: SectionListItem;
    }) => {
      return (
        <WrapperDappActionsMemoItem
          item={item}
          chain={data?.chain}
          protocolLogo={data?.logo}
          address={section.address}
          addressType={section.type}
          onRefresh={handleRefresh}
          key={`${item.id}-${section.address}-${section.totalUsdValue}`}
          session={
            data?.site_url && data?.logo
              ? {
                  name: data?.name,
                  icon: data?.logo || '',
                  origin: data?.site_url || '',
                }
              : undefined
          }
        />
      );
    },
    [data?.chain, data?.logo, data?.name, data?.site_url, handleRefresh],
  );

  const { bottom } = useSafeAreaInsets();
  useEffect(() => {
    const id = setTimeout(() => {
      getCacheTop10Assets({
        disableNFT: true,
        disableToken: true,
      });
    }, 200);
    return () => {
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const androidBottomOffset = IS_ANDROID ? bottom : 0;

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListItem }) => {
      return (
        <View style={styles.accountBox}>
          <View className="relative">
            <WalletIcon
              type={section.type as KEYRING_TYPE}
              address={section.address}
              width={styles.walletIcon.width}
              height={styles.walletIcon.height}
              style={styles.walletIcon}
            />
          </View>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
            {section.aliasName}
          </Text>
        </View>
      );
    },
    [styles.accountBox, styles.titleText, styles.walletIcon],
  );

  if (!data) {
    return null;
  }

  return (
    <NormalScreenContainer2024
      type={isLight ? 'bg0' : 'bg1'}
      overwriteStyle={[
        styles.container,
        { paddingBottom: androidBottomOffset },
      ]}>
      <SectionList
        sections={sectionsMultiProject}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyExtractor={item => `${item.id}`}
        windowSize={10}
        ListHeaderComponent={
          <>
            {!!isFromAppChain && (
              <View style={styles.appChainHeader}>
                <RcIconInfoCC
                  style={{ marginLeft: 4 }}
                  width={16}
                  height={16}
                  color={colors2024['neutral-foot']}
                />
                <Text style={styles.appChainHeaderText}>
                  {t('page.defiDetail.appChain', {
                    chain: data?.name,
                  })}
                </Text>
              </View>
            )}
            <Text style={styles.projectHeaderBalance}>
              {t('page.nextComponent.multiAddressHome.totalBalance')}
            </Text>
            <Text style={styles.projectHeaderNetWorth}>{sumNetWorth}</Text>
          </>
        }
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />
        }
      />
      {data?.site_url ? (
        <View style={styles.footer}>
          <Button
            type="ghost"
            title={
              Platform.OS === 'ios'
                ? t('page.defiDetail.viewSiteInWebsite')
                : t('page.defiDetail.viewSiteInApp')
            }
            onPress={() => {
              if (data?.site_url) {
                openTab(data?.site_url);
                const origin = safeGetOrigin(data?.site_url);
                if (origin) {
                  matomoRequestEvent({
                    category: 'Websites Usage',
                    action: 'Website_Visit_Defi Detail',
                    label: origin,
                  });
                }
              }
            }}
          />
        </View>
      ) : null}
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    // backgroundColor: colors2024['neutral-bg-4'],
  },
  accountBox: {
    flexDirection: 'row',
    paddingLeft: 25,
    gap: 4,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-0']
      : colors2024['neutral-bg-1'],
  },
  backButtonStyle: {
    // width: 56,
    // height: 56,
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
  titleText: {
    flexShrink: 1,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexWrap: 'nowrap',
  },
  walletIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  projectHeaderBalance: {
    color: colors2024['neutral-secondary'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
    marginLeft: 25,
    marginBottom: 7,
  },
  projectHeaderNetWorth: {
    color: colors2024['neutral-title-1'],
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
    marginLeft: 25,
    // marginBottom: 20,
  },
  headerArea: {
    width: '100%',
    height: 'auto',
    marginLeft: 8,
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  assetIcon: {
    borderRadius: 8,
  },
  tokenSymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
  container: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  footer: {
    width: '100%',
    paddingBottom: 56,
    paddingHorizontal: 16,
  },
  appChainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    backgroundColor: colors2024['neutral-bg-5'],
    marginHorizontal: 16,
    borderRadius: 6,
    marginBottom: 20,
  },
  appChainHeaderText: {
    color: colors2024['neutral-title-1'],
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
