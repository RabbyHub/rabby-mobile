import { RcIconInfoFill1CC, RcIconInfoFillCC } from '@/assets/icons/common';
import { AppSwitch } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useTipsPopup } from '@/hooks/useTipsPopup';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

export const PerpsPosition: React.FC<{
  positionData?: {
    pnl: number;
    positionValue: number;
    size: number;
    marginUsed: number;
    side: string;
    leverage: number;
    type: 'isolated' | 'cross';
    entryPrice: number;
    liquidationPrice: string;
    autoClose: boolean;
    direction: string;
    pnlPercent: number;
    fundingPayments: string;
  } | null;
  coin: string;
  hasAutoClose?: boolean;
  tpPrice?: string;
  slPrice?: string;
  onAutoCloseChange?(v: boolean): void;
}> = ({
  positionData,
  coin,
  hasAutoClose,
  tpPrice,
  slPrice,
  onAutoCloseChange,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const { showTipsPopup } = useTipsPopup();

  if (!positionData) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('page.perpsDetail.PerpsPosition.title')}
        </Text>
      </View>
      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>
              {t('page.perpsDetail.PerpsPosition.pnl')}
            </Text>
          </View>
          <View>
            <Text
              style={[
                styles.value,
                positionData && positionData.pnl >= 0
                  ? styles.green
                  : styles.red,
              ]}>
              {positionData && positionData.pnl >= 0 ? '+' : '-'}$
              {Math.abs(positionData?.pnl || 0).toFixed(2)} (
              {positionData && positionData.pnl >= 0 ? '+' : ''}
              {positionData?.pnlPercent.toFixed(2)}%)
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsPosition.size'),
                desc: t('page.perpsDetail.PerpsPosition.sizeTips'),
              });
            }}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.size')}
              </Text>
              <RcIconInfoFill1CC
                width={15}
                height={15}
                color={colors2024['neutral-info']}
              />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.value}>
              $
              {splitNumberByStep(
                Number(positionData?.positionValue || 0).toFixed(2),
              )}{' '}
              = {positionData?.size} {coin}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>
              {positionData?.type === 'cross'
                ? t('page.perpsDetail.PerpsPosition.marginCross')
                : t('page.perpsDetail.PerpsPosition.marginIsolated')}
            </Text>
          </View>
          <View>
            <Text style={styles.value}>
              $
              {splitNumberByStep(
                Number(positionData?.marginUsed || 0).toFixed(2),
              )}
            </Text>
          </View>
        </View>
        <View style={styles.listItemContainer}>
          <View style={styles.listItemRow}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.autoClose')}
              </Text>
            </View>
            <View>
              <AppSwitch
                value={hasAutoClose}
                circleSize={20}
                circleBorderWidth={2}
                onValueChange={onAutoCloseChange}
              />
            </View>
          </View>
          {hasAutoClose ? (
            <View style={styles.listSub}>
              {tpPrice ? (
                <View style={styles.listSubItem}>
                  <Text style={styles.listSubItemLabel}>
                    {t('page.perpsDetail.PerpsPosition.tpPrice')}
                  </Text>
                  <Text style={styles.value}>${tpPrice || 0}</Text>
                  {/* <RcArrowRight2CC
                  width={16}
                  height={16}
                  color={colors2024['neutral-body']}
                /> */}
                </View>
              ) : null}
              {slPrice ? (
                <View style={styles.listSubItem}>
                  <Text style={styles.listSubItemLabel}>
                    {t('page.perpsDetail.PerpsPosition.slPrice')}
                  </Text>
                  <Text style={styles.value}>${slPrice || 0}</Text>
                  {/* <RcArrowRight2CC
                  width={16}
                  height={16}
                  color={colors2024['neutral-body']}
                /> */}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>
              {t('page.perpsDetail.PerpsPosition.direction')}
            </Text>
          </View>
          <View>
            <Text style={styles.value}>
              {positionData?.direction} {positionData?.leverage}x
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>
              {t('page.perpsDetail.PerpsPosition.entryPrice')}
            </Text>
          </View>
          <View>
            <Text style={styles.value}>
              ${splitNumberByStep(positionData?.entryPrice || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsPosition.liquidationPrice'),
                desc: t('page.perpsDetail.PerpsPosition.liquidationPriceTips'),
              });
            }}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.liquidationPrice')}
              </Text>
              <RcIconInfoFill1CC
                width={15}
                height={15}
                color={colors2024['neutral-info']}
              />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.value}>
              ${splitNumberByStep(positionData?.liquidationPrice || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <TouchableOpacity
            onPress={() => {
              showTipsPopup({
                title: t('page.perpsDetail.PerpsPosition.fundingPayments'),
                desc: t('page.perpsDetail.PerpsPosition.fundingPaymentsTips'),
              });
            }}>
            <View style={styles.listItemMain}>
              <Text style={styles.label}>
                {t('page.perpsDetail.PerpsPosition.fundingPayments')}
              </Text>
              <RcIconInfoFill1CC
                width={15}
                height={15}
                color={colors2024['neutral-info']}
              />
            </View>
          </TouchableOpacity>
          <View>
            <Text style={styles.value}>
              {Number(positionData?.fundingPayments || 0) > 0 ? '+' : '-'}$
              {Math.abs(Number(positionData?.fundingPayments || 0))}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  section: {
    marginBottom: 24,
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  list: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  listItemContainer: {
    padding: 16,
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  listItemRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listSub: {
    padding: 12,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 6,
    marginTop: 12,
  },
  listSubItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  listSubItemLabel: {
    flex: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  listItemMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 20,
  },
  label: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  red: {
    color: colors2024['red-default'],
  },
  green: {
    color: colors2024['green-default'],
  },
}));
