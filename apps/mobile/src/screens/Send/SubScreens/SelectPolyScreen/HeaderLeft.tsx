import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useNavigation } from '@react-navigation/native';

export const SendHeaderLeft = ({
  isInputAddress,
  clean,
}: {
  isInputAddress?: boolean;
  clean?: () => void;
}) => {
  const { styles, colors } = useTheme2024({ getStyle });
  const navigation = useNavigation();
  return (
    <CustomTouchableOpacity
      style={styles.backButtonStyle}
      hitSlop={24}
      onPress={() => {
        if (isInputAddress) {
          clean?.();
          return;
        }
        if (navigation?.canGoBack()) {
          navigation.goBack();
        }
      }}>
      <RcIconHeaderBack width={24} height={24} color={colors['neutral-body']} />
    </CustomTouchableOpacity>
  );
};

const getStyle = createGetStyles2024(() => ({
  backButtonStyle: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
}));
