import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  Text,
  View,
  ViewStyle,
  TextInput,
} from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import RcIconNotFindCC from '@/assets2024/icons/address/noFind.svg';
// import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { RcNextSearchCC } from '@/assets/icons/common';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import { useTranslation } from 'react-i18next';

import { NetSwitchTabsKey } from '@/constant/netType';
import {
  useLoadMatteredChainBalances,
  useMatteredChainBalancesAll,
} from '@/hooks/accountChainBalance';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { findChainByEnum, varyAndSortChainItems } from '@/utils/chain';
import NetSwitchTabs, {
  useSwitchNetTab,
} from '@/components2024/PillsSwitch/NetSwitchTabs';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '@/components/AutoLockView';
import { useChainList } from '@/hooks/useChainList';
import { FooterButton } from '../FooterButton/FooterButton';
import { RcIconAddCircle } from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { NextSearchBar } from '../SearchBar';
import { Account } from '@/core/services/preference';
import { useRendererDetect } from '@/components/Perf/PerfDetector';

const useChainSeletorList = ({
  supportChains,
  netTabKey,
  needAllAddresses,
  account,
}: {
  supportChains?: Chain['enum'][];
  netTabKey?: NetSwitchTabsKey;
  needAllAddresses?: boolean;
  account?: Account;
}) => {
  const [search, setSearch] = useState('');
  const {
    testnetMatteredChainBalances,
    matteredChainBalances,
    fetchMatteredChainBalance,

    fetchAllAddressesChainBalance,
  } = useLoadMatteredChainBalances({
    account,
  });

  useRendererDetect({ name: 'SelectChainWithSummary' });

  const { matteredChainBalancesAll } = useMatteredChainBalancesAll();

  useEffect(() => {
    needAllAddresses
      ? fetchAllAddressesChainBalance()
      : fetchMatteredChainBalance();
  }, [
    needAllAddresses,
    fetchAllAddressesChainBalance,
    fetchMatteredChainBalance,
  ]);

  const { mainnetList, testnetList } = useChainList();

  const { pinned, allSearched, matteredList, unmatteredList } = useMemo(() => {
    const searchKw = search?.trim().toLowerCase();
    const pinned = [];
    const chainBalances =
      netTabKey === 'testnet'
        ? testnetMatteredChainBalances
        : needAllAddresses
        ? matteredChainBalancesAll
        : matteredChainBalances;

    const result = varyAndSortChainItems({
      supportChains,
      searchKeyword: searchKw,
      matteredChainBalances: chainBalances,
      pinned,
      netTabKey,
      mainnetList,
      testnetList,
    });

    return {
      // TODO: not supported now
      pinned,
      chainBalances,
      allSearched: result.allSearched,
      matteredList: searchKw ? [] : result.matteredList,
      unmatteredList: searchKw ? [] : result.unmatteredList,
    };
  }, [
    search,
    supportChains,
    netTabKey,
    mainnetList,
    testnetList,
    testnetMatteredChainBalances,
    matteredChainBalances,
    matteredChainBalancesAll,
    needAllAddresses,
  ]);

  return {
    matteredList,
    unmatteredList: search?.trim() ? allSearched : unmatteredList,
    allSearched,
    // handleStarChange,
    // handleSort,
    search,
    setSearch,
    pinned,
  };
};

export type SelectSortedChainProps = {
  value?: CHAINS_ENUM | null;
  onChange?: (value: CHAINS_ENUM) => void;
  supportChains?: CHAINS_ENUM[];
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
  hideTestnetTab?: boolean;
  hideMainnetTab?: boolean;
  handleStyle?: ViewStyle;
  titleText?: string;
  excludeChains?: CHAINS_ENUM[];
  needAllAddresses?: boolean;
  onClose?: () => void;
  account?: Account;
};
export default function SelectChainWithSummary({
  value,
  onChange,
  supportChains,
  disabledTips,
  hideTestnetTab = false,
  hideMainnetTab = false,
  onClose,
  excludeChains,
  titleText,
  needAllAddresses,
  account,
}: RNViewProps & SelectSortedChainProps) {
  const { t } = useTranslation();
  const [canSearch, setCanSearch] = useState(false);
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const isDark = useGetBinaryMode() === 'dark';
  const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
    hideTestnetTab,
  });
  const inputRef = useRef<TextInput | null>(null);
  const {
    search,
    setSearch,
    matteredList: _matteredList,
    unmatteredList: _unmatteredList,
  } = useChainSeletorList({
    // set undefined to allow all main chains
    supportChains: supportChains,
    needAllAddresses,
    netTabKey: !hideMainnetTab ? selectedTab : 'testnet',
    account,
  });

  const [matteredList, unmatteredList] = useMemo(() => {
    if (excludeChains?.length) {
      return [_matteredList, _unmatteredList].map(chains =>
        chains.filter(e => !excludeChains.includes(e.enum)),
      ) as [Chain[], Chain[]];
    }
    return [_matteredList, _unmatteredList];
  }, [excludeChains, _matteredList, _unmatteredList]);

  useEffect(() => {
    const chain = findChainByEnum(value ?? undefined);
    const isTestnet = !!chain?.isTestnet;
    if (isTestnet) {
      onTabChange('testnet');
    }
  }, [onTabChange, value]);

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

  return (
    <AutoLockView
      style={{
        ...styles.container,
        backgroundColor: isDark
          ? colors2024['neutral-bg-1']
          : colors2024['neutral-bg-0'],
      }}>
      <BottomSheetHandlableView style={styles.innerBlock}>
        {!canSearch && (
          <View style={{ ...styles.titleView, ...styles.titleViewWithText }}>
            {titleText && (
              <View style={styles.titleTextWrapper}>
                <Text style={styles.titleText}>{titleText}</Text>
              </View>
            )}
            <Pressable onPress={handleToggleSearch} style={styles.iconSearch}>
              <RcNextSearchCC
                color={colors2024['neutral-secondary']}
                width={20}
                height={20}
              />
            </Pressable>
          </View>
        )}
        {canSearch && (
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
        )}
        {isShowTestnet && !hideMainnetTab ? (
          <NetSwitchTabs
            value={selectedTab}
            onTabChange={onTabChange}
            style={styles.netSwitchTabs}
          />
        ) : null}
      </BottomSheetHandlableView>

      {matteredList.length === 0 && unmatteredList.length === 0 ? (
        <View style={[styles.chainListWrapper, styles.emptyDataWrapper]}>
          {selectedTab === 'testnet' ? (
            <>
              {isLight ? <RcIconEmpty /> : <RcIconEmptyDark />}
              <Text style={styles.emptyText}>No Custom Network</Text>
            </>
          ) : (
            <>
              {isLight ? <RcIconEmpty /> : <RcIconEmptyDark />}
              <Text style={styles.emptyText}>No Chains</Text>
            </>
          )}
        </View>
      ) : (
        <View style={[styles.chainListWrapper]}>
          <MixedFlatChainList
            needAllAddresses={needAllAddresses}
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
            }}
            style={styles.innerBlock}
            matteredList={matteredList}
            unmatteredList={unmatteredList}
            value={value ?? undefined}
            onChange={onChange}
            supportChains={supportChains}
            disabledTips={disabledTips}
            account={account}
          />
        </View>
      )}
      {matteredList.length === 0 &&
      unmatteredList.length === 0 &&
      selectedTab === 'testnet' ? (
        <FooterButton
          title="Add Custom Network"
          footerStyle={{ position: 'absolute', bottom: 0 }}
          icon={
            <RcIconAddCircle
              width={22}
              height={22}
              color={colors2024['neutral-title-2']}
            />
          }
          onPress={() => {
            onClose?.();
            navigateDeprecated(RootNames.StackSettings, {
              screen: RootNames.CustomTestnet,
            });
          }}
        />
      ) : null}
    </AutoLockView>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 0,
    paddingTop: 10,
  },
  searchBar: {
    flex: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleTextWrapper: {
    flex: 1,
  },
  netSwitchTabs: {
    marginBottom: 20,
  },
  innerBlock: {
    paddingHorizontal: 16,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 0,
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

  chainListWrapper: {
    flexShrink: 1,
    height: '100%',
  },

  emptyDataWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    maxHeight: 400,
    // ...makeDebugBorder()
  },

  emptyText: {
    paddingTop: 21,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-info'],
  },

  titleView: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },

  inputWrapper: {
    marginRight: 15,
    flex: 1,
    overflow: 'hidden',
  },

  cancelText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro',
    fontSize: 17,
    lineHeight: 22,
  },

  titleViewWithText: {
    marginBottom: 34,
  },

  iconSearch: {
    position: 'absolute',
    right: 4,
  },
}));
