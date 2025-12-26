import React, { useMemo } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';

import {
  createGetStyles2024,
  makeDebugBorder,
  makeTriangleStyle,
} from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { formatNetworth } from '@/utils/math';
import { estDaily, formatApy } from '../../utils/format';
import { getHealthStatusColor, isHFEmpty } from '../../utils';
import { useTranslation } from 'react-i18next';
import { getHealthFactorText } from '../HealthFactorText';
import { HF_COLOR_GOOD_THRESHOLD } from '../../utils/constant';
import RightMarketTabInfo from '../RightMarketTabInfo';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import IconCloseCC from '@/assets2024/icons/common/close-cc.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useLendingService } from '../../hooks/useLendingService';

interface SummaryItemProps {
  netWorth: string;
  supplied: string;
  borrowed: string;
  netApy: number;
  healthFactor: string;
}

const SummaryItem: React.FC<SummaryItemProps> = ({
  netWorth,
  supplied,
  borrowed,
  netApy,
  healthFactor,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { skipHealthFactorWarning, setSkipHealthFactorWarning } =
    useLendingService();
  const extraInfo = useMemo(() => {
    if (
      !healthFactor ||
      isHFEmpty(Number(healthFactor || '0')) ||
      skipHealthFactorWarning
    ) {
      return false;
    }
    return true;
  }, [healthFactor, skipHealthFactorWarning]);

  const healthStatus = useMemo(() => {
    const numHF = Number(healthFactor || '0');
    const hfColorInfo = getHealthStatusColor(numHF);
    const label =
      numHF < HF_COLOR_GOOD_THRESHOLD
        ? t('page.Lending.summary.risky')
        : t('page.Lending.summary.healthy');
    return {
      ...hfColorInfo,
      label,
    };
  }, [healthFactor, t]);

  const netApyText = useMemo(() => {
    const apyAbs = Math.abs(Number(netApy || 0));
    const formatted = formatApy(apyAbs);
    return `${netApy > 0 ? '+' : '-'}${formatted}`;
  }, [netApy]);

  const estDailyText = useMemo(() => {
    return estDaily(netWorth, netApy);
  }, [netApy, netWorth]);

  const onlySupply = useMemo(() => {
    return (
      Number(borrowed || '0') === 0 && isHFEmpty(Number(healthFactor || '0'))
    );
  }, [borrowed, healthFactor]);

  const handleShowHFDescription = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.HF_DESCRIPTION,
      hf: healthFactor,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        {onlySupply ? (
          <View style={styles.row}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>
                {t('page.Lending.totalSupplied')}
              </Text>
              <Text style={styles.metricValue}>
                {formatNetworth(Number(supplied || '0'))}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{t('page.Lending.netApy')}</Text>
              <Text
                style={[
                  styles.netApyValue,
                  {
                    color:
                      netApy > 0
                        ? colors2024['green-default']
                        : colors2024['red-default'],
                  },
                ]}>
                {netApyText}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>
                {t('page.Lending.estDailyEarning')}
              </Text>
              <Text style={styles.metricValue}>{estDailyText}</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('page.Lending.netWorth')}
                </Text>
                <Text style={styles.metricValue}>
                  {formatNetworth(Number(netWorth || '0'))}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('page.Lending.totalBorrowed')}
                </Text>
                <Text style={styles.metricValue}>
                  {formatNetworth(Number(borrowed || '0'))}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>
                  {t('page.Lending.totalSupplied')}
                </Text>
                <Text style={styles.metricValue}>
                  {formatNetworth(Number(supplied || '0'))}
                </Text>
              </View>
            </View>

            <View style={[styles.row, styles.rowCompact]}>
              <View
                style={[
                  styles.metricItem,
                  styles.metricItemCompact,
                  isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
                ]}>
                <Pressable
                  style={[styles.metricItem, { paddingHorizontal: 0 }]}
                  onPress={handleShowHFDescription}>
                  <View style={styles.healthFactorHeader}>
                    <Text style={styles.metricLabel}>
                      {t('page.Lending.hf')}
                    </Text>
                    <WarningFillCC
                      width={12}
                      height={12}
                      color={colors2024['neutral-secondary']}
                    />
                  </View>
                  <View style={styles.healthRow}>
                    <Text
                      style={[
                        styles.healthValue,
                        { color: healthStatus.color },
                      ]}>
                      {getHealthFactorText(healthFactor)}
                    </Text>
                    <View
                      style={[
                        styles.healthTag,
                        { backgroundColor: healthStatus.backgroundColor },
                      ]}>
                      <Text
                        style={[
                          styles.healthTagText,
                          {
                            color: healthStatus.color,
                          },
                        ]}>
                        {healthStatus.label}
                      </Text>
                      {!!extraInfo && (
                        <View
                          style={[
                            styles.triangle,
                            makeTriangleStyle({
                              dir: 'up',
                              size: 8,
                              color: colors2024['neutral-bg-5'],
                            }),
                          ]}
                        />
                      )}
                    </View>
                  </View>
                </Pressable>
              </View>
              <View style={[styles.metricItem, styles.metricItemCompact]}>
                <Text style={styles.metricLabel}>
                  {t('page.Lending.netApy')}
                </Text>
                <Text
                  style={[
                    styles.netApyValue,
                    {
                      color:
                        netApy > 0
                          ? colors2024['green-default']
                          : colors2024['red-default'],
                    },
                  ]}>
                  {netApyText}
                </Text>
              </View>
              <View style={[styles.metricItem, styles.metricItemCompact]}>
                <Text style={styles.metricLabel}>
                  {t('page.Lending.estDailyEarning')}
                </Text>
                <Text style={styles.metricValue}>{estDailyText}</Text>
              </View>
            </View>
            {!!extraInfo && (
              <View style={[styles.extraContainer]}>
                <View style={styles.extraLeft}>
                  <Text style={styles.extraLeftText}>
                    {t('page.Lending.summary.lq')}
                  </Text>
                  <TouchableOpacity onPress={handleShowHFDescription}>
                    <Text style={styles.extraLeftMore}>
                      {t('page.Lending.summary.more')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.extraClose}
                  onPress={() => setSkipHealthFactorWarning(true)}>
                  <IconCloseCC
                    width={14}
                    height={14}
                    color={colors2024['neutral-title-1']}
                  />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomSection}>
        <RightMarketTabInfo />
      </View>
    </View>
  );
};

export default SummaryItem;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingTop: 0,
    paddingBottom: 16,
  },
  topSection: {
    paddingHorizontal: 0,
    paddingVertical: 12,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  rowCompact: {
    justifyContent: 'flex-start',
  },
  metricItem: {
    flex: 1,
    paddingHorizontal: 7,
    gap: 6,
  },
  metricItemCompact: {
    flex: 0,
    width: '33.33%',
  },
  hidden: {
    display: 'none',
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  metricValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  healthValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
  },
  healthTag: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  healthTagText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  netApyValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    textAlign: 'left',
  },
  divider: {
    height: 1,
    backgroundColor: colors2024['neutral-bg-5'],
    marginTop: 0,
    marginHorizontal: 0,
  },
  bottomSection: {
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  healthFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionHeader: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
  },
  hfTipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hfTipsContentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-InvertHighlight'],
  },
  moreContainer: {
    height: 14,
  },
  moreText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
  },
  closeButton: {},
  parentWrapperStyle: {
    width: '100%',
    flex: 1,
    gap: 6,
  },
  contentStyle: {
    paddingHorizontal: 12,
    paddingRight: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 54,
  },
  extraContainer: {
    position: 'relative',
    backgroundColor: colors2024['neutral-bg-5'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingRight: 16,
    marginHorizontal: 12,
    height: 40,
  },
  extraLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  extraLeftText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  extraLeftMore: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  extraClose: {
    marginLeft: 8,
  },
  triangle: {
    position: 'absolute',
    bottom: -16,
    left: '50%',
    color: 'black',
    transform: [{ translateX: -6 }],
  },
}));
