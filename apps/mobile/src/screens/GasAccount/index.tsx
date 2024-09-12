import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { createGetStyles } from '@/utils/styles';
import { Text, View, StyleSheet, Modal } from 'react-native';
import { useGasAccountInfo } from './hooks';
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { RcIconGasAccount } from '@/assets/icons/gas-account';
import { useThemeColors } from '@/hooks/theme';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GasAccountDepositPopup } from './components/DepositPopup';
import { Button } from '../../components/Button';
import RcIconGasAccountBalance from '@/assets/icons/gas-account/balance-acount.svg';
import RcIconHistoryIcon from '@/assets/icons/gas-account/history-icon.svg';

export const GasAccountScreen = () => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [canDesposit, setCanDesposit] = useState<boolean>(true);
  const [showDesposit, setShowDesposit] = useState(false);
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { value } = useGasAccountInfo();

  const usd = useMemo(() => {
    if (value && 'account' in value) {
      return formatUsdValue(value.account.balance);
    }
    return formatUsdValue(0);
  }, [value]);

  const gotoDesposit = () => {
    setShowDesposit(true);
  };

  return (
    <NormalScreenContainer>
      <View style={styles.accountContainer}>
        <View style={styles.content}>
          <RcIconGasAccountBalance style={styles.acountIcon} />
          <Text style={styles.balanceText}>${usd}</Text>
        </View>
        <View style={styles.accountfooter}>
          <Button
            type="white"
            onPress={() => {}}
            buttonStyle={[styles.whiteBtn, styles.buttonContainer]}
            title={t('component.gasAccount.withdraw')}
          />
          <Button
            type="primary"
            buttonStyle={styles.buttonContainer}
            onPress={() => canDesposit && gotoDesposit()}
            disabled={!canDesposit}
            title={t('component.gasAccount.deposit')}
          />
        </View>
      </View>
      <View style={styles.historyContainer}>
        <RcIconHistoryIcon style={styles.historyIcon} />
        <Text style={styles.historyText}>
          {t('component.gasAccount.history.NoHistory')}
        </Text>
      </View>

      <GasAccountDepositPopup
        visible={showDesposit}
        onCancel={() => setShowDesposit(false)}
      />
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles(colors => ({
  accountContainer: {
    height: 320,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 20,
  },
  accountfooter: {
    height: 115,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    width: '100%',
  },
  content: {
    height: 205,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  balanceText: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors['neutral-title1'],
  },
  historyContainer: {
    display: 'flex',
    gap: 8,
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    height: 531,
    padding: 12,
    marginHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
  },
  acountIcon: {
    width: 60,
    height: 60,
    marginBottom: 24,
  },
  historyIcon: {
    marginTop: 120,
    width: 28,
    height: 28,
    marginBottom: 8,
  },
  historyText: {
    color: colors['neutral-foot'],
    fontWeight: '500',
    fontSize: 13,
    // color: var(--r-neutral-foot, #6A7587);
    // text-align: center;
    // font-family: "SF Pro";
    // font-size: 13px;
    // font-style: normal;
    // font-weight: 510;
    // line-height: normal;
  },
  buttonContainer: {
    height: 48,
    width: 154,
  },
  whiteBtn: {
    borderWidth: 1,
    borderColor: colors['blue-default'],
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    height: '100%',
    justifyContent: 'center',
  },
  modalContent: {
    borderRadius: 16,
    backgroundColor: colors['neutral-bg1'],
    boxShadow: '0 20 20 0 rgba(45, 48, 51, 0.16)',
    marginHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
}));
