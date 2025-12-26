import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';

import MixedFlatChainList from './MixedFlatChainList';
import { NextSearchBar } from '../SearchBar';
import { useForceUpdate } from '@/hooks/useForceUpdate';
import { findChainByServerID, searchChains } from '@/utils/chain';
import { Chain } from '@/constant/chains';

const RcIconSearch = makeThemeIconFromCC(RcIconSearchCC, 'neutral-foot');

// TODO: 把 ChainListItem 改成基于 Chain 的扩展类型并在最外层处理好避免子组件里面需要多次 findChain
export type ChainListItem = {
  chain: string;
  total: number;
  percentage: number;
};

type SelectSortedChainProps = {
  value?: ChainListItem;
  onChange?: (value: ChainListItem) => void;
  /** @deprecated */
  onClose?: () => void;
  chainList?: ChainListItem[];
  titleText?: string;
};
export default function SelectChainWithDistribute({
  value,
  onChange,
  chainList,
  titleText,
}: RNViewProps & SelectSortedChainProps) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const [canSearch, setCanSearch] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 100);
  const { t } = useTranslation();
  const inputRef = useRef<TextInput | null>(null);
  const forceUpdate = useForceUpdate();

  const handleToggleSearch = () => {
    if (!canSearch) {
      setSearch('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
      setTimeout(() => {
        inputRef.current?.blur();
      }, 50);
    }
    setCanSearch(!canSearch);
  };

  const chainListWithInfo = useMemo(
    () =>
      (chainList || [])
        .map(item => {
          const chainInfo = findChainByServerID(item.chain);
          if (!chainInfo) {
            return null;
          }
          return {
            ...item,
            chainInfo,
          };
        })
        .filter((item): item is ChainListItem & { chainInfo: Chain } => !!item),
    [chainList],
  );

  const filterChainList = useMemo(() => {
    if (!debouncedSearch) {
      return chainListWithInfo;
    }
    const matchedChains = searchChains({
      list: chainListWithInfo.map(item => item.chainInfo),
      pinned: [],
      searchKeyword: debouncedSearch,
    });
    const matchedChainIds = new Set(matchedChains.map(item => item.serverId));
    return chainListWithInfo.filter(item =>
      matchedChainIds.has(item.chainInfo.serverId),
    );
  }, [chainListWithInfo, debouncedSearch]);

  useEffect(() => {
    // 应该有状态没刷新导致列表不能滚动，强制刷新下就解决了
    forceUpdate();
  }, [forceUpdate]);

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isLight
          ? colors2024['neutral-bg-0']
          : colors2024['neutral-bg-1'],
      }}>
      <BottomSheetHandlableView>
        {canSearch ? (
          <View style={styles.titleView}>
            <NextSearchBar
              alwaysShowCancel={true}
              onCancel={handleToggleSearch}
              style={styles.searchBar}
              placeholder={t('page.search.header.SearchChain')}
              value={search}
              onChangeText={v => {
                setSearch(v);
              }}
              returnKeyType="done"
              ref={inputRef}
            />
          </View>
        ) : (
          <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
            {titleText && (
              <View style={styles.titleTextWrapper}>
                <Text style={styles.titleText}>{titleText}</Text>
              </View>
            )}
            <Pressable onPress={handleToggleSearch} style={styles.iconSearch}>
              <RcIconSearch color={colors2024['neutral-foot']} />
            </Pressable>
          </View>
        )}
      </BottomSheetHandlableView>

      <View style={[styles.chainListWrapper]}>
        <MixedFlatChainList
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          style={styles.innerBlock}
          value={value}
          onChange={onChange}
          chainList={filterChainList}
        />
      </View>
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleTextWrapper: {
    flex: 1,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
  },

  titleViewWithText: {
    marginBottom: 34,
  },
  inputWrapper: {
    marginRight: 15,
    flex: 1,
    overflow: 'hidden',
  },
  inputText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 7,
    fontSize: 17,
    fontWeight: '400',
    paddingTop: 0,
    paddingBottom: 0,
    fontFamily: 'SF Pro Rounded',
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
  },
  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 17,
    lineHeight: 22,
  },
  iconSearch: {
    position: 'absolute',
    right: 0,
  },
}));
