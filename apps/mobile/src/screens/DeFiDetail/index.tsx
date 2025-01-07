import React, { useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  SectionList,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { AssetAvatar, Text } from '@/components';
import { RcIconMore } from '@/assets/icons/home';
import { RootNames } from '@/constant/layout';
import { useNavigationState } from '@react-navigation/native';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { ellipsisOverflowedText } from '@/utils/text';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';
import { MemoItem } from '../Home/components/ProtocolMoreItem';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { toast } from '@/components2024/Toast';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from '../Home/types';
import { useMemoizedFn } from 'ahooks';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { resetNavigationTo } from '@/hooks/navigation';
import { DropDownMenuView, MenuAction } from '@/components2024/DropDownMenu';
import { useRefreshTags } from '../Home/hooks/token';
import { preferenceService } from '@/core/services';
import {
  KeyringAccountWithAlias,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
import { useTriggerHomeBalanceUpdate } from '@/hooks/useCurrentBalance';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useAssetsMap } from '../Home/hooks/store';
import { useSortAddressList } from '../Address/useSortAddressList';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import BigNumber from 'bignumber.js';
import { useAssets } from '../Search/useAssets';
import { formatNetworth } from '@/utils/math';
import { getDisplayedPortfolioUsdValue } from '../Home/utils/converAssets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_ANDROID } from '@/core/native/utils';
import { ellipsisAddress } from '@/utils/address';

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
}> = ({ token, refreshBalance }) => {
  const { refreshTags } = useRefreshTags();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const { t } = useTranslation();

  const menuActions = React.useMemo(() => {
    return [
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
  const onPress = () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
  };

  return (
    <DropDownMenuView
      menuConfig={{
        menuActions: menuActions,
      }}
      triggerProps={{ action: 'press' }}>
      <CustomTouchableOpacity hitSlop={hitSlop} onPress={onPress}>
        <RcIconMore width={24} height={24} />
      </CustomTouchableOpacity>
    </DropDownMenuView>
  );
};

export const DeFiDetailScreen = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { setNavigationOptions, navigation } = useSafeSetNavigationOptions();
  const { data, relateTokenId, isSingleAddress } = useNavigationState(
    s => s.routes.find(r => r.name === RootNames.DeFiDetail)?.params,
  ) as {
    data: AbstractProject;
    portfolioList: AbstractPortfolio[];
    relateTokenId?: string;
    isSingleAddress?: boolean;
  };

  // console.log('DefiDetail data:', JSON.stringify(data));
  const { t } = useTranslation();
  const { triggerUpdate } = useTriggerHomeBalanceUpdate();

  const getHeaderTitle = useMemoizedFn(() => {
    return (
      <View style={styles.headerArea}>
        <AssetAvatar
          logo={data?.logo || sectionsMultiProject[0]?.project?.logo}
          logoStyle={styles.assetIcon}
          size={40}
          chain={data?.chain || sectionsMultiProject[0]?.project?.chain}
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
    return <RightMore token={data} refreshBalance={triggerUpdate} />;
  });

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
      headerLeft: getHeaderLeft,
      headerRight: getHeaderRight,
    });
  }, [getHeaderTitle, setNavigationOptions, getHeaderLeft, getHeaderRight]);

  const [asssest] = useAssetsMap();

  const { initFetchTop10Assets, refreshing } = useAssets();
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);

  const sectionsMultiProject = useMemo(() => {
    const sectionsList: SectionListItem[] = [];

    const tempList: {
      data: SectionListItem['data'];
      project: SectionListItem['project'];
      totalUsdValue: SectionListItem['totalUsdValue'];
      address: SectionListItem['address'];
    }[] = [];
    Object.keys(asssest).map(address => {
      const { portfolios } = asssest[address];

      portfolios?.map(portfolio => {
        if (portfolio.id === data.id && portfolio.chain === data.chain) {
          tempList.push({
            data: portfolio._portfolios,
            project: portfolio,
            totalUsdValue: getDisplayedPortfolioUsdValue(portfolio._portfolios),
            address,
          });
        }
      });
    });

    sortedAccounts.map(account => {
      const idx = tempList.findIndex(item => item.address === account.address);
      if (idx > -1) {
        sectionsList.push({
          ...tempList[idx],
          type: account.type,
          aliasName: account.aliasName || ellipsisAddress(account.address),
        });
      }
    });
    console.debug('relateDefiList length:', sectionsList.length);
    return sectionsList.sort((a, b) =>
      new BigNumber(b.totalUsdValue).comparedTo(new BigNumber(a.totalUsdValue)),
    );
  }, [data, asssest, sortedAccounts]);

  const sumNetWorth = useMemo(() => {
    const res = sectionsMultiProject.reduce((pre, cur) => {
      return pre.plus(cur.totalUsdValue);
    }, new BigNumber(0));
    return res ? formatNetworth(res.toNumber()) : data._netWorth;
  }, [data._netWorth, sectionsMultiProject]);

  const renderItem = useCallback(
    ({
      item,
      section,
    }: {
      item: AbstractPortfolio;
      section: SectionListItem;
    }) => {
      return <MemoItem item={item} key={`${item.id}-${section.address}`} />;
    },
    [],
  );

  const { bottom } = useSafeAreaInsets();

  const androidBottomOffset = IS_ANDROID ? bottom : 0;

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListItem }) => {
      return (
        <View style={styles.accountBox}>
          <View className="relative">
            <WalletIcon
              type={section.type as KEYRING_TYPE}
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

  return (
    <NormalScreenContainer2024
      type="bg1"
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
            <Text style={styles.projectHeaderBalance}>
              {t('page.nextComponent.multiAddressHome.totalBalance')}
            </Text>
            <Text style={styles.projectHeaderNetWorth}>{sumNetWorth}</Text>
          </>
        }
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              initFetchTop10Assets(true);
            }}
            refreshing={refreshing}
          />
        }
      />
    </NormalScreenContainer2024>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  scrollContainer: {
    flex: 1,
    width: '100%',
    marginTop: 8,
    // backgroundColor: colors2024['neutral-bg-4'],
  },
  accountBox: {
    flexDirection: 'row',
    marginLeft: 25,
    gap: 4,
    marginTop: 20,
    marginBottom: 8,
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
}));
