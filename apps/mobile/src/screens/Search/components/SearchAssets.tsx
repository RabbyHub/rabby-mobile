/* eslint-disable react-native/no-inline-styles */
import RcIconClose from '@/assets2024/icons/search/RcIconClose.svg';
import RcIconRight from '@/assets2024/icons/search/IconRight.svg';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Text,
  View,
} from 'react-native';
import {
  RefreshControl,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  DefiRow,
  NftRow,
  TokenRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from '@/screens/Home/types';
import { getTotalFoldToken } from '@/screens/Home/utils/converAssets';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '../useAssets';
import { PositionLoader } from './Skeleton';
import SearchOnTheChain from './SearchOnTheChain';
import { ExternalTokenRow } from '@/screens/Home/components/AssetRenderItems';
import { useSearchTokens } from '../useSearch';
import { ICombineItem } from '@/screens/Home/hooks/store';
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider,
} from 'recyclerlistview';
import { useFindChain } from '@/hooks/useFindChain';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { CHAINS_ENUM } from '@debank/common';
import { Image } from 'react-native';
import { findChainByEnum } from '@/utils/chain';
import { Skeleton } from '@rneui/themed';
import { add0x, ellipsisAddress } from '@/utils/address';
import { isAddress } from 'web3-utils';
import { isValidHexAddress } from '@metamask/utils';

const SCREEN_WIDTH = Dimensions.get('window').width - 32;

interface Props {
  resultTokens: AbstractPortfolioToken[];
  loading: boolean;
  searchState: string;
}

export const SearchAssets: React.FC<Props> = ({
  resultTokens,
  loading,
  searchState,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();
  const [chainEnum, setChainEnum] = useState<CHAINS_ENUM | undefined>();

  const chainInfo = React.useMemo(() => {
    return findChainByEnum(chainEnum);
  }, [chainEnum]);

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigate(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
        needUseCacheToken: true,
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: AbstractPortfolioToken }) => {
      return (
        item && (
          <ExternalTokenRow
            data={item}
            style={styles.renderItemWrapper}
            onTokenPress={handleOpenTokenDetail}
            logoSize={40}
          />
        )
      );
    },
    [handleOpenTokenDetail, styles],
  );

  const createChainModal = React.useCallback(() => {
    console.log('createChainModal');
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_CHAIN_WITH_SUMMARY,
      value: chainEnum,
      onClose: removeChainModal,
      hideTestnetTab: true,
      needAllAddresses: true,
      titleText: t('page.swap.selectChainModalTitle'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
      },
      onChange: (chain: CHAINS_ENUM) => {
        removeChainModal();
        setChainEnum?.(chain);
      },
    });
  }, [chainEnum, t, removeChainModal]);

  const filterTokens = React.useMemo(() => {
    if (!chainEnum) {
      return resultTokens;
    }
    return resultTokens.filter(token => token.chain === chainInfo?.serverId);
  }, [resultTokens, chainInfo, chainEnum]);

  const ListEmptyComponent = useMemo(
    () =>
      !loading && (!resultTokens || !resultTokens?.length) ? (
        <View style={styles.emptyView}>
          <Text style={styles.emptyText}>
            {t('page.search.searchWeb.noResults')}
          </Text>
        </View>
      ) : loading ? (
        <>
          {Array.from({ length: 8 }).map((_, idx) => (
            <Skeleton style={styles.skeletonBlock} key={idx} />
          ))}
        </>
      ) : null,
    [
      loading,
      resultTokens,
      styles.emptyView,
      styles.emptyText,
      styles.skeletonBlock,
      t,
    ],
  );

  return (
    <View style={styles.container}>
      <View style={[styles.bgContainer, styles.stickyHeader]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {isValidHexAddress(add0x(searchState)) ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Text style={styles.sectionHeader}>
                {t('page.search.searchWeb.searching')}
              </Text>
              <Text style={styles.sectionHeaderBlue}>{`"${ellipsisAddress(
                searchState,
              )}"`}</Text>
            </View>
          ) : (
            <Text style={styles.sectionHeader}>{t('page.swap.token')}</Text>
          )}
          <TouchableOpacity
            onPress={() => {
              createChainModal();
              Keyboard.dismiss();
            }}>
            {chainInfo ? (
              <View
                style={styles.chainInfoContainer}
                onStartShouldSetResponder={() => true}>
                <View style={styles.chainInfo}>
                  <Image
                    source={{
                      uri: chainInfo.logo,
                    }}
                    style={styles.chainIcon}
                  />
                  <Text style={styles.chainName}>{chainInfo.name}</Text>
                </View>
                <TouchableWithoutFeedback
                  disallowInterruption={true}
                  style={styles.close}
                  onPress={() => {
                    setChainEnum?.(undefined);
                  }}>
                  <RcIconClose width={12} height={12} />
                </TouchableWithoutFeedback>
              </View>
            ) : (
              <View style={styles.selectChain}>
                <Text style={styles.selectChainText}>
                  {t('page.search.sectionHeader.AllChains')}
                </Text>
                <RcIconRight color={colors2024['neutral-foot']} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        keyExtractor={(_, index) => index.toString()}
        data={filterTokens}
        ListEmptyComponent={ListEmptyComponent}
        renderItem={({ item }) => renderItem({ item })}
        style={styles.list}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  skeletonBlock: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    width: '100%',
    height: 74,
    padding: 0,
    borderRadius: 16,
    marginTop: 8,
  },
  emptyView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 150,
  },
  selectChain: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectChainText: {
    fontSize: 14,
    lineHeight: 18,
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
  },
  list: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    marginTop: ASSETS_SECTION_HEADER,
  },
  close: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  chainInfoContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  chainInfo: {
    paddingLeft: 10,
    paddingVertical: 6,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chainIcon: {
    width: 18,
    height: 18,
    borderRadius: 1000,
  },
  chainName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-body'],
  },
  stickyHeader: {
    position: 'absolute',
    width: '100%',
    top: 0,
    left: 0,
    // right: 0,
    height: ASSETS_SECTION_HEADER,
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
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
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['neutral-secondary'],
    // backgroundColor: ctx.isLight
    //   ? ctx.colors2024['neutral-bg-0']
    //   : ctx.colors2024['neutral-bg-1'],
  },
  sectionHeaderBlue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['brand-default'],
    // marginLeft: -24,
  },
  renderItemWrapper: {
    // height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  footer: {
    height: 200,
  },
}));
