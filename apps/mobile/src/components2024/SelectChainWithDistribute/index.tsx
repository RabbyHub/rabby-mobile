import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcIconSearchCC from '@/assets/icons/select-chain/icon-search-cc.svg';
import { useTheme2024 } from '@/hooks/theme';
import AutoLockView from '@/components/AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

import MixedFlatChainList from './MixedFlatChainList';

const RcIconSearch = makeThemeIconFromCC(RcIconSearchCC, 'neutral-foot');

export type ChainListItem = {
  chain: string;
  total: number;
  percentage: number;
};

type SelectSortedChainProps = {
  value?: ChainListItem;
  onChange?: (value: ChainListItem) => void;
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
  const { t } = useTranslation();
  const inputRef = useRef<TextInput | null>(null);

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

  const filterChainList = useMemo(() => {
    if (!search) {
      return chainList;
    }
    return (
      chainList?.filter(item =>
        item.chain.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
      ) || []
    );
  }, [chainList, search]);
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
            <View style={styles.inputWrapper}>
              <TextInput
                style={{
                  ...styles.inputText,
                  ...styles.inputContainerStyle,
                  backgroundColor: isLight
                    ? '#E8E9E9' // There is no more suitable color, use a temporary color number to replace it first
                    : colors2024['neutral-bg-2'],
                }}
                placeholderTextColor={colors2024['neutral-info']}
                placeholder="Search chain"
                value={search}
                onChangeText={text => {
                  setSearch(text);
                }}
                ref={inputRef}
              />
            </View>
            <Pressable onPress={handleToggleSearch}>
              <Text style={styles.cancelText}>{t('global.cancel')}</Text>
            </Pressable>
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
    fontWeight: '800',
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
