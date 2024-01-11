import { CHAINS_ENUM, Chain } from '@debank/common';
import clsx from 'clsx';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';

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
      <View className={clsx('flex-row items-center gap-12 py-16', className)}>
        <Image
          source={{
            uri: data?.logo,
          }}
          className="w-32 h-32 rounded-full"
        />
        <Text className="text-16 leading-19 text-r-neutral-title1 font-medium">
          {data?.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};
