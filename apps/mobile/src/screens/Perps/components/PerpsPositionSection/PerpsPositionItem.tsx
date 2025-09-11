import { RcIconLong, RcIconShort } from '@/assets2024/icons/perps';
import { AssetAvatar } from '@/components';
import { MarketData, PositionAndOpenOrder } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { formatUsdValue, splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import RcArrowRight2CC from '@/assets2024/icons/copyTrading/IconRrightArrowCC.svg';
import { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';
const formatPct = (v: number) => `${(v * 100).toFixed(2)}%`;

export const PerpsPositionItem: React.FC<{
  item: PositionAndOpenOrder['position'];
  marketData: MarketData;
  onPress(): void;
  onClosePosition: () => void;
}> = ({ item, marketData, onPress, onClosePosition }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const {
    coin,
    szi,
    leverage,
    positionValue,
    marginUsed,
    unrealizedPnl,
    returnOnEquity,
    liquidationPx,
    entryPx,
  } = item;
  const isUp = Number(unrealizedPnl) >= 0;

  const sign = isUp ? '+' : '-';
  const side =
    Number(liquidationPx || 0) < Number(entryPx || 0) ? 'Long' : 'Short';
  const absPnlUsd = Math.abs(Number(unrealizedPnl));
  const absPnlPct = Math.abs(Number(returnOnEquity));
  const pnlText = `${sign}$${formatUsdValue(absPnlUsd)} (${formatPct(
    absPnlPct,
  )})`;
  const logoUrl = marketData?.logoUrl || '';
  const leverageText = `${leverage.value}x`;
  const markPrice = marketData?.markPx || '0';

  return (
    <View>
      <View style={styles.card}>
        <TouchableOpacity style={styles.topSection} onPress={onPress}>
          <View style={styles.iconContainer}>
            <AssetAvatar logo={logoUrl} logoStyle={styles.icon} size={24} />
          </View>
          <View style={styles.coinInfo}>
            <Text style={styles.coinName}>{coin} - USD</Text>
            <View
              style={[
                styles.leverageRow,
                {
                  backgroundColor:
                    side === 'Long'
                      ? colors2024['green-light-4']
                      : colors2024['red-light-1'],
                },
              ]}>
              <Text
                style={[
                  styles.leverageText,
                  side === 'Long' ? styles.longText : styles.shortText,
                ]}>
                {side} {leverageText}
              </Text>
            </View>
            <View style={styles.isolatedRow}>
              <Text style={styles.isolatedText}>
                {t('page.perpsDetail.PerpsPosition.isolated')}
              </Text>
            </View>
          </View>
          <View style={styles.rightArrow}>
            <RcArrowRight2CC color={colors2024['neutral-foot']} />
          </View>
        </TouchableOpacity>

        <View style={styles.dataSection}>
          <View style={styles.dataColumnLeft}>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.pnl')}
            </Text>
            <Text
              style={[
                styles.pnlValue,
                isUp ? styles.pnlPositive : styles.pnlNegative,
              ]}>
              {sign}
              {formatUsdValue(absPnlUsd)} ({formatPct(absPnlPct)})
            </Text>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.entryPrice')}
            </Text>
            <Text style={styles.dataValue}>
              {splitNumberByStep(Number(entryPx).toFixed(2))}
            </Text>
          </View>

          <View style={styles.dataColumn}>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.size')}
            </Text>
            <Text style={styles.dataValue}>
              ${splitNumberByStep(Number(positionValue).toFixed(2))}
            </Text>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.markPrice')}
            </Text>
            <Text style={styles.dataValue}>
              {splitNumberByStep(Number(markPrice).toFixed(2))}
            </Text>
          </View>

          <View style={styles.dataColumnRight}>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.justMargin')}
            </Text>
            <Text style={styles.dataValue}>
              ${splitNumberByStep(Number(marginUsed).toFixed(2))}
            </Text>
            <Text style={styles.sectionTitle}>
              {t('page.perpsDetail.PerpsPosition.liqPrice')}
            </Text>
            <Text style={styles.dataValue}>
              {splitNumberByStep(Number(liquidationPx).toFixed(2))}
            </Text>
          </View>
        </View>

        <View style={styles.closeButtonContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClosePosition}
            activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>
              {t('page.perpsDetail.PerpsPosition.closePosition', {
                direction: side,
              })}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 12,
    // paddingVertical: 16,
    // paddingHorizontal: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    flexDirection: 'column',
    // gap: 12,
  },
  topSection: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors2024['neutral-line'],
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  iconContainer: {
    position: 'relative',
    flexShrink: 0,
  },
  directionIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
  },
  icon: {
    width: 24,
    height: 24,
    borderRadius: 1000,
  },
  coinInfo: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
    flexDirection: 'row',
  },
  coinName: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  isolatedRow: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  leverageRow: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  leverageText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  longText: {
    color: colors2024['green-default'],
  },
  shortText: {
    color: colors2024['red-default'],
  },
  isolatedText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['neutral-foot'],
  },
  dataSection: {
    flexDirection: 'row',
    // gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  dataColumn: {
    flex: 2,
  },
  dataColumnLeft: {
    flex: 3,
  },
  dataColumnRight: {
    flex: 2,
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    marginBottom: 4,
  },
  pnlValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 10,
  },
  pnlPositive: {
    color: colors2024['green-default'],
  },
  pnlNegative: {
    color: colors2024['red-default'],
  },
  dataValue: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    marginBottom: 10,
  },
  closeButtonContainer: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  closeButton: {
    height: 52,
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  rightArrow: {
    // width: 24,
    // height: 24,
  },
}));
