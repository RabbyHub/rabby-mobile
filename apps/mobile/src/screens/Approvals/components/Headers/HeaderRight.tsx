import RcIconSearch from '@/assets2024/icons/approval/search.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable } from 'react-native';
import { Text } from '@/components/Typography';
import { useTranslation } from 'react-i18next';

interface IProps {
  isSearching?: boolean;
  onTap?: () => void;
}
export const HeaderRight = (props: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  return (
    // Plain RN Pressable: this header is rendered outside the app's
    // GestureHandlerRootView, and the RNGH touchable there drops the first tap
    // after the header re-renders (e.g. right after cancelling search).
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={props.onTap}>
      {props.isSearching ? (
        <Text style={styles.text}>{t('global.cancel')}</Text>
      ) : (
        <RcIconSearch />
      )}
    </Pressable>
  );
};
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  // Keep the trailing action the same minimum width as the native back item.
  button: {
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.6,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
}));
