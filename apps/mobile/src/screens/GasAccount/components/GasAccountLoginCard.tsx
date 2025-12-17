import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';
import { Button } from '@/components2024/Button';
import { GasAccountWrapperBg } from '../components/WrapperBg';
import { ClaimedGiftAddress } from '@/core/services/gasAccount';
import { useGasAccountEligibility } from '@/hooks/useGasAccountEligibility';
import {
  useGasAccountHistoryRefresh,
  useGasBalanceRefresh,
} from '../hooks/atom';
import IconGift from '@/assets2024/icons/gas-account/gift-01.svg';
import { formatUsdValue } from '@/utils/number';
import { GasAccountGuidePopup } from './GasAccountGuide';
import ImgGasAccount from '@/assets2024/images/gasAccount/gasaccount.png';
import { TouchableOpacity } from 'react-native';

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
  const { claimGift } = useGasAccountEligibility();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const [loading, setLoading] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);

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
      <Image
        source={ImgGasAccount}
        style={[
          {
            width: 123,
            height: 99,
          },
        ]}
        resizeMode="contain"
      />
      <Text style={styles.depositTitle}>
        {t('component.gasAccount.loginInTip.depositTitle')}
      </Text>
      <Text style={styles.depositDesc}>
        {t('component.gasAccount.loginInTip.depositDesc')}
      </Text>

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
              <Text style={styles.loginAndClaimText}>
                {t('component.gasAccount.loginInTip.login')}
              </Text>
            )
          }
        />
      </View>

      <TouchableOpacity
        style={[styles.confirmButton, styles.tipBtn]}
        onPress={() => {
          setGuideVisible(true);
        }}>
        <Text style={styles.tipBtnText}>
          {t('component.gasAccount.loginInTip.learnAbout')}
        </Text>
      </TouchableOpacity>

      <GasAccountGuidePopup
        visible={guideVisible}
        onClose={() => {
          setGuideVisible(false);
        }}
        onComplete={() => {
          setGuideVisible(false);
        }}
      />
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
    height: 56,
  },
  loginAndClaimText: {
    color: colors2024['neutral-InvertHighlight'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
  loginAndClaimContainer: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginContainer: {
    paddingTop: 12,
    paddingBottom: 24,
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
  depositTitle: {
    marginTop: 11,
    marginBottom: 8,
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontStyle: 'normal',
    fontWeight: '800',
    lineHeight: 22,
  },
  depositDesc: {
    marginBottom: 26,
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },
  tipBtn: {
    marginTop: 12,
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipBtnText: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
  },
}));
