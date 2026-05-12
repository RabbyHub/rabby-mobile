import { RcIconGasAccountHeaderRight } from '@/assets/icons/gas-account';
import { useGetBinaryMode, useTheme2024, useThemeColors } from '@/hooks/theme';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Tip } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import {
  useAccountsWithGasAccountBalance,
  useGasAccountLoginVisible,
  useGasAccountSign,
} from '../hooks/atom';
import { createGetStyles2024 } from '@/utils/styles';
import {
  RcIconSwitchCC,
  RcIconWithdrawCC,
} from '@/assets2024/icons/gas-account';
import { Text } from '@/components/Typography';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

export const GasAccountHeader: React.FC<{ showWithdraw: () => void }> = ({
  showWithdraw: openWithdrawPopup,
}) => {
  const color = useThemeColors();
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const isDark = useGetBinaryMode() === 'dark';
  const { account } = useGasAccountSign();

  const accountsWithGasAccountBalance = useAccountsWithGasAccountBalance();
  const showSwitchWallet = useMemo(() => {
    if (!account?.address) {
      return accountsWithGasAccountBalance.length > 0;
    }
    return accountsWithGasAccountBalance.some(
      item =>
        !isSameAddress(item.address, account.address) ||
        item.type !== account.type,
    );
  }, [accountsWithGasAccountBalance, account?.address, account?.type]);

  const showWithdraw = !!account;

  const [, setLoginVisible] = useGasAccountLoginVisible();

  const handleWithdraw = useCallback(() => {
    setVisible(false);
    openWithdrawPopup();
  }, [openWithdrawPopup]);

  const handleSwitch = useCallback(() => {
    setVisible(false);
    setLoginVisible(true);
  }, [setLoginVisible]);

  if (showSwitchWallet || account) {
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
            {showWithdraw ? (
              <CustomTouchableOpacity
                as="RNGHTouchableOpacity"
                style={styles.option}
                onPress={handleWithdraw}
                hitSlop={10}>
                <RcIconWithdrawCC
                  color={colors2024['neutral-body']}
                  style={styles.optionIcon}
                />
                <Text style={styles.text}>{t('page.gasAccount.withdraw')}</Text>
              </CustomTouchableOpacity>
            ) : null}
            {showSwitchWallet ? (
              <CustomTouchableOpacity
                as="RNGHTouchableOpacity"
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
            ) : null}
          </View>
        }>
        <CustomTouchableOpacity
          as="RNGHTouchableOpacity"
          style={styles.container}
          onPress={() => setVisible(true)}
          hitSlop={10}>
          <RcIconGasAccountHeaderRight />
        </CustomTouchableOpacity>
      </Tip>
    );
  }
  return null;
};

const getStyles = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionList: {
    minWidth: 220,
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
