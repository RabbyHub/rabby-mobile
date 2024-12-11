import RcIconSearch from '@/assets2024/icons/approval/search.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity, Text } from 'react-native';

interface IProps {
  isSearching?: boolean;
  onTap?: () => void;
}
export const HeaderRight = (props: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <TouchableOpacity onPress={props.onTap}>
      {props.isSearching ? (
        <Text style={styles.text}>Cancel</Text>
      ) : (
        <RcIconSearch />
      )}
    </TouchableOpacity>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
