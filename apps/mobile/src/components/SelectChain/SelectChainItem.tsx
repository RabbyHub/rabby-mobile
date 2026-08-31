import { CHAINS_ENUM, Chain } from '@/constant/chains';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import RcIconChecked from '@/assets/icons/select-chain/icon-checked.svg';
import { Text } from '@/components/Typography';

export const SelectChainItem = ({
  data,
  value,
  textStyle,
  onPress,
}: {
  data: Chain;
  value?: CHAINS_ENUM;
  textStyle?: StyleProp<TextStyle>;
  onPress?(value: CHAINS_ENUM): void;
}) => {
  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(data?.enum);
      }}>
      <View style={styles.container}>
        <Image
          source={{
            uri: data.logo,
          }}
          style={styles.image}
        />
        <View style={styles.content}>
          <Text style={textStyle}>{data?.name}</Text>
          {value && value === data?.enum ? <RcIconChecked /> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    paddingVertical: 16,
  },
  image: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
});
