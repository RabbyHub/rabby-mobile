import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { RcIconQuoteEnd, RcIconQuoteStart } from '@/assets/icons/gas-account';
import { Button } from '@/components2024/Button';
import { GasAccountWrapperBg } from '../components/WrapperBg';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import { useGasAccountMethods } from '../hooks';
import {
  useGasAccountHistoryRefresh,
  useGasBalanceRefresh,
} from '../hooks/atom';
import IconGift from '@/assets2024/icons/gas-account/gift-01.svg';
import { formatUsdValue } from '@/utils/number';
interface Props {
  onLoginPress?(): void;
  currentEligibleAddress?: ClaimedGiftAddress;
}
export const GasAccountLoginCard: React.FC<Props> = ({
  onLoginPress,
  currentEligibleAddress,
}) => {
  const { t } = useTranslation();
  const { refresh: refreshBalance } = useGasBalanceRefresh();
  const { refresh: refreshHistory } = useGasAccountHistoryRefresh();
  const { claimGift, checkEligibility } = useGasAccountEligibility();
  const { styles } = useTheme2024({ getStyle });
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    try {
      setLoading(true);
      if (currentEligibleAddress?.isEligible) {
        console.log('claimGift', currentEligibleAddress.address);
        await claimGift(currentEligibleAddress.address);
        refreshBalance();
        refreshHistory();
      } else {
        onLoginPress?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const { isLight } = useTheme2024({ getStyle: getStyle });

  return (
    <GasAccountWrapperBg
      style={[
        styles.loginContainer,
        isLight ? styles.loginContainerLight : styles.loginContainerDark,
      ]}>
      <GasAccountBlueLogo style={styles.logo} />
      <View style={styles.quoteContainer}>
        <RcIconQuoteStart style={styles.quoteStart} />
        <Text style={styles.loginTip}>
          {t('component.gasAccount.loginInTip.login1')}
        </Text>
      </View>
      <View>
        <Text style={styles.loginTip}>
          {t('component.gasAccount.loginInTip.login2')}
        </Text>
      </View>
      <View style={styles.quoteContainer}>
        <Text style={styles.loginDesc}>
          {t('component.gasAccount.loginInTip.login3')}
        </Text>
        <RcIconQuoteEnd style={styles.quoteEnd} />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          loading={loading}
          containerStyle={styles.confirmButton}
          onPress={handleClick}
          type={currentEligibleAddress?.isEligible ? 'success' : 'primary'}
          title={
            currentEligibleAddress?.isEligible ? (
              <View style={styles.loginAndClaimContainer}>
                <IconGift width={18} height={18} />
                <Text style={styles.loginAndClaimText}>
                  {t('component.gasAccount.loginInTip.loginAndClaim', {
                    amount: formatUsdValue(currentEligibleAddress.giftUsdValue),
                  })}
                </Text>
              </View>
            ) : (
              t('component.gasAccount.loginInTip.login')
            )
          }
        />
      </View>
    </GasAccountWrapperBg>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  buttonContainer: {
    gap: 12,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors['neutral-bg1'],
  },
  confirmButton: {
    width: '100%',
    height: 52,
  },
  loginAndClaimText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '700',
  },
  loginAndClaimContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    paddingTop: 38,
    paddingBottom: 20,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  loginContainerLight: {
    backgroundColor: colors2024['neutral-bg-1'],
  },
  loginContainerDark: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  logo: {
    width: 50,
    height: 50,
    marginBottom: 34,
  },
  loginTip: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  loginDesc: {
    color: colors2024['brand-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontStyle: 'normal',
    fontWeight: '700',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  popupBody: {
    padding: 0,
  },
  quoteContainer: {
    position: 'relative',
    // marginBottom: 16,
  },
  quoteEnd: {
    position: 'absolute',
    top: 2,
    right: -20,
  },
  quoteStart: {
    position: 'absolute',
    top: 2,
    left: -20,
  },
}));
