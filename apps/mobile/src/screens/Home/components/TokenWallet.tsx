import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { EmptyHolder } from '@/components/EmptyHolder';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { useTheme2024 } from '@/hooks/theme';
import { SMALL_TOKEN_ID } from '@/utils/token';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { RefreshControl } from 'react-native-gesture-handler';
import { AbstractPortfolioToken } from '../types';
import { PositionLoader } from './Skeleton';
import { Account } from '@/core/services/preference';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { findChain } from '@/utils/chain';
import { TokenRow } from './TokenRenderItems';

const ITEM_HEIGHT = 68;

type TokenWalletProps = {
  currentAccount?: Account | null;
  unfoldTokens?: AbstractPortfolioToken[];
  foldTokens?: AbstractPortfolioToken[];
  isTokensLoading?: boolean;
  hasTokens?: boolean;
  refreshPositions(): void;
  isPortfoliosLoading: boolean;
  onRefresh(): void;
};

export const TokenWallet = ({
  currentAccount,
  isTokensLoading,
  hasTokens,
  foldTokens,
  unfoldTokens,
  refreshPositions,
  isPortfoliosLoading,
  onRefresh,
}: TokenWalletProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const refreshing = useMemo(() => {
    if ((unfoldTokens?.length || 0) > 0) {
      return isPortfoliosLoading;
    } else {
      return false;
    }
  }, [isPortfoliosLoading, unfoldTokens]);
  const [fold, setFold] = useState(true);

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();

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

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        <TokenRow
          data={item}
          onTokenPress={handleOpenTokenDetail}
          fold={fold}
          address={currentAccount?.address}
          logoSize={40}
        />
      );
    },
    [currentAccount?.address, fold, handleOpenTokenDetail],
  );

  const keyExtractor = useCallback(
    (item: AbstractPortfolioToken, idx: number) => {
      return `${item.chain}/${item.symbol}/${item.id}/${idx}`;
    },
    [],
  );

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const ListEmptyComponent = useMemo(() => {
    return isTokensLoading ? (
      <PositionLoader space={8} />
    ) : hasTokens ? null : (
      <EmptyHolder text="No Tokens" type="protocol" />
    );
  }, [isTokensLoading, hasTokens]);

  return (
    <>
      <FlatList
        ListHeaderComponent={<View style={{ height: 12 }} />}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        data={[
          ...(unfoldTokens || []),
          ...(foldTokens?.slice(0, fold ? 1 : undefined) || []),
        ]}
        getItemLayout={getItemLayout}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        windowSize={2}
        contentContainerStyle={styles.bgContainer}
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
}));
