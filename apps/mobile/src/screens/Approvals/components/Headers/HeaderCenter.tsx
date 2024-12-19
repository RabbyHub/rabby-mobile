import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { View } from 'react-native';
import { TopSearch } from '../TopSearch';

interface IProps {
  isSearching?: boolean;
  textTitle?: string;
  type: 'contract' | 'assets';
  inputValue: string;
  inputOnChange: (s: string) => void;
}
export const HeaderCenter = (props: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[props.isSearching && styles.container]}>
      {props.isSearching ? (
        <TopSearch value={props.inputValue} onChange={props.inputOnChange} />
      ) : (
        <HeaderTitleText2024 style={styles.title}>
          {props.textTitle}
        </HeaderTitleText2024>
      )}
    </View>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginLeft: 8,
    width: '100%',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },
}));
