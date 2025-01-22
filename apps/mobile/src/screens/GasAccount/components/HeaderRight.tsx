import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text } from 'react-native';
import { default as RcIconLogoutCC } from '@/assets/icons/gas-account/logout-cc.svg';
import { Tip } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { useGasAccountLogoutVisible } from '../hooks/atom';
import { createGetStyles2024 } from '@/utils/styles';

export const GasAccountHeader = () => {
  const color = useThemeColors();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
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
      tooltipStyle={styles.tooltipStyle}
      isVisible={visible}
      onClose={() => setVisible(false)}
      content={
        <CustomTouchableOpacity style={styles.logout} onPress={openLogout}>
          <RcIconLogoutCC color={colors2024['neutral-body']} />
          <Text style={styles.text}>{t('page.gasAccount.logout')}</Text>
        </CustomTouchableOpacity>
      }>
      <Pressable style={styles.container} onPress={() => setVisible(true)}>
        <RcIconGasAccountHeaderRight />
      </Pressable>
    </Tip>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
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
    alignItems: 'center',
  },
  tooltipStyle: {
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 20.7,
    elevation: 20,
  },
  content: {
    width: 'auto',
    backgroundColor: colors['neutral-card1'],
    height: 'auto',
    marginLeft: 6,
    borderRadius: 200,
    shadowOpacity: 0,
  },
  text: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
  },
}));
