import React, { useMemo } from 'react';
import { createGetStyles2024, makeTriangleStyle } from '@/utils/styles';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import { ThemeColors, ThemeColors2024 } from '@/constant/theme';
import { useTheme2024 } from '@/hooks/theme';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import { formatNetworth } from '@/utils/math';
import { estDaily, formatApy } from './utils/format';
import { getHealthStatusColor, isHFEmpty } from './utils';
import IconCloseCC from '@/assets2024/icons/common/close-bold-cc.svg';
import IconSwitchCC from '@/assets2024/icons/lending/switch-cc.svg';
import AAVEIcon from '@/assets2024/icons/lending/aave.svg';
import { HF_COLOR_GOOD_THRESHOLD } from './utils/constant';
import { useLendingService } from './hooks/useLendingService';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getHealthFactorText } from './components/HealthFactorText';
import { atom, useAtom } from 'jotai';
import { useLendingSummaryCard } from './hooks';

const isEstDailySwitchAtom = atom(true);
const SummaryCard = (/* props: IProps */) => {
  const {
    iUserSummary: {
      netWorthUSD: netWorth,
      totalLiquidityUSD: supplied,
      totalBorrowsUSD: borrowed,
      healthFactor,
    },
    netAPY,
  } = useLendingSummaryCard();

  const props = {
    netWorth: netWorth || '',
    supplied: supplied || '',
    borrowed: borrowed || '',
    healthFactor: healthFactor || '',
    netApy: netAPY || 0,
  };

  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { skipHealthFactorWarning, setSkipHealthFactorWarning } =
    useLendingService();
  const [isEstDailySwitch, setIsEstDailySwitch] = useAtom(isEstDailySwitchAtom);
  const handleShowHFDescription = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.HF_DESCRIPTION,
      hf: props.healthFactor,
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
  const extraInfo = useMemo(() => {
    if (
      !props?.healthFactor ||
      isHFEmpty(Number(props.healthFactor || '0')) ||
      skipHealthFactorWarning
    ) {
      return false;
    }
    return true;
  }, [props.healthFactor, skipHealthFactorWarning]);

  return (
    <LinearGradient
      colors={['rgba(35, 46, 73, 1)', 'rgba(4, 25, 32, 1)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container]}>
      <View
        style={[
          styles.contentContainer,
          extraInfo ? styles.noBottom : styles.patchBottom,
        ]}>
        <AAVEIcon
          width={118}
          height={61.5}
          style={styles.relativeIcon}
          color={colors2024['red-default']}
        />
        <View style={styles.netWorthContainer}>
          <View style={styles.netWorthHeader}>
            <Text style={styles.netWorthTitle}>
              {t('page.Lending.netWorth')}
            </Text>
            <Text style={styles.netWorthValue}>
              {formatNetworth(Number(props.netWorth || '0'))}
            </Text>
          </View>
          <View style={styles.suppliedAndBorrowedContainer}>
            <Text style={styles.suppliedAndBorrowedTitle}>
              {t('page.Lending.supplied')}:{' '}
              {formatNetworth(Number(props.supplied || '0'))} |
              {t('page.Lending.borrowed')}:{' '}
              {formatNetworth(Number(props.borrowed || '0'))}
            </Text>
          </View>
        </View>
        <View style={styles.estAndHealthContainer}>
          <Pressable
            hitSlop={20}
            onPress={e => {
              e.stopPropagation();
              setIsEstDailySwitch(pre => !pre);
            }}
            style={styles.estDailyContainer}>
            <View style={styles.estDailyHeader}>
              <Text style={styles.sectionHeader}>
                {isEstDailySwitch
                  ? t('page.Lending.estDailyEarning')
                  : t('page.Lending.estNetApy')}
              </Text>
              <View>
                <IconSwitchCC
                  width={14}
                  height={14}
                  color={ThemeColors2024.dark['neutral-foot']}
                />
              </View>
            </View>
            <View style={styles.sectionContent}>
              <Text
                style={[
                  styles.estDailyValue,
                  {
                    color:
                      props.netApy > 0
                        ? colors2024['green-default']
                        : colors2024['red-default'],
                  },
                ]}>
                {isEstDailySwitch
                  ? estDaily(props.netWorth, props.netApy)
                  : `${props.netApy > 0 ? '+' : '-'}${formatApy(
                      Math.abs(Number(props.netApy || '0')),
                    )}`}
              </Text>
            </View>
          </Pressable>
          <Pressable
            hitSlop={20}
            onPress={handleShowHFDescription}
            style={[
              styles.healthFactorContainer,
              isHFEmpty(Number(props.healthFactor || '0')) && styles.hidden,
            ]}>
            <View style={styles.healthFactorHeader}>
              <Text style={styles.sectionHeader}>{t('page.Lending.hf')}</Text>
              <View>
                <WarningFillCC
                  width={12}
                  height={12}
                  color={ThemeColors2024.dark['neutral-secondary']}
                />
              </View>
            </View>
            <View style={styles.sectionContent}>
              <View style={styles.healthFactorValueContainer}>
                <Text
                  style={[
                    styles.healthFactorValue,
                    {
                      color: getHealthStatusColor(
                        Number(props.healthFactor || '0'),
                      ).color,
                    },
                  ]}>
                  {getHealthFactorText(props.healthFactor)}
                </Text>
                {!!extraInfo && (
                  <View
                    style={[
                      styles.triangle,
                      makeTriangleStyle({
                        dir: 'up',
                        size: 8,
                        color: 'rgba(50, 60, 89, 1)',
                      }),
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.healthFactorStatus,
                  {
                    color: getHealthStatusColor(
                      Number(props.healthFactor || '0'),
                    ).color,
                    backgroundColor: getHealthStatusColor(
                      Number(props.healthFactor || '0'),
                    ).backgroundColor,
                  },
                ]}>
                {Number(props.healthFactor || '0') < HF_COLOR_GOOD_THRESHOLD
                  ? t('page.Lending.summary.risky')
                  : t('page.Lending.summary.healthy')}
              </Text>
            </View>
          </Pressable>
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
    </LinearGradient>
  );
};

export default SummaryCard;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(27, 32, 48, 1)',
  },
  contentContainer: {
    position: 'relative',
    borderRadius: 16,
    paddingTop: 20,
    margin: 2,
    backgroundColor: 'rgba(27, 32, 48, 1)',
    overflow: 'hidden',
  },
  patchBottom: {
    paddingBottom: 22,
  },
  noBottom: {
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 13,
  },
  extraContainer: {
    position: 'relative',
    backgroundColor: 'rgba(50, 60, 89, 1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 12,
    paddingRight: 16,
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
    color: ThemeColors2024.dark['neutral-foot'],
  },
  extraLeftMore: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'SF Pro Rounded',
    color: ThemeColors2024.dark['neutral-title-1'],
  },
  suppliedAndBorrowedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  netWorthContainer: {
    gap: 2,
    paddingHorizontal: 20,
  },
  netWorthHeader: {
    gap: 2,
  },
  netWorthTitle: {
    color: ThemeColors2024.dark['neutral-foot'],
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
  },
  netWorthValue: {
    color: ThemeColors.dark['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
  },
  suppliedAndBorrowedTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: ThemeColors2024.dark['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  estAndHealthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  estDailyContainer: {
    flex: 1,
    gap: 2,
  },
  estDailyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionHeader: {
    color: ThemeColors2024.dark['neutral-foot'],
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
  },
  healthFactorContainer: {
    flex: 1,
    gap: 2,
  },
  hidden: {
    display: 'none',
  },
  healthFactorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  estDailyValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['green-default'],
  },
  netApy: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: ThemeColors2024.dark['neutral-body'],
  },
  healthFactorValueContainer: {
    position: 'relative',
  },
  healthFactorValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['green-default'],
  },
  healthFactorStatus: {
    color: colors2024['green-default'],
    backgroundColor: colors2024['green-light-1'],
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    overflow: 'hidden',
  },
  relativeIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  triangle: {
    position: 'absolute',
    bottom: -16,
    left: '50%',
    color: 'black',
    transform: [{ translateX: -6 }],
  },
  extraClose: {
    marginLeft: 8,
  },
}));
