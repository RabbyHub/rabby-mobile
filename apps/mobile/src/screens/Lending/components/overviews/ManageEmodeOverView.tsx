import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { isHFEmpty } from '../../utils';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import HealthFactorText from '../HealthFactorText';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTranslation } from 'react-i18next';
import { formatUserSummary } from '@aave/math-utils';
import dayjs from 'dayjs';
import { useMode } from '../../hooks/useMode';
import { useLendingSummary, useSelectedMarket } from '../../hooks';

const PairTable = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text>Asset</Text>
        <Text>Collateral</Text>
        <Text>Borrowable</Text>
      </View>
      <View>
        {['111', '222', '333'].map(item => (
          <View style={styles.tableRow} key={item}>
            <Text>{item}</Text>
            <Text>{item}</Text>
            <Text>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const ManageEmodeOverView: React.FC<{
  selectedCategoryId?: number;
  onSelectCategory?: (categoryId: number) => void;
}> = ({ selectedCategoryId, onSelectCategory }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { emodeEnabled, emodeCategoryId } = useMode();

  const {
    userReserves,
    reserves,
    formattedPoolReservesAndIncentives,
    iUserSummary,
  } = useLendingSummary();
  const disableEmode = useMemo(() => {
    return emodeEnabled && emodeCategoryId === selectedCategoryId;
  }, [emodeCategoryId, emodeEnabled, selectedCategoryId]);

  const handleSupplyDescription = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.Lending.modalDesc.availableToBorrow'),
      titleStyle: {
        marginTop: 12,
        fontWeight: '900',
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description: t('page.Lending.modalDesc.maxAmount'),
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: t('page.Lending.gotIt'),
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
  const healthFactor = useMemo(() => {
    return iUserSummary?.healthFactor || '';
  }, [iUserSummary?.healthFactor]);

  const newSummary = useMemo(() => {
    return formatUserSummary({
      currentTimestamp: dayjs().unix(),
      userReserves: userReserves?.userReserves || [],
      formattedReserves: formattedPoolReservesAndIncentives || [],
      userEmodeCategoryId: disableEmode ? 0 : selectedCategoryId || 0,
      marketReferenceCurrencyDecimals:
        reserves?.baseCurrencyData?.marketReferenceCurrencyDecimals || 0,
      marketReferencePriceInUsd:
        reserves?.baseCurrencyData?.marketReferenceCurrencyPriceInUsd || 0,
    });
  }, [
    disableEmode,
    formattedPoolReservesAndIncentives,
    reserves?.baseCurrencyData?.marketReferenceCurrencyDecimals,
    reserves?.baseCurrencyData?.marketReferenceCurrencyPriceInUsd,
    selectedCategoryId,
    userReserves?.userReserves,
  ]);

  const afterHealthFactor = useMemo(() => {
    return newSummary?.healthFactor || '';
  }, [newSummary?.healthFactor]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>Asset category</Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>{selectedCategoryId}</Text>
          </View>
        </View>

        <View style={[styles.item, styles.apyContainer]}>
          <View style={styles.maxLtvContainer}>
            <Text style={styles.title}>Max LTV</Text>
            <Pressable hitSlop={20} onPress={handleSupplyDescription}>
              <WarningFillCC
                width={12}
                height={12}
                color={colors2024['neutral-info']}
              />
            </Pressable>
          </View>
          <Text style={styles.apy}>{newSummary.currentLoanToValue}</Text>
        </View>

        <View
          style={[
            styles.item,
            styles.hfContainer,
            isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
          ]}>
          <Text style={styles.title}>{t('page.Lending.hf')}</Text>
          <Text style={styles.hfValue}>
            {afterHealthFactor ? (
              <>
                <HealthFactorText healthFactor={healthFactor} />
                <Text style={styles.arrow}>→</Text>
                <HealthFactorText healthFactor={afterHealthFactor} />
              </>
            ) : (
              <HealthFactorText healthFactor={healthFactor} />
            )}
          </Text>
        </View>
        <View
          style={[
            styles.item,
            styles.hfDescContainer,
            isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
          ]}>
          <Text style={styles.hfDesc}>
            {t('page.Lending.popup.liquidationAt')}
          </Text>
        </View>
        <PairTable />
      </View>
    </View>
  );
};

export default ManageEmodeOverView;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    width: '100%',
    marginTop: 24,
  },
  header: {
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
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
  maxLtvContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    lineHeight: 18,
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
  collateralizationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableValue: {
    textAlign: 'right',
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  collateralizationValue: {
    textAlign: 'right',
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  enabled: {
    color: colors2024['green-default'],
  },
  unavailable: {
    color: colors2024['red-default'],
  },
  apy: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  hfContainer: {
    gap: 6,
    marginTop: 26,
  },
  hidden: {
    display: 'none',
  },
  hfValue: {
    fontSize: 17,
    lineHeight: 22,
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
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
  hfDescContainer: {
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  arrow: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  table: {
    marginTop: 26,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
  },
}));
