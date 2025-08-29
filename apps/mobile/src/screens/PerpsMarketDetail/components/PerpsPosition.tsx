import { RcIconInfoFillCC } from '@/assets/icons/common';
import { AppSwitch } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export const PerpsPosition: React.FC<{
  positionData?: {
    pnl: number;
    positionValue: number;
    size: number;
    marginUsed: number;
    side: string;
    leverage: number;
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
  if (!positionData) {
    return;
  }

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>Position</Text>
      </View>
      <View style={styles.list}>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>PNL</Text>
          </View>
          <View>
            <Text style={styles.value}>
              {(positionData?.pnl || 0).toFixed(2)} (
              {positionData?.pnlPercent.toFixed(2)}%)
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Size</Text>
            <RcIconInfoFillCC
              width={15}
              height={15}
              color={colors2024['neutral-info']}
            />
          </View>
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
            <Text style={styles.label}>Margin(Isolated)</Text>
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
              <Text style={styles.label}>Auto Close</Text>
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
              <View style={styles.listSubItem}>
                <Text style={styles.listSubItemLabel}>Take-Profit Price</Text>
                <Text style={styles.value}>${tpPrice || 0}</Text>
                {/* <RcArrowRight2CC
                  width={16}
                  height={16}
                  color={colors2024['neutral-body']}
                /> */}
              </View>
              <View style={styles.listSubItem}>
                <Text style={styles.listSubItemLabel}>Stop-Loss Price</Text>
                <Text style={styles.value}>${slPrice || 0}</Text>
                {/* <RcArrowRight2CC
                  width={16}
                  height={16}
                  color={colors2024['neutral-body']}
                /> */}
              </View>
            </View>
          ) : null}
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Direction</Text>
          </View>
          <View>
            <Text style={styles.value}>
              {positionData?.direction} {positionData?.leverage}x
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Entry Price</Text>
          </View>
          <View>
            <Text style={styles.value}>
              ${splitNumberByStep(positionData?.entryPrice || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Liquidation Price</Text>
            <RcIconInfoFillCC
              width={15}
              height={15}
              color={colors2024['neutral-info']}
            />
          </View>
          <View>
            <Text style={styles.value}>
              ${splitNumberByStep(positionData?.liquidationPrice || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.listItem}>
          <View style={styles.listItemMain}>
            <Text style={styles.label}>Founding Payments</Text>
            <RcIconInfoFillCC
              width={15}
              height={15}
              color={colors2024['neutral-info']}
            />
          </View>
          <View>
            <Text style={styles.value}> ${positionData?.fundingPayments}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  section: {
    marginBottom: 30,
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
    backgroundColor: colors2024['neutral-bg-1'],
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
}));
