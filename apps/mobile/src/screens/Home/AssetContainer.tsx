import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { useCurrentAccount } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';
import { convertSmallTokenList } from './hooks/useMergeSmallTokens';
import { AbstractPortfolioToken } from './types';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { findChain } from '@/utils/chain';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { PositionLoader } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';

import { TokenRow } from './components/AssetRenderItems';
interface Props {
  onRefresh(): void;
}

const ITEM_HEIGHT = 68;

const NFTAsset = ({ item }) => (
  <View>
    <Text>{item.name}</Text>
  </View>
);

const DefiAsset = ({ item }) => (
  <View>
    <Text>{item.protocol}</Text>
    <Text>{item.value}</Text>
  </View>
);

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { currentAccount } = useCurrentAccount();
  const {
    tokens,
    isTokensLoading,
    hasTokens,
    refreshPositions,
    isPortfoliosLoading,
  } = useQueryProjects(currentAccount?.address, false, true);
  const sortTokens = useSortToken(tokens);
  const [fold, setFold] = useState(true);

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();

  const sections = [
    {
      type: 'unfold_token',
      data: sortTokens.filter(i => !i._isFold),
    },
    {
      type: 'fold_token',
      data:
        convertSmallTokenList(sortTokens.filter(i => i._isFold))?.slice(
          0,
          fold ? 1 : undefined,
        ) || [],
    },
    {
      type: 'nft',
      data: [],
    },
    {
      type: 'defi',
      data: [],
    },
  ];

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      if (token.id === SMALL_TOKEN_ID) {
        setFold(pre => !pre);
        return;
      }
      if (
        findChain({
          serverId: token.chain,
        })?.isTestnet
      ) {
        openTokenDetailPopup(token);
      } else {
        console.log('🔍 CUSTOM_LOGGER:=>: handleOpenTokenDetail)', {
          pin: token._isPined,
          fold: token._isFold,
          exclude: token._isExcludeBalance,
          PinIndex: token._pinIndex,
        });
        navigate(RootNames.TokenDetail, {
          token: token,
          // todo fix ts
          account: currentAccount as any,
        });
      }
    },
    [currentAccount, openTokenDetailPopup],
  );

  const ListEmptyComponent = useMemo(() => {
    return isTokensLoading ? (
      <PositionLoader space={8} />
    ) : hasTokens && sortTokens.length > 0 ? null : (
      <EmptyHolder text="No Tokens" type="protocol" />
    );
  }, [isTokensLoading, hasTokens, sortTokens.length]);

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'unfold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            fold={fold}
            address={currentAccount?.address}
            logoSize={40}
          />
        );
      case 'fold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            fold={fold}
            address={currentAccount?.address}
            logoSize={40}
          />
        );
      case 'nft':
        return <NFTAsset item={item} />;
      case 'defi':
        return <DefiAsset item={item} />;
      default:
        return null;
    }
  };

  const refreshing = useMemo(() => {
    if ((sortTokens?.length || 0) > 0) {
      return !!isPortfoliosLoading;
    } else {
      return false;
    }
  }, [isPortfoliosLoading, sortTokens]);
  const renderSectionHeader = ({ section }) => <Text>{section.type}</Text>;

  // TODO: 统一token ntf defi
  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );
  if (!currentAccount?.address) {
    return null;
  }

  return (
    <>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        ListHeaderComponent={<View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
        windowSize={2}
        contentContainerStyle={styles.bgContainer}
        renderSectionHeader={renderSectionHeader}
        // TODO: 统一id，token nft defi
        // token: `${item.chain}/${item.symbol}/${item.id}/${idx}`
        keyExtractor={item => item.id}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              refreshPositions();
              onRefresh();
            }}
            refreshing={refreshing}
          />
        }
      />
      <BottomSheetModalTokenDetail
        __shouldSwitchSceneAccountBeforeRedirect__
        nextTxRedirectAccount={currentAccount}
        ref={tokenDetailModalRef}
        token={focusingToken}
        isTestnet={isTestnetToken}
        onDismiss={() => {
          cleanFocusingToken({ noNeedCloseModal: true });
        }}
        onTriggerDismissFromInternal={ctx => {
          // toggleShowSheetModal('tokenDetailModalRef', false);
          cleanFocusingToken();
        }}
      />
    </>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  bgContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    marginTop: -10,
    width: '100%',
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContainer: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
  },
  tabBarWrap: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    paddingTop: 18,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    width: '100%',
  },
  tabList: {
    display: 'flex',
    width: '100%',
    gap: 12,
  },
  tabBar: {
    borderRadius: 120,
    height: 36,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  label: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    textTransform: 'none',
  },
  indicator: {
    display: 'none',
  },
  activeTab: {
    backgroundColor: 'rgba(19, 20, 22, 1)',
  },
  activeLabelStyle: {
    fontWeight: '700',
  },
}));
