import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import RcIconNotFindCC from '@/assets/icons/select-chain/icon-notfind-cc.svg';
import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { Input } from '@rneui/themed';

import { NetSwitchTabsKey } from '@/constant/netType';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { varyAndSortChainItems } from '@/utils/chain';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '../AutoLockView';

const RcIconNotFind = makeThemeIconFromCC(RcIconNotFindCC, 'neutral-foot');
const RcIconSearch = makeThemeIconFromCC(RcIconSearchCC, 'neutral-foot');

const useChainSeletorList = ({
  supportChains,
  netTabKey,
}: {
  supportChains?: Chain['enum'][];
  netTabKey?: NetSwitchTabsKey;
}) => {
  const [search, setSearch] = useState('');
  const {
    testnetMatteredChainBalances,
    matteredChainBalances,
    fetchMatteredChainBalance,
  } = useLoadMatteredChainBalances();
  useEffect(() => {
    fetchMatteredChainBalance();
  }, [fetchMatteredChainBalance]);

  const { pinned, chainBalances } = useMemo(() => {
    return {
      // TODO: not supported now
      pinned: [],
      chainBalances:
        netTabKey === 'testnet'
          ? testnetMatteredChainBalances
          : matteredChainBalances,
      isShowTestnet: false,
    };
  }, [netTabKey, testnetMatteredChainBalances, matteredChainBalances]);

  // TODO: not supported now
  const handleStarChange = (chain: CHAINS_ENUM, value) => {};
  // TODO: not supported now
  const handleSort = (chains: Chain[]) => {};

  const { allSearched, matteredList, unmatteredList } = useMemo(() => {
    const searchKw = search?.trim().toLowerCase();
    const result = varyAndSortChainItems({
      supportChains,
      searchKeyword: searchKw,
      matteredChainBalances: chainBalances,
      pinned,
      netTabKey,
    });

    return {
      allSearched: result.allSearched,
      matteredList: searchKw ? [] : result.matteredList,
      unmatteredList: searchKw ? [] : result.unmatteredList,
    };
  }, [search, pinned, supportChains, chainBalances, netTabKey]);

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
  value?: CHAINS_ENUM;
  onChange?: (value: CHAINS_ENUM) => void;
  supportChains?: CHAINS_ENUM[];
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
};
export default function SelectSortedChain({
  value,
  onChange,
  supportChains,
  disabledTips,
}: RNViewProps & SelectSortedChainProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { search, setSearch, matteredList, unmatteredList, allSearched } =
    useChainSeletorList({
      // set undefined to allow all main chains
      supportChains: supportChains,
      netTabKey: 'mainnet',
    });

  return (
    <AutoLockView style={styles.container}>
      <Input
        leftIcon={<RcIconSearch />}
        containerStyle={[styles.inputContainer, styles.innerBlock]}
        inputContainerStyle={styles.inputContainerStyle}
        placeholder="Search chain"
        value={search}
        onChangeText={text => {
          setSearch(text);
        }}
      />

      {matteredList.length === 0 && unmatteredList.length === 0 ? (
        <View style={[styles.chainListWrapper, styles.emptyDataWrapper]}>
          <RcIconNotFind />
          <Text style={styles.emptyText}>No Chains</Text>
        </View>
      ) : (
        <View style={[styles.chainListWrapper]}>
          <MixedFlatChainList
            style={styles.innerBlock}
            matteredList={matteredList}
            unmatteredList={unmatteredList}
            value={value}
            onChange={onChange}
            supportChains={supportChains}
            disabledTips={disabledTips}
          />
        </View>
      )}
    </AutoLockView>
  );
}

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    container: {
      height: '100%',

      paddingTop: 10,
      paddingBottom: 32,
    },
    innerBlock: {
      paddingHorizontal: 20,
    },
    inputContainer: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginBottom: -8,
      flexShrink: 0,
    },
    inputContainerStyle: {
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors['neutral-line'],
      paddingHorizontal: 16,
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
      paddingTop: 16,
      textAlign: 'center',
      fontSize: 14,
      lineHeight: 24,
      color: colors['neutral-body'],
    },
  });
};
