import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import RcIconNotFindCC from '@/assets/icons/select-chain/icon-notfind-cc.svg';
import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Input } from '@rneui/themed';

import { NetSwitchTabsKey } from '@/constant/netType';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { varyAndSortChainItems } from '@/utils/chain';
import NetSwitchTabs, { useSwitchNetTab } from '../PillsSwitch/NetSwitchTabs';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '../AutoLockView';
import { useChainList } from '@/hooks/useChainList';
import { FooterButton } from '../FooterButton/FooterButton';
import { RcIconAddCircle } from '@/assets/icons/address';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { StackActions } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';

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

  const { mainnetList, testnetList } = useChainList();

  const { allSearched, matteredList, unmatteredList } = useMemo(() => {
    const searchKw = search?.trim().toLowerCase();
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
      allSearched: result.allSearched,
      matteredList: searchKw ? [] : result.matteredList,
      unmatteredList: searchKw ? [] : result.unmatteredList,
    };
  }, [
    search,
    supportChains,
    chainBalances,
    pinned,
    netTabKey,
    mainnetList,
    testnetList,
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
  value?: CHAINS_ENUM;
  onChange?: (value: CHAINS_ENUM) => void;
  supportChains?: CHAINS_ENUM[];
  disabledTips?: string | ((ctx: { chain: Chain }) => string);
  hideTestnetTab?: boolean;
  hideMainnetTab?: boolean;
  onClose?: () => void;
};
export default function SelectSortedChain({
  value,
  onChange,
  supportChains,
  disabledTips,
  hideTestnetTab = false,
  hideMainnetTab = false,
  onClose,
}: RNViewProps & SelectSortedChainProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
    hideTestnetTab,
  });
  const { search, setSearch, matteredList, unmatteredList, allSearched } =
    useChainSeletorList({
      // set undefined to allow all main chains
      supportChains: supportChains,
      netTabKey: !hideMainnetTab ? selectedTab : 'testnet',
    });

  return (
    <AutoLockView style={styles.container}>
      {isShowTestnet && !hideMainnetTab ? (
        <NetSwitchTabs
          value={selectedTab}
          onTabChange={onTabChange}
          style={styles.netSwitchTabs}
        />
      ) : null}
      <Input
        leftIcon={<RcIconSearch color={colors['neutral-foot']} />}
        containerStyle={[styles.containerOfInput, styles.innerBlock]}
        inputContainerStyle={styles.inputContainerStyle}
        style={styles.inputText}
        placeholderTextColor={colors['neutral-foot']}
        placeholder="Search chain"
        value={search}
        onChangeText={text => {
          setSearch(text);
        }}
      />

      {matteredList.length === 0 && unmatteredList.length === 0 ? (
        <View style={[styles.chainListWrapper, styles.emptyDataWrapper]}>
          {selectedTab === 'testnet' ? (
            <>
              <RcIconNotFind />
              <Text style={styles.emptyText}>No Custom Network</Text>
            </>
          ) : (
            <>
              <RcIconNotFind />
              <Text style={styles.emptyText}>No Chains</Text>
            </>
          )}
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
      {matteredList.length === 0 &&
      unmatteredList.length === 0 &&
      selectedTab === 'testnet' ? (
        <FooterButton
          title="Add Custom Network"
          footerStyle={{ position: 'absolute', bottom: 0 }}
          icon={<RcIconAddCircle color={colors['neutral-title-2']} />}
          onPress={() => {
            onClose?.();
            navigate(RootNames.StackSettings, {
              screen: RootNames.CustomTestnet,
            });
          }}
        />
      ) : null}
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
    netSwitchTabs: {
      marginBottom: 20,
    },
    innerBlock: {
      paddingHorizontal: 20,
    },
    containerOfInput: {
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
    inputText: {
      color: colors['neutral-title1'],
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
