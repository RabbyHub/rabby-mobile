import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import RcIconNotFindCC from '@/assets2024/icons/address/noFind.svg';
import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { Input } from '@rneui/themed';

import { NetSwitchTabsKey } from '@/constant/netType';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { varyAndSortChainItems } from '@/utils/chain';
import NetSwitchTabs, {
  useSwitchNetTab,
} from '@/components2024/PillsSwitch/NetSwitchTabs';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '@/components/AutoLockView';
import { useChainList } from '@/hooks/useChainList';
import { FooterButton } from '../FooterButton/FooterButton';
import { RcIconAddCircle } from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';

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
  titleText?: string;
  excludeChains?: CHAINS_ENUM[];
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
  excludeChains,
  titleText,
}: RNViewProps & SelectSortedChainProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { isShowTestnet, selectedTab, onTabChange } = useSwitchNetTab({
    hideTestnetTab,
  });
  const {
    search,
    setSearch,
    matteredList: _matteredList,
    unmatteredList: _unmatteredList,
  } = useChainSeletorList({
    // set undefined to allow all main chains
    supportChains: supportChains,
    netTabKey: !hideMainnetTab ? selectedTab : 'testnet',
  });

  const [matteredList, unmatteredList] = useMemo(() => {
    if (excludeChains?.length) {
      return [_matteredList, _unmatteredList].map(chains =>
        chains.filter(e => !excludeChains.includes(e.enum)),
      );
    }
    return [_matteredList, _unmatteredList];
  }, [excludeChains, _matteredList, _unmatteredList]);

  return (
    <AutoLockView style={styles.container}>
      {titleText && <Text style={styles.titleText}>{titleText}</Text>}
      {isShowTestnet && !hideMainnetTab ? (
        <NetSwitchTabs
          value={selectedTab}
          onTabChange={onTabChange}
          style={styles.netSwitchTabs}
        />
      ) : null}
      <Input
        leftIcon={<RcIconSearch color={colors2024['neutral-foot']} />}
        containerStyle={[styles.containerOfInput, styles.innerBlock]}
        inputContainerStyle={styles.inputContainerStyle}
        style={styles.inputText}
        placeholderTextColor={colors2024['neutral-info']}
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
          icon={
            <RcIconAddCircle
              width={22}
              height={22}
              color={colors2024['neutral-title-2']}
            />
          }
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: '100%',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  titleText: {
    marginBottom: 24,
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    lineHeight: 24,
  },
  netSwitchTabs: {
    marginBottom: 20,
  },
  innerBlock: {
    paddingHorizontal: 0,
  },
  containerOfInput: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    marginBottom: -4,
    marginTop: 0,
    flexShrink: 0,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 30,
    paddingHorizontal: 20,
    backgroundColor: colors2024['neutral-bg-2'],
    borderBottomWidth: 0,
  },
  inputText: {
    color: colors2024['neutral-title-1'],
    marginLeft: 7,
    fontSize: 17,
    fontWeight: '400',
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
}));
