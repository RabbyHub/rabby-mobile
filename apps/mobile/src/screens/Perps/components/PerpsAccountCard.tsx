/* eslint-disable react-native/no-inline-styles */
import { RcIconCloseCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { Text } from '@/components/Typography';
import RcIconMinButton from '@/assets2024/icons/perps/IconMinButton.svg';
import ImgLearnMore from '@/assets2024/icons/perps/ImgLearnMore.png';
import RcIconLearnArrow from '@/assets2024/icons/perps/IconLearnArrow.svg';
import RcIconPlusButton from '@/assets2024/icons/perps/IconPlusButton.svg';
import RcIconAddFunds from '@/assets2024/icons/perps/IconAddFunds.svg';
import RcIconUSDC from '@/assets2024/icons/perps/IconUSDC.svg';
import RcIconUSDT from '@/assets2024/icons/perps/IconUSDT.svg';
import RcIconUSDH from '@/assets2024/icons/perps/IconUSDH.svg';
import RcIconUSDE from '@/assets2024/icons/perps/IconUSDE.svg';
import RcIconCardArrow from '@/assets2024/icons/perps/IconCardArrow.svg';
import { apisPerps } from '@/core/apis';

const COIN_ICON_MAP: Record<string, React.ReactNode> = {
  USDC: <RcIconUSDC width={16} height={16} />,
  USDT0: <RcIconUSDT width={16} height={16} />,
  USDH: <RcIconUSDH width={16} height={16} />,
  USDE: <RcIconUSDE width={16} height={16} />,
};

export const PerpsAccountCard: React.FC = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [, setPopupState] = usePerpsPopupState();

  const { availableBalance, accountValue, isUnifiedAccount, spotBalances } =
    usePerpsAccount();
  const [isBalanceExpanded, setIsBalanceExpanded] = React.useState(false);

  const visibleBalances = React.useMemo(() => {
    return spotBalances
      .filter(b => Number(b.available) >= 0.1)
      .sort((a, b) => Number(b.available) - Number(a.available));
  }, [spotBalances]);

  const isNewUser = React.useMemo(() => {
    return (
      Number(availableBalance) === 0 && accountValue === 0 && !isUnifiedAccount
    );
  }, [availableBalance, accountValue, isUnifiedAccount]);

  const [hasClosedLearnMore, setHasClosedLearnMore] = React.useState(true);
  React.useEffect(() => {
    apisPerps.getHasClosedLearnMoreCard().then(closed => {
      setHasClosedLearnMore(closed);
    });
  }, []);

  const showLearnMore = isNewUser && !hasClosedLearnMore;

  return (
    <>
      <LinearGradient
        colors={['#0F2F3A', '#041920']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.balanceCard]}>
        <View style={styles.balanceCardInner}>
          <View style={styles.balanceCardRow}>
            <View style={styles.balanceCardContentLeft}>
              <Text style={styles.balance}>
                {formatUsdValue(Number(availableBalance || 0))}
              </Text>
              <TouchableOpacity
                disabled={!isUnifiedAccount}
                onPress={() => setIsBalanceExpanded(prev => !prev)}
                style={styles.availableToggle}>
                <Text style={styles.availableBalance}>
                  {t('page.perps.PerpsCard.available')}
                </Text>
                {isUnifiedAccount && (
                  <RcIconCardArrow
                    style={
                      isBalanceExpanded
                        ? { transform: [{ rotate: '180deg' }] }
                        : undefined
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
            {Number(availableBalance) === 0 ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowDepositPopup: true,
                  }));
                }}>
                <RcIconAddFunds />
                <Text style={styles.actionBtnText}>
                  {t('page.perps.PerpsCard.addFunds')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionBtns}>
                <TouchableOpacity
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowDepositPopup: true,
                    }));
                  }}>
                  <RcIconPlusButton />
                </TouchableOpacity>
                <TouchableOpacity
                  // style={styles.actionBtn}
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowWithdrawPopup: true,
                    }));
                  }}>
                  <RcIconMinButton />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {isUnifiedAccount &&
            isBalanceExpanded &&
            !!visibleBalances.length && (
              <LinearGradient
                colors={[
                  'rgba(35, 192, 172, 0.20)',
                  'rgba(35, 192, 172, 0.00)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.expandedBalances}>
                <View style={styles.balanceChipRow}>
                  {visibleBalances.map(b => (
                    <View key={b.coin} style={styles.balanceChip}>
                      {COIN_ICON_MAP[b.coin] || null}
                      <Text style={styles.balanceChipText}>
                        {formatUsdValue(Number(b.available))}
                      </Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.toSwapBtn}
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowSwapPopup: true,
                    }));
                  }}>
                  <Text style={styles.toSwapText}>
                    {t('page.perps.PerpsSpotSwap.toSwapEntry')}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
        </View>
      </LinearGradient>
      {showLearnMore && (
        <LinearGradient
          colors={[colors2024['neutral-bg-5'], colors2024['neutral-bg-5']]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.card,
            styles.balanceCard,
            { marginTop: 12, backgroundColor: colors2024['neutral-bg-5'] },
          ]}>
          <TouchableOpacity
            onPress={() => {
              setPopupState(prev => ({
                ...prev,
                isShowGuidePopup: true,
              }));
            }}>
            <ImageBackground
              source={ImgLearnMore}
              resizeMode="cover"
              style={styles.learnCardInner}>
              <TouchableOpacity
                style={{ position: 'absolute', right: 14, top: 14 }}
                onPress={() => {
                  setHasClosedLearnMore(true);
                  apisPerps.setHasClosedLearnMoreCard(true);
                }}>
                <RcIconCloseCC
                  width={20}
                  height={20}
                  color={colors2024['neutral-secondary']}
                />
              </TouchableOpacity>
              <Text style={styles.learnTitle}>
                {t('page.perps.PerpsCard.title')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowGuidePopup: true,
                  }));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 4,
                }}>
                <Text style={styles.learnDesc}>
                  {t('page.perps.PerpsCard.learnMore')}
                </Text>
                <RcIconLearnArrow />
              </TouchableOpacity>
            </ImageBackground>
          </TouchableOpacity>
        </LinearGradient>
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  loginCard: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 20,
    height: 20,
  },
  loginCardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  loginCardDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  btnTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  loginCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loginCardBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginTop: 'auto',
  },
  learnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  learnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#23C0B0',
  },
  learnBtn: {
    backgroundColor: colors2024['neutral-line'],
  },
  learnBtnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  balanceCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 2, // gradient border width
  },
  balanceCardInner: {
    minHeight: 106,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#0E1A1E',
  },
  learnCardInner: {
    position: 'relative',
    borderRadius: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    height: 106,
  },
  balanceCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  balanceCardContentLeft: {
    flexDirection: 'column',
    flex: 1,
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 36,
    fontWeight: '900',
    color: '#F7FAFC',
  },
  availableBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: '#717380',
    // marginTop: 4,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 120,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#23C0B0',
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: '#040601',
  },
  history: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  availableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  expandArrow: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    color: '#717380',
  },
  expandedBalances: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  balanceChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
    columnGap: 17,
    rowGap: 4,
  },
  balanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  toSwapBtn: {
    flexShrink: 0,
    paddingVertical: 4,
  },
  balanceChipText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: '#F7FAFC',
  },
  toSwapText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#23C0AC',
  },
}));
