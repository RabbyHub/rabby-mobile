import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Tip } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import {
  useGasAccountLoginVisible,
  useGasAccountLogoutVisible,
  useGasAccountSign,
} from '../hooks/atom';
import { createGetStyles2024 } from '@/utils/styles';
import { RcIconLogoutCC, RcIconSwitchCC } from '@/assets2024/icons/gas-account';

export const GasAccountHeader: React.FC = () => {
  const color = useThemeColors();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const isDark = useGetBinaryMode() === 'dark';
  const { account } = useGasAccountSign();

  const [, setLogoutVisible] = useGasAccountLogoutVisible();
  const [, setLoginVisible] = useGasAccountLoginVisible();

  const handleLogout = useCallback(() => {
    setVisible(false);
    setLogoutVisible(true);
  }, [setLogoutVisible]);

  const handleSwitch = useCallback(() => {
    setVisible(false);
    setLoginVisible(true);
  }, [setLoginVisible]);

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
        <View style={styles.optionList}>
          <CustomTouchableOpacity
            style={styles.option}
            onPress={handleSwitch}
            hitSlop={10}>
            <RcIconSwitchCC
              color={colors2024['neutral-body']}
              style={styles.optionIcon}
            />
            <Text style={styles.text}>
              {t('page.gasAccount.switchAccount')}
            </Text>
          </CustomTouchableOpacity>
          <CustomTouchableOpacity
            style={styles.option}
            onPress={handleLogout}
            hitSlop={10}>
            <RcIconLogoutCC
              color={colors2024['neutral-body']}
              style={styles.optionIcon}
            />
            <Text style={styles.text}>{t('page.gasAccount.logout')}</Text>
          </CustomTouchableOpacity>
        </View>
      }>
      <Pressable
        style={styles.container}
        onPress={() => setVisible(true)}
        hitSlop={10}>
        {/* <WalletIcon
          type={account?.brandName as KEYRING_TYPE}
          width={styles.walletIcon.width}
          height={styles.walletIcon.height}
          style={styles.walletIcon}
        /> */}
        <RcIconGasAccountHeaderRight />
      </Pressable>
    </Tip>
  );
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 15,
  },
  option: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    gap: 8,
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
    borderRadius: 12,
    shadowOpacity: 0,
  },
  optionIcon: {
    width: 16,
    height: 16,
  },
  text: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
  },
}));
