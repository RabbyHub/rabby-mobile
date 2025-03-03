import {
  RcIconApplePayCC,
  RcIconGooglePayCC,
} from '@/assets2024/icons/gas-account';
import { Tip } from '@/components';
import { Button } from '@/components2024/Button';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { openapi } from '@/core/request';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, Text, View } from 'react-native';
import { useAml } from '../hooks';
import { GasAccountBlueLogo } from './GasAccountBlueLogo';
import { GasAccountLoginCard } from './GasAccountLoginCard';
import { GasAccountWrapperBg } from './WrapperBg';

const DEPOSIT_LIMIT = 1000;

interface Props {
  isLogin?: boolean;
  isLoading?: boolean;
  onLoginPress?(): void;
  onDepositPress?(type?: 'token' | 'pay'): void;
  onWithdrawPress?(): void;
  gasAccountInfo?: NonNullable<
    Awaited<ReturnType<typeof openapi.getGasAccountInfo>>
  >['account'];
}

export const GasAccountCard: React.FC<Props> = ({
  isLogin,
  isLoading,
  onLoginPress,
  onDepositPress,
  onWithdrawPress,
  gasAccountInfo,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const usd = useMemo(() => {
    if (gasAccountInfo) {
      return formatUsdValue(gasAccountInfo.balance);
    }
    return formatUsdValue(0);
  }, [gasAccountInfo]);

  const isRisk = useAml();

  const balance = gasAccountInfo?.balance || 0;

  const canDeposit = useMemo(
    () => !isRisk && balance < DEPOSIT_LIMIT,
    [balance, isRisk],
  );

  const handleDepositTips = useCallback(() => {
    if (!canDeposit) {
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.DESCRIPTION,
        title: 'why cant i deposit?',
        sections: [
          {
            description: isRisk
              ? t('page.gasAccount.risk')
              : t('page.gasAccount.gasExceed'),
          },
        ],
        bottomSheetModalProps: {
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
          snapPoints: [300],
        },
        nextButtonProps: {
          title: (
            <Text style={styles.closeModalBtnText}>
              {t('page.tokenDetail.excludeBalanceTipsButton')}
            </Text>
          ),
          titleStyle: styles.tipTitle,
          onPress: () => {
            removeGlobalBottomSheetModal2024(modalId);
          },
        },
      });
    }
  }, [canDeposit, isRisk, t, styles.closeModalBtnText, styles.tipTitle]);

  if (!isLogin) {
    return <GasAccountLoginCard onLoginPress={onLoginPress} />;
  }

  return (
    <GasAccountWrapperBg style={styles.accountContainer}>
      <View style={styles.content}>
        <GasAccountBlueLogo style={styles.accountIcon} />
        <Text style={styles.balanceText}>{usd}</Text>
      </View>
      {!gasAccountInfo?.balance && !isLoading ? (
        <View style={styles.accountDepositGroup}>
          <Pressable onPress={handleDepositTips}>
            <Button
              type="primary"
              onPress={() => {
                onDepositPress?.('token');
              }}
              titleStyle={styles.btnTitle}
              disabled={!canDeposit || isLoading}
              title={
                <View style={styles.depositWithTitle}>
                  <Text style={styles.btnTitle}>
                    {t('component.gasAccount.depositWithToken')}
                  </Text>
                  <Text style={styles.btnDesc}>
                    {t('component.gasAccount.depositWithTokenDesc')}
                  </Text>
                </View>
              }
            />
          </Pressable>
          <Pressable onPress={handleDepositTips}>
            <Button
              type="primary"
              onPress={() => {
                onDepositPress?.('pay');
              }}
              buttonStyle={styles.depositWithPayBtn}
              titleStyle={styles.btnTitle}
              disabled={!canDeposit || isLoading}
              title={
                <View style={styles.depositWithTitle}>
                  <View style={styles.depositWithPayRow}>
                    <Text style={styles.btnTitle}>
                      {t('component.gasAccount.depositWithPay')}
                    </Text>
                    {Platform.OS === 'android' ? (
                      <RcIconGooglePayCC />
                    ) : (
                      <RcIconApplePayCC />
                    )}
                  </View>
                  <Text style={styles.btnDesc}>
                    {t('component.gasAccount.depositWithPayDesc')}
                  </Text>
                </View>
              }
            />
          </Pressable>
        </View>
      ) : (
        <View style={styles.accountFooter}>
          <View
            style={{
              flex: 1,
            }}>
            {gasAccountInfo?.has_iap_order ? (
              <Tip
                content={
                  'Withdrawals are disabled because your balance includes fiat funds, which cannot be withdrawn. Contact support to withdraw your token balance'
                }>
                <Button
                  type="ghost"
                  onPress={onWithdrawPress}
                  titleStyle={[styles.btnTitle, styles.btnTitleGhostDisabled]}
                  title={t('page.gasAccount.withdraw')}
                  disabled
                />
              </Tip>
            ) : (
              <Button
                type="ghost"
                onPress={onWithdrawPress}
                title={t('page.gasAccount.withdraw')}
              />
            )}
          </View>
          <Pressable
            style={{
              flex: 1,
            }}
            onPress={handleDepositTips}>
            <Button
              type="primary"
              onPress={() => {
                onDepositPress?.();
              }}
              titleStyle={styles.btnTitle}
              disabled={!canDeposit || isLoading}
              title={t('component.gasAccount.deposit')}
            />
          </Pressable>
        </View>
      )}
    </GasAccountWrapperBg>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  accountContainer: {
    paddingVertical: 38,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-1'],
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  accountFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  accountDepositGroup: {
    marginTop: 'auto',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    marginBottom: 42,
  },
  balanceText: {
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
    fontFamily: 'SF Pro',
    fontSize: 32,
    fontStyle: 'normal',
    fontWeight: '700',
  },

  accountIcon: {
    width: 50,
    height: 50,
    marginBottom: 16,
  },

  btnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-InvertHighlight'],
  },

  btnTitleGhost: {
    color: colors2024['brand-default'],
  },
  btnTitleGhostDisabled: {
    color: colors2024['brand-disable'],
  },

  btnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontStyle: 'normal',
    fontWeight: '400',
    color: colors2024['neutral-InvertHighlight'],
    opacity: 0.6,
  },

  depositWithPayBtn: {
    backgroundColor: '#000',
  },
  depositWithTitle: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },

  depositWithPayRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  tipTitle: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  toastStyle: {
    color: colors2024['neutral-title-2'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
}));
