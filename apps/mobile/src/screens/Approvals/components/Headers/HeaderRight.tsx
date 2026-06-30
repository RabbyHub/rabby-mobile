import RcIconSearch from '@/assets2024/icons/approval/search.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';

interface IProps {
  isSearching?: boolean;
  onTap?: () => void;
}
export const HeaderRight = (props: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <CustomTouchableOpacity
      as="RNGHTouchableOpacity"
      style={styles.touchArea}
      hitSlop={12}
      activeOpacity={1}
      onPress={props.onTap}>
      {props.isSearching ? (
        <Text style={styles.text}>Cancel</Text>
      ) : (
        <RcIconSearch />
      )}
    </CustomTouchableOpacity>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  touchArea: {
    minWidth: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
