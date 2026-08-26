import { RcIconCloseCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  ImageBackground,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import { Skeleton } from '@rneui/base';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { usePerpsPortfolioBreakdown } from '@/hooks/perps/usePerpsPortfolioBreakdown';
import { usePerpsPortfolioLiveValue } from '@/hooks/perps/usePerpsPortfolioLiveValue';
import {
  fetchPerpsPortfolio,
  usePerpsPortfolio,
} from '@/hooks/perps/usePerpsPortfolioStore';
import {
  compute24hChange,
  getLatestPortfolioValue,
  isPortfolioAllZero,
} from '@/hooks/perps/perpsPortfolio';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { useShowTipsPopup } from '@/hooks/useTipsPopup';
import { Text } from '@/components/Typography';
import ImgLearnMore from '@/assets2024/icons/perps/ImgLearnMore.png';
import RcIconLearnArrow from '@/assets2024/icons/perps/IconLearnArrow.svg';
import RcIconPortfolioInfoCC from '@/assets2024/icons/perps/IconPortfolioInfoCC.svg';
import RcIconPortfolioCollapseCC from '@/assets2024/icons/perps/IconPortfolioCollapseCC.svg';
import RcIconPortfolioPlusCC from '@/assets2024/icons/perps/IconPortfolioPlusCC.svg';
import RcIconPortfolioMinusCC from '@/assets2024/icons/perps/IconPortfolioMinusCC.svg';
import { apisPerps } from '@/core/apis';
import BigNumber from 'bignumber.js';
import TickerTexts, { TickItem } from '@/components/Animated/TickerText';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LoadingLinear } from '@/screens/TokenDetail/components/TokenPriceChart/LoadingLinear';
import { PerpsPortfolioChart } from './PerpsPortfolioChart';
import { useMemoizedFn } from 'ahooks';

const PERPS_TEAL = '#23C0B0';
const PERPS_BTN_BG = 'rgba(80, 210, 193, 0.10)';

// chart 120 + tab row (16 + 4 margin) + top margin 16
const EXPANDED_BLOCK_HEIGHT = 156;

const BreakdownContent = ({
  desc,
  rows,
}: {
  desc: string;
  rows: { label: string; value: number }[];
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={styles.breakdownContainer}>
      <Text style={styles.breakdownDesc}>{desc}</Text>
      <View style={styles.breakdownCard}>
        {rows.map(row => (
          <View key={row.label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{row.label}</Text>
            <Text style={styles.breakdownValue}>
              {formatUsdValue(row.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export const PerpsAccountCard: React.FC = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [popupState, setPopupState] = usePerpsPopupState();
  const showTipsPopup = useShowTipsPopup();

  const {
    availableBalance,
    accountValue,
    isUnifiedAccount,
    isPortfolioMargin,
  } = usePerpsAccount();
  const { hasNonPerpsAssets, breakdownMode, getBreakdownValues } =
    usePerpsPortfolioBreakdown();

  const currentAddress = useActivityStore(
    perpsStore,
    s => s.currentPerpsAccount?.address,
    Object.is,
    { storeLabel: 'perps-account-card' },
  );

  const portfolioEntry = usePerpsPortfolio(currentAddress);
  const isFocused = useIsFocused();

  // Poll while the Perps screen is focused; the store dedupes and keeps a
  // short TTL, so focus flaps do not cause request bursts.
  useEffect(() => {
    if (!currentAddress || !isFocused) {
      return;
    }
    fetchPerpsPortfolio(currentAddress);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') {
        fetchPerpsPortfolio(currentAddress, { force: true });
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [currentAddress, isFocused]);

  // Refresh shortly after a deposit/withdraw/swap popup closes so the
  // portfolio value catches the funding change. (Balance-driven triggers are
  // avoided on purpose: on manual accounts withdrawable ticks with prices
  // while a position is open — unified keeps it at 0 and moves spot balances
  // instead — so either way a balance-driven trigger would turn into a
  // constant forced-refetch stream.)
  const anyFundingPopupOpen =
    popupState.isShowDepositPopup ||
    popupState.isShowWithdrawPopup ||
    popupState.isShowSwapPopup;
  const prevFundingPopupOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevFundingPopupOpenRef.current;
    prevFundingPopupOpenRef.current = anyFundingPopupOpen;
    if (!wasOpen || anyFundingPopupOpen || !currentAddress) {
      return;
    }
    const timer = setTimeout(() => {
      fetchPerpsPortfolio(currentAddress, { force: true });
    }, 3_000);
    return () => clearTimeout(timer);
  }, [anyFundingPopupOpen, currentAddress]);

  const portfolioData = portfolioEntry?.data ?? null;
  const isPortfolioEmpty = useMemo(
    () => !!portfolioData && isPortfolioAllZero(portfolioData),
    [portfolioData],
  );
  // 'zero': no account, or an account whose history is all zeros — show the
  // Figma empty state. 'loading': logged in but no data yet (fetch pending or
  // failed; the 60s poll keeps retrying) — show skeletons, never a fake $0.
  const portfolioViewState: 'zero' | 'loading' | 'data' = !currentAddress
    ? 'zero'
    : portfolioData == null
    ? 'loading'
    : isPortfolioEmpty
    ? 'zero'
    : 'data';
  const portfolioValue = useMemo(
    () => (portfolioData ? getLatestPortfolioValue(portfolioData) : null),
    [portfolioData],
  );
  // Live WS-computed value ticks in real time (Pro-panel basis); the
  // portfolio API's near-realtime last point covers the gap until the WS
  // slices are ready.
  const liveValue = usePerpsPortfolioLiveValue();
  const displayValue = liveValue ?? portfolioValue;
  const change24h = useMemo(
    () => (portfolioData ? compute24hChange(portfolioData) : null),
    [portfolioData],
  );

  const change24hText = useMemo(() => {
    if (!change24h) {
      return '';
    }
    const sign = change24h.pnl < 0 ? '-' : '+';
    const amountText = `${sign}$${splitNumberByStep(
      Math.abs(change24h.pnl).toFixed(2),
    )}`;
    if (change24h.percent == null) {
      return amountText;
    }
    const percentText = `${sign}${Math.abs(change24h.percent * 100).toFixed(
      2,
    )}%`;
    return `${percentText}(${amountText})`;
  }, [change24h]);
  const isChangeLoss = (change24h?.pnl ?? 0) < 0;

  const [isChartExpanded, setIsChartExpanded] = useState(false);
  // Keeps the expanded chart mounted while the collapse animation runs.
  const [renderExpandedChart, setRenderExpandedChart] = useState(false);
  const expandProgress = useSharedValue(0);
  const [cardWidth, setCardWidth] = useState(0);

  const toggleChart = useMemoizedFn((next: boolean) => {
    setIsChartExpanded(next);
    expandProgress.value = withTiming(next ? 1 : 0, {
      duration: 300,
      // Material's standard curve — quick start, soft landing.
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    if (next) {
      setRenderExpandedChart(true);
    }
  });
  useEffect(() => {
    if (isChartExpanded || !renderExpandedChart) {
      return;
    }
    const timer = setTimeout(() => setRenderExpandedChart(false), 300);
    return () => clearTimeout(timer);
  }, [isChartExpanded, renderExpandedChart]);

  const expandedBlockStyle = useAnimatedStyle(() => ({
    height: expandProgress.value * EXPANDED_BLOCK_HEIGHT,
    // Fade the content in after the height is mostly there (and out first
    // on collapse) — height and opacity moving in lockstep reads as abrupt.
    opacity: interpolate(
      expandProgress.value,
      [0, 0.4, 1],
      [0, 0.1, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const canExpandChart = !!portfolioData && !isPortfolioEmpty;

  const accountTypeTitle = isPortfolioMargin
    ? t('page.perps.PerpsCard.portfolioMarginAccount')
    : isUnifiedAccount
    ? t('page.perps.PerpsCard.unifiedAccount')
    : t('page.perps.PerpsCard.manualAccount');

  const handleShowBreakdown = useMemoizedFn(() => {
    const { perpsValue, secondaryValue } = getBreakdownValues(
      displayValue || 0,
    );
    const descKey = {
      manual: 'page.perps.PerpsCard.manualAccountDesc',
      unified: 'page.perps.PerpsCard.unifiedAccountDesc',
      portfolioMargin: 'page.perps.PerpsCard.portfolioMarginAccountDesc',
    }[breakdownMode];
    const secondaryLabelKey = {
      manual: 'page.perps.PerpsCard.breakdownSpot',
      unified: 'page.perps.PerpsCard.breakdownOtherAssets',
      portfolioMargin: 'page.perps.PerpsCard.breakdownNetOtherAssets',
    }[breakdownMode];
    showTipsPopup({
      title: accountTypeTitle,
      bgType: 'bg0',
      desc: (
        <BreakdownContent
          desc={t(descKey)}
          rows={[
            {
              label: t('page.perps.PerpsCard.breakdownPerps'),
              value: perpsValue,
            },
            { label: t(secondaryLabelKey), value: secondaryValue },
          ]}
        />
      ),
      buttonType: 'hyperliquid',
    });
  });

  const isNewUser = useMemo(() => {
    return (
      Number(availableBalance) === 0 && accountValue === 0 && !isUnifiedAccount
    );
  }, [availableBalance, accountValue, isUnifiedAccount]);

  const [hasClosedLearnMore, setHasClosedLearnMore] = useState(true);
  useEffect(() => {
    apisPerps.getHasClosedLearnMoreCard().then(closed => {
      setHasClosedLearnMore(closed);
    });
  }, []);

  const showLearnMore = isNewUser && !hasClosedLearnMore;

  const openDeposit = useCallback(() => {
    setPopupState(prev => ({ ...prev, isShowDepositPopup: true }));
  }, [setPopupState]);
  const openWithdraw = useCallback(() => {
    setPopupState(prev => ({ ...prev, isShowWithdrawPopup: true }));
  }, [setPopupState]);

  return (
    <>
      <View style={styles.cardShadow}>
        <LinearGradient
          // Opaque composite of the design's white 90%->54% glass over the
          // screen's bg0 (#F6F7F7) — deterministic regardless of what is
          // rendered behind the card.
          colors={
            isLight
              ? ['#FEFEFE', '#FAFBFB']
              : [colors2024['neutral-bg-1'], colors2024['neutral-bg-1']]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
          onLayout={e => setCardWidth(e.nativeEvent.layout.width)}>
          <View style={styles.upperSection}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.titleRow}>
                  <Text style={styles.portfolioLabel}>
                    {t('page.perps.PerpsCard.portfolioValue')}
                  </Text>
                  {hasNonPerpsAssets && (
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      onPress={handleShowBreakdown}>
                      <RcIconPortfolioInfoCC
                        width={16}
                        height={16}
                        color={colors2024['neutral-foot']}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {portfolioViewState === 'loading' ? (
                  <Skeleton
                    width={132}
                    height={28}
                    style={styles.valueSkeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : portfolioViewState === 'zero' ? (
                  <Text style={[styles.portfolioValue, styles.valueSlot]}>
                    0
                  </Text>
                ) : (
                  <TickerTexts
                    // Keep spacing OUT of textStyle: TickerText measures each
                    // glyph and margins corrupt its scroll windows.
                    containerStyle={styles.valueSlot}
                    textStyle={styles.portfolioValue}
                    duration={750}>
                    <TickItem rotateItems={['$']}>{'$'}</TickItem>
                    {splitNumberByStep(
                      new BigNumber(displayValue || 0).toFixed(2),
                    )}
                  </TickerTexts>
                )}
                <View style={styles.changeRow}>
                  {portfolioViewState === 'loading' ? (
                    <Skeleton
                      width={92}
                      height={16}
                      style={styles.changeSkeleton}
                      LinearGradientComponent={LoadingLinear}
                    />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.changeText,
                          {
                            color: isChangeLoss
                              ? colors2024['red-default']
                              : colors2024['green-default'],
                          },
                        ]}>
                        {portfolioViewState === 'zero'
                          ? '+0%(+$0.00)'
                          : change24hText}
                      </Text>
                      <Text style={styles.changeTimeText}>24H</Text>
                    </>
                  )}
                </View>
              </View>
              {!isChartExpanded &&
                (portfolioViewState === 'loading' ? (
                  <Skeleton
                    width={140}
                    height={60}
                    style={styles.sparklineSkeleton}
                    LinearGradientComponent={LoadingLinear}
                  />
                ) : (
                  <Pressable
                    disabled={!canExpandChart}
                    onPress={() => toggleChart(true)}
                    style={styles.sparklineWrap}>
                    <PerpsPortfolioChart
                      data={portfolioData}
                      isEmpty={isPortfolioEmpty || !portfolioData}
                      expanded={false}
                      width={0}
                    />
                  </Pressable>
                ))}
            </View>
            {isChartExpanded && (
              <TouchableOpacity
                style={styles.collapseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => toggleChart(false)}>
                <RcIconPortfolioCollapseCC
                  width={16}
                  height={16}
                  color={colors2024['neutral-foot']}
                />
              </TouchableOpacity>
            )}
            <Animated.View style={[styles.expandedBlock, expandedBlockStyle]}>
              {renderExpandedChart && (
                <View style={styles.expandedChartInner}>
                  <PerpsPortfolioChart
                    data={portfolioData}
                    isEmpty={isPortfolioEmpty || !portfolioData}
                    expanded
                    width={Math.max(cardWidth - 32, 0)}
                  />
                </View>
              )}
            </Animated.View>
          </View>
          <View style={styles.lowerSection}>
            <View style={styles.lowerRow}>
              <View style={styles.availableLeft}>
                <Text style={styles.availableLabel}>
                  {t('page.perps.PerpsCard.available')}
                </Text>
                <Text style={styles.availableValue}>
                  {'$'}
                  {splitNumberByStep(
                    new BigNumber(availableBalance || 0).toFixed(2),
                  )}
                </Text>
              </View>
              {Number(availableBalance) === 0 ? (
                <TouchableOpacity
                  style={styles.addFundsBtn}
                  onPress={openDeposit}>
                  <RcIconPortfolioPlusCC
                    width={14}
                    height={14}
                    color={PERPS_TEAL}
                  />
                  <Text style={styles.addFundsText}>
                    {t('page.perps.PerpsCard.addFunds')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={styles.roundBtn}
                    onPress={openDeposit}>
                    <RcIconPortfolioPlusCC
                      width={13}
                      height={13}
                      color={PERPS_TEAL}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.roundBtn}
                    onPress={openWithdraw}>
                    <RcIconPortfolioMinusCC
                      width={13}
                      height={13}
                      color={PERPS_TEAL}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>
      </View>
      {showLearnMore && (
        <LinearGradient
          colors={[colors2024['neutral-bg-5'], colors2024['neutral-bg-5']]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.learnCard}>
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
                style={styles.learnCloseBtn}
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
                style={styles.learnMoreRow}>
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
  // Shadow lives on its own wrapper: `overflow: 'hidden'` (needed to clip
  // the lower strip's corners) would clip the iOS shadow if they shared a view.
  cardShadow: {
    borderRadius: 14,
    backgroundColor: isLight ? '#FEFEFE' : colors2024['neutral-bg-1'],
    shadowColor: '#37383F',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  upperSection: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  portfolioLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  portfolioValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  valueSlot: {
    marginTop: 8,
  },
  valueSkeleton: {
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-3'],
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    height: 16,
  },
  changeSkeleton: {
    borderRadius: 4,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-3'],
  },
  changeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  changeTimeText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-info'],
  },
  sparklineWrap: {
    width: 140,
    height: 60,
    marginTop: 12,
  },
  sparklineSkeleton: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-3'],
  },
  collapseBtn: {
    position: 'absolute',
    right: 16,
    top: 17,
  },
  expandedBlock: {
    overflow: 'hidden',
  },
  expandedChartInner: {
    paddingTop: 16,
  },
  lowerSection: {
    backgroundColor: colors2024['neutral-bg-2'],
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lowerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availableLeft: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  availableLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  availableValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    marginTop: 2,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 10.8,
    backgroundColor: PERPS_BTN_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFundsBtn: {
    height: 36,
    borderRadius: 10.8,
    backgroundColor: PERPS_BTN_BG,
    paddingHorizontal: 14,
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFundsText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: PERPS_TEAL,
  },
  breakdownContainer: {
    marginTop: 8,
    gap: 16,
  },
  breakdownDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  breakdownCard: {
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  breakdownLabel: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  breakdownValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  learnCard: {
    borderRadius: 16,
    marginTop: 12,
    backgroundColor: colors2024['neutral-bg-5'],
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
  learnCloseBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  learnMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
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
    color: PERPS_TEAL,
  },
}));
