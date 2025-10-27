import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import {
  formatAmountValueKMB,
  formatPercent,
} from '@/screens/TokenDetail/util';
import { getHealthStatusColor } from '../../utils';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import HealthFactorText from '../HealthFactorText';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

const SupplyActionOverView: React.FC<
  PopupDetailProps & {
    afterHF?: string;
    afterAvailable?: string;
  }
> = ({ reserve, userSummary, afterHF, afterAvailable }) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { availableBorrowsUSD = '0', healthFactor = '0' } = userSummary;

  const apyText = useMemo(() => {
    return formatPercent(Number(reserve?.reserve?.supplyAPY || '0'));
  }, [reserve?.reserve?.supplyAPY]);

  const availableText = useMemo(() => {
    return `$${formatAmountValueKMB(availableBorrowsUSD || '0')}`;
  }, [availableBorrowsUSD]);

  const hfColors = useMemo(() => {
    return getHealthStatusColor(isLight, Number(healthFactor || '0'));
  }, [healthFactor, isLight]);

  const handleSupplyDescription = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: 'Available to borrow',
      titleStyle: {
        marginTop: 12,
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description:
            'This is the maximum amount you can borrow based on all your supplied collateral. Your total borrowing power is calculated by multiplying the market value of each collateral asset by its Max LTV, then summing the results.',
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: 'Got it',
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        containerStyle: {
          position: 'absolute',
          bottom: 48,
          width: '100%',
        },
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Transaction Overview</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>Available to borrow</Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>
              {afterAvailable
                ? `${availableText} → ${formatAmountValueKMB(
                    afterAvailable || '0',
                  )}`
                : availableText}
            </Text>
            <Pressable hitSlop={20} onPress={handleSupplyDescription}>
              <WarningFillCC
                width={12}
                height={12}
                color={colors2024['neutral-info']}
              />
            </Pressable>
          </View>
        </View>

        <View style={[styles.item, styles.apyContainer]}>
          <Text style={styles.title}>Supply APY</Text>
          <Text style={styles.apy}>{apyText}</Text>
        </View>

        <View style={[styles.item, styles.hfContainer]}>
          <Text style={styles.title}>Health factor</Text>
          <Text
            style={[
              styles.hfValue,
              {
                color: hfColors.color,
              },
            ]}>
            {afterHF ? (
              <>
                <HealthFactorText healthFactor={healthFactor} />
                <Text style={styles.arrow}>→</Text>
                <HealthFactorText healthFactor={afterHF} />
              </>
            ) : (
              <HealthFactorText healthFactor={healthFactor} />
            )}
          </Text>
        </View>
        <View style={[styles.item, styles.hfDescContainer]}>
          <Text style={styles.hfDesc}>{'Liquidation at < 1.0'}</Text>
        </View>
      </View>
    </View>
  );
};

export default SupplyActionOverView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: '100%',
    marginTop: 24,
  },
  header: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  content: {
    marginTop: 12,
    paddingVertical: 16,
    paddingTop: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 16,
  },
  item: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  availableValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  apyContainer: {
    marginTop: 26,
  },
  availableValue: {
    textAlign: 'right',
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  apy: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  hfContainer: {
    gap: 6,
    marginTop: 26,
  },
  hfValue: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  hfDesc: {
    color: colors2024['neutral-body'],
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  hfDescContainer: {
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  arrow: {
    fontSize: 17,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
