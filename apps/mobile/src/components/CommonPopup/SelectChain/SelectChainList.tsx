import { CHAINS_LIST } from '@/constant/chains';
import { CHAINS_ENUM } from '@debank/common';
import { FlatList, View } from 'react-native';
import { SelectChainItem } from './SelectChainItem';

export const SelectChainList = ({
  value,
  onChange,
}: {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
}) => {
  return (
    <View className="rounded-[6] bg-r-neutral-card2">
      <FlatList
        data={CHAINS_LIST}
        className="px-16"
        ItemSeparatorComponent={Divider}
        keyExtractor={item => item.enum}
        renderItem={({ item }) => {
          return (
            <SelectChainItem data={item} value={value} onPress={onChange} />
          );
        }}
      />
    </View>
  );
};

const Divider = () => <View className="h-[0.5] bg-r-neutral-line" />;
