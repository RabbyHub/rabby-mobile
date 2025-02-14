import React, { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
  ViewStyle,
  TextInput,
} from 'react-native';

import RcIconNotFindCC from '@/assets2024/icons/address/noFind.svg';
import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { useTheme2024, useGetBinaryMode } from '@/hooks/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { NetSwitchTabsKey } from '@/constant/netType';
import { useLoadMatteredChainBalances } from '@/hooks/account';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { varyAndSortChainItems } from '@/utils/chain';
import { useSwitchNetTab } from '@/components2024/PillsSwitch/NetSwitchTabs';
import MixedFlatChainList from './MixedFlatChainList';
import AutoLockView from '@/components/AutoLockView';
import { useChainList } from '@/hooks/useChainList';
import { FooterButton } from '../FooterButton/FooterButton';
import { RcIconAddCircle } from '@/assets/icons/address';
import { RootNames } from '@/constant/layout';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

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
  handleStyle?: ViewStyle;
  titleText?: string;
  excludeChains?: CHAINS_ENUM[];
  onClose?: () => void;
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
}: RNViewProps & SelectSortedChainProps) {
  const { t } = useTranslation();
  const [canSearch, setCanSearch] = useState(false);
  const [inputContainerWidth, setInputContainerWidth] = useState(0);
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isDark = useGetBinaryMode() === 'dark';
  const { selectedTab } = useSwitchNetTab({
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

  const animation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateX: withTiming(
            (1 - animation.value) * Math.floor(inputContainerWidth * 0.8),
            {
              duration: 500,
            },
          ),
        },
      ],
    };
  });

  const handleToggleSearch = () => {
    if (!canSearch) {
      setSearch('');
    }
    setCanSearch(!canSearch);
    animation.value = animation.value === 0 ? 1 : 0;
  };

  const handleInputContainerLayout = (e: LayoutChangeEvent) => {
    setInputContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <AutoLockView style={styles.container}>
      <BottomSheetHandlableView>
        {!canSearch && (
          <View
            style={{ ...styles.titleView, ...styles.titleViewWithText }}
            onLayout={handleInputContainerLayout}>
            {titleText && (
              <View style={styles.titleTextWrapper}>
                <Text style={styles.titleText}>{titleText}</Text>
              </View>
            )}
            <Pressable onPress={handleToggleSearch}>
              <RcIconSearch color={colors2024['neutral-foot']} />
            </Pressable>
          </View>
        )}
        {canSearch && (
          <View style={styles.titleView}>
            <View style={styles.inputWrapper}>
              <Animated.View style={[animatedStyle]}>
                <TextInput
                  style={{
                    ...styles.inputText,
                    ...styles.inputContainerStyle,
                    backgroundColor: isDark
                      ? colors2024['neutral-bg-2']
                      : '#E8E9E9', // There is no more suitable color, use a temporary color number to replace it first
                  }}
                  placeholderTextColor={colors2024['neutral-info']}
                  placeholder="Search chain"
                  value={search}
                  onChangeText={text => {
                    setSearch(text);
                  }}
                />
              </Animated.View>
            </View>
            <Pressable onPress={handleToggleSearch}>
              <Text style={styles.cancelText}>{t('global.cancel')}</Text>
            </Pressable>
          </View>
        )}
      </BottomSheetHandlableView>

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
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
            }}
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    backgroundColor: colors2024['neutral-bg-0'],
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
    paddingHorizontal: 0,
  },
  inputContainerStyle: {
    height: 46,
    borderRadius: 30,
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
}));
