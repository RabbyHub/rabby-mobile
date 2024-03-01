import RcIconFind from '@/assets/icons/select-chain/icon-find.svg';
import RcIconSearch from '@/assets/icons/select-chain/icon-search.svg';
import { MAINNET_CHAINS_LIST } from '@/constant/chains';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { CHAINS_ENUM } from '@/constant/chains';
import { Input } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SelectChainList } from './SelectChainList';

export const SelectChain = ({
  value,
  onChange,
}: {
  value?: CHAINS_ENUM;
  onChange?: (value: CHAINS_ENUM) => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [search, setSearch] = React.useState('');

  const list = React.useMemo(() => {
    const searchKeyword = search.trim().toLowerCase();
    if (searchKeyword) {
      return MAINNET_CHAINS_LIST.filter(item =>
        [item.name, item.enum, item.nativeTokenSymbol].some(item =>
          item.toLowerCase().includes(searchKeyword),
        ),
      );
    }
    return MAINNET_CHAINS_LIST;
  }, [search]);

  console.log({ list: list.length });

  return (
    <View className="h-full px-[20] pt-[10] pb-[32]">
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
        <View className="items-center pt-[180]">
          <RcIconFind />
          <Text className="pt-[12] text-[13] leading-[16] text-r-neutral-body">
            No Chains
          </Text>
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) => {
  return StyleSheet.create({
    containerStyle: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      marginBottom: -8,
    },
    inputContainerStyle: {
      borderWidth: 1,
      borderRadius: 8,
      borderColor: colors['neutral-line'],
      paddingHorizontal: 16,
    },
  });
};
