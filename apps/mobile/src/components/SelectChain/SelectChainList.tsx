import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { FlatList, View } from 'react-native';
import { SelectChainItem } from './SelectChainItem';

export const SelectChainList = ({
  value,
  onChange,
  data,
}: {
  value?: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  data: Chain[];
}) => {
  return (
    <FlatList
      data={data}
      className="px-[16] rounded-r-[6] rounded-l-[6] bg-r-neutral-card2"
      ItemSeparatorComponent={Divider}
      keyExtractor={item => item.enum}
      renderItem={({ item }) => {
        return <SelectChainItem data={item} value={value} onPress={onChange} />;
      }}
    />
  );
};

const Divider = () => <View className="h-[0.5] bg-r-neutral-line" />;
