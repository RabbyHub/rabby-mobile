import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { useCurrentAccount } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';
import {
  getTotalFoldToken,
  getAllDefiCount,
  getAllNftCount,
} from './utils/converAssets';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from './types';
import { DEFI_ID, NFT_ID, SMALL_TOKEN_ID } from '@/utils/token';
import { findChain } from '@/utils/chain';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { ASSETS_ITEM_HEIGHT, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { PositionLoader } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';

import {
  TokenRow,
  DefiRow,
  NftRow,
  TokenRowSectionHeader,
  DefiSectionHeader,
  NftSectionHeader,
} from './components/AssetRenderItems';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { HomeTopArea } from './components/HomeTopArea';
interface Props {
  onRefresh(): void;
}

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { currentAccount } = useCurrentAccount();
  const {
    tokens,
    refreshPositions,
    portfolios,
    nftList,
    loading,
    refreshing,
    hasAssets,
  } = useQueryProjects(currentAccount?.address, false, true);
  const sortTokens = useSortToken(tokens);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [foldNft, setFoldNft] = useState(true);

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();

  const sections = useMemo(
    () => [
      {
        type: 'unfold_token',
        data: sortTokens.filter(i => !i._isFold),
      },
      {
        type: 'fold_token',
        data: foldHideList ? [] : sortTokens.filter(i => i._isFold),
      },
      {
        type: 'defi',
        data: foldDefi ? [] : portfolios || [],
      },
      {
        type: 'nft',
        data: foldNft ? [] : nftList || [],
      },
    ],
    [foldDefi, foldHideList, foldNft, nftList, portfolios, sortTokens],
  );

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      if (token.id === SMALL_TOKEN_ID) {
        setFoldHideList(pre => !pre);
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
          id: `${token.chain}:${token._tokenId}`,
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

  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      console.log('🔍 CUSTOM_LOGGER:=>: defi id)', data.id);
      if (data.id === DEFI_ID) {
        setFoldDefi(pre => !pre);
        return;
      }
      navigate(RootNames.DeFiDetail, { data, portfolioList: itemList });
    },
    [],
  );

  const handlePressNft = (item: NFTItem) => {
    console.log('🔍 CUSTOM_LOGGER:=>: item)', item);
    if (item.id === NFT_ID) {
      setFoldNft(pre => !pre);
      return;
    }
    navigate(RootNames.NftDetail, { token: item });
  };

  const ListEmptyComponent = useMemo(() => {
    return loading ? (
      <PositionLoader space={8} />
    ) : hasAssets ? null : (
      <View style={styles.emptyHolder}>
        <EmptyHolder
          imgStyle={styles.emptyImg}
          textStyle={styles.emptyText}
          text="No Assets"
          type="default"
        />
      </View>
    );
  }, [
    loading,
    hasAssets,
    styles.emptyHolder,
    styles.emptyImg,
    styles.emptyText,
  ]);

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'unfold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            address={currentAccount?.address}
            logoSize={40}
          />
        );
      case 'fold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            address={currentAccount?.address}
            logoSize={40}
          />
        );
      case 'nft':
        return <NftRow item={item} onPress={() => handlePressNft(item)} />;
      case 'defi':
        return (
          <DefiRow
            data={item}
            onPress={() =>
              handleOpenDefiDetail(item, [...(item._portfolios || [])])
            }
          />
        );
      default:
        return null;
    }
  };

  const renderSectionHeader = ({ section }) => {
    switch (section.type) {
      case 'fold_token':
        return (
          <TokenRowSectionHeader
            usdStr={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
            fold={foldHideList}
            onPressFold={() => setFoldHideList(pre => !pre)}
          />
        );
      case 'unfold_token':
        // TODO: tmp unnormal solve
        return (
          <View
            style={{
              height: ASSETS_ITEM_HEIGHT,
              // backgroundColor: 'transparent',
            }}
          />
        );
      case 'defi':
        return (
          <DefiSectionHeader
            usdStr={getAllDefiCount(portfolios || [])}
            fold={foldDefi}
            onPress={() => setFoldDefi(pre => !pre)}
          />
        );
      case 'nft':
        return (
          <NftSectionHeader
            amount={getAllNftCount(nftList || [])}
            fold={foldNft}
            onPress={() => setFoldNft(pre => !pre)}
          />
        );
      default:
        return <View style={{ height: 0 }} />;
    }
  };

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ASSETS_ITEM_HEIGHT,
      offset: ASSETS_ITEM_HEIGHT * index,
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
        ListHeaderComponent={() => <HomeTopArea />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.bgContainer}
        keyExtractor={item => `${item.chain}/${item.symbol || ''}/${item.id}`}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={true}
        ListHeaderComponentStyle={{
          marginBottom: -ASSETS_ITEM_HEIGHT,
        }}
        renderSectionHeader={renderSectionHeader}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              console.log('🔍 CUSTOM_LOGGER:=>: onRefresh)');
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
        onTriggerDismissFromInternal={() => {
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
  emptyHolder: {
    marginTop: 65,
  },
  emptyImg: {
    width: 160,
    height: 117,
  },
  emptyText: {
    marginTop: 21,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
  },
}));
