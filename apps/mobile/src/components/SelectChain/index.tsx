import RcIconFind from '@/assets/icons/select-chain/icon-find.svg';
import RcIconSearch from '@/assets/icons/select-chain/icon-search.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { CHAINS_ENUM, getChainList } from '@/constant/chains';
import { Input } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SelectChainList } from './SelectChainList';
import AutoLockView from '../AutoLockView';
import { createGetStyles2024 } from '@/utils/styles';

export const SelectChain = ({
  value,
  onChange,
}: {
  value?: CHAINS_ENUM;
  onChange?: (value: CHAINS_ENUM) => void;
}) => {
  const { t } = useTranslation();
  const { styles, colors, isLight } = useTheme2024({ getStyle: getStyles });
  const [search, setSearch] = React.useState('');

  const list = React.useMemo(() => {
    const searchKeyword = search.trim().toLowerCase();
    if (searchKeyword) {
      return getChainList('mainnet').filter(item =>
        [item.name, item.enum, item.nativeTokenSymbol].some(item =>
          item.toLowerCase().includes(searchKeyword),
        ),
      );
    }
    return getChainList('mainnet');
  }, [search]);

  return (
    <AutoLockView
      style={{
        height: '100%',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 32,
      }}>
      <Input
        leftIcon={<RcIconSearch />}
        containerStyle={styles.containerStyle}
        inputContainerStyle={styles.inputContainerStyle}
        placeholder="Search chain"
        value={search}
        onChangeText={text => {
          setSearch(text);
        }}
      />
      {list?.length ? (
        <SelectChainList data={list} value={value} onChange={onChange} />
      ) : (
        <View
          style={{
            alignItems: 'center',
            paddingTop: 180,
          }}>
          <RcIconFind />
          <Text
            style={{
              paddingTop: 12,
              fontSize: 13,
              lineHeight: 16,
              color: colors['neutral-body'],
            }}>
            No Chains
          </Text>
        </View>
      )}
    </AutoLockView>
  );
};

const getStyles = createGetStyles2024(ctx => {
  return StyleSheet.create({
    containerStyle: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginBottom: -8,
    },
    inputContainerStyle: {
      borderWidth: 1,
      borderRadius: 8,
      borderColor: ctx.colors['neutral-line'],
      paddingHorizontal: 16,
    },
  });
});
