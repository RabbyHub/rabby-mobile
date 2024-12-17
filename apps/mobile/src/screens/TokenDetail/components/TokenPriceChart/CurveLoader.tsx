import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Skeleton } from '@rneui/themed';
import { View } from 'react-native';
import { LoadingLinear } from './LoadingLinear';

export const CurveLoader = () => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.wrapper}>
      <Skeleton
        width={'100%'}
        height={80}
        style={styles.skeleton}
        LinearGradientComponent={LoadingLinear}
      />
      {/* <Text style={styles.text}>Data preparing, please wait</Text> */}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  wrapper: {
    paddingHorizontal: 20,
    height: 115,
    paddingTop: 8,
  },
  skeleton: {
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-2'],
  },
  text: {
    marginTop: 20,
    fontSize: 13,
    color: colors2024['neutral-foot'],
    textAlign: 'center',
  },
}));
