/* eslint-disable @typescript-eslint/no-shadow */
import { View } from 'react-native';
// import { useOpenDappView } from '../hooks/useDappView';
import { CHAINS_ENUM } from '@/constant/chains';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { DappCard } from '../DappCard';
import { DappSearchCardList } from './DappSearchCardList';
import { DappSearchEmpty } from './DappSearchEmpty';
import { LinkCard } from './LinkCard';

interface Props {
  list: DappInfo[];
  loading?: boolean;
  loadMore?(): void;
  currentDapp?: DappInfo | null;
  currentURL?: string | null;
  onOpenURL?(url: string): void;
  onFavoritePress?(dapp: DappInfo): void;
  total?: number;
  chain?: CHAINS_ENUM;
  onChainChange?(chain?: CHAINS_ENUM): void;
  searchText?: string;
  onEmptyPress?(): void;
}

export const DappSearchSection: React.FC<Props> = ({
  list,
  loading,
  loadMore,
  currentDapp,
  currentURL,
  onFavoritePress,
  onOpenURL,
  chain,
  onChainChange,
  total,
  searchText,
  onEmptyPress,
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  const isEmpty = !currentURL && !list?.length && !loading;

  return (
    <View style={styles.container}>
      {searchText && !loading ? (
        <>
          {currentURL ? (
            currentDapp ? (
              <View style={styles.sectionTop}>
                <DappCard
                  keyword={searchText}
                  data={currentDapp}
                  isShowDesc
                  onFavoritePress={onFavoritePress}
                  onPress={dapp => {
                    onOpenURL?.(dapp.origin);
                  }}
                  style={styles.currentDapp}
                />
              </View>
            ) : (
              <View style={styles.sectionTop}>
                <LinkCard url={currentURL} onPress={onOpenURL} />
              </View>
            )
          ) : null}
          {list?.length || isEmpty ? (
            <DappSearchCardList
              keyword={searchText}
              chain={chain}
              onChainChange={onChainChange}
              onEndReached={loadMore}
              data={list}
              loading={loading}
              total={total}
              onPress={dapp => {
                onOpenURL?.(dapp.origin);
              }}
              onFavoritePress={onFavoritePress}
              ListEmptyComponent={
                <DappSearchEmpty onLinkPress={onEmptyPress} />
              }
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginTop: 16,
    flex: 1,
    // paddingBottom: ScreenLayouts.bottomBarHeight + 12,
    // paddingTop: 24,
  },

  sectionTop: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  currentDapp: {
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 60,
    shadowOpacity: 1,
  },
}));
