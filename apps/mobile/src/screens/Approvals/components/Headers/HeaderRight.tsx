import RcIconSearch from '@/assets2024/icons/approval/search.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity } from 'react-native';
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
    <TouchableOpacity onPress={props.onTap}>
      {props.isSearching ? (
        <Text style={styles.text}>{t('global.cancel')}</Text>
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
