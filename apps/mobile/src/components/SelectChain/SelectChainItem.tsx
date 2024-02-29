import { CHAINS_ENUM, Chain } from '@/constant/chains';
import clsx from 'clsx';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';

export const SelectChainItem = ({
  data,
  value,
  className,
  onPress,
}: {
  data: Chain;
  value?: CHAINS_ENUM;
  className?: string;
  onPress?(value: CHAINS_ENUM): void;
}) => {
  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(data?.enum);
      }}>
      <View className={'flex-row items-center w-full gap-[12] py-[16]'}>
        <Image
          source={{
            uri: data.logo,
          }}
          className="w-[32] h-[32] rounded-full"
        />
        <View className="flex-row justify-between flex-1">
          <Text className="text-[16] leading-[19] text-r-neutral-title1 font-medium">
            {data?.name}
          </Text>
          {value && value === data?.enum ? <RcIconChecked /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};
