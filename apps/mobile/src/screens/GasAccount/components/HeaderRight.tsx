import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useGetBinaryMode, useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { default as RcIconLogout } from '@/assets/icons/gas-account/logout.svg';
import { Tip } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { useGasAccountLogoutVisible } from '../hooks/atom';

export const GasAccountHeader = () => {
  const color = useThemeColors();
  const styles = useMemo(() => getStyles(color), [color]);
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const isDark = useGetBinaryMode() === 'dark';

  const [, setLogoutVisible] = useGasAccountLogoutVisible();

  const openLogout = useCallback(() => {
    setVisible(false);
    setLogoutVisible(true);
  }, [setLogoutVisible]);

  return (
    <Tip
      hideArrow
      placement="bottom"
      contentStyle={[
        styles.content,
        isDark && { backgroundColor: color['neutral-bg-1'] },
      ]}
      isVisible={visible}
      onClose={() => setVisible(false)}
      content={
        <CustomTouchableOpacity style={styles.logout} onPress={openLogout}>
          <RcIconLogout />
          <Text style={styles.text}>{t('page.gasAccount.logout')}</Text>
        </CustomTouchableOpacity>
      }>
      <Pressable style={styles.container} onPress={() => setVisible(true)}>
        <RcIconGasAccountHeaderRight />
      </Pressable>
    </Tip>
  );
};

const getStyles = createGetStyles(color => ({
  container: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logout: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 6,
    padding: 14,
    paddingLeft: 12,
  },
  content: {
    width: 'auto',
    backgroundColor: color['neutral-card-1'],
    height: 'auto',
    marginLeft: 6,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    color: color['red-default'],
  },
}));
