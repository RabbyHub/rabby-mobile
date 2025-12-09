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
import { useLendingSummary } from '../../hooks';
import { formatPercent } from '@/screens/TokenDetail/util';
import TokenIcon from '../TokenIcon';
import RcIconCorrectCC from '@/assets2024/icons/common/checked-cc.svg';
import RcIconIncorrectCC from '@/assets2024/icons/common/close-bold-cc.svg';
import { CategorySelector } from '../EmodeCategory/CategorySelector';

const PairTable = ({
  data,
}: {
  data: {
    underlyingAsset: string;
    symbol: string;
    iconSymbol: string;
    collateral: boolean;
    borrowable: boolean;
  }[];
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  if (!data?.length) {
    return null;
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.headerCell, styles.leftCell]}>
          {t('page.Lending.manageEmode.overview.row.asset')}
        </Text>
        <Text style={[styles.tableCell, styles.headerCell]}>
          {t('page.Lending.manageEmode.overview.row.collateral')}
        </Text>
        <Text style={[styles.tableCell, styles.headerCell]}>
          {t('page.Lending.manageEmode.overview.row.borrowable')}
        </Text>
      </View>
      <View style={styles.tableBody}>
        {data?.map(item => (
          <View style={styles.tableRow} key={item.underlyingAsset}>
            <View style={styles.tableCell}>
              <View style={styles.assetAvatarContainer}>
                <TokenIcon
                  size={24}
                  tokenSymbol={item.iconSymbol}
                  chainSize={0}
                />
                <Text
                  style={styles.symbol}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {item.symbol}
                </Text>
              </View>
            </View>
            <View style={[styles.tableCell, styles.iconContainer]}>
              {item.collateral ? (
                <RcIconCorrectCC
                  color={colors2024['green-default']}
                  width={16}
                  height={16}
                />
              ) : (
                <RcIconIncorrectCC
                  color={colors2024['red-default']}
                  width={16}
                  height={16}
                />
              )}
            </View>
            <View style={[styles.tableCell, styles.iconContainer]}>
              {item.borrowable ? (
                <RcIconCorrectCC
                  color={colors2024['green-default']}
                  width={16}
                  height={16}
                />
              ) : (
                <RcIconIncorrectCC
                  color={colors2024['red-default']}
                  width={16}
                  height={16}
                />
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const ManageEmodeOverView: React.FC<{
  selectedCategoryId?: number;
  disabled?: boolean;
  onSelectCategory?: (categoryId: number) => void;
}> = ({ selectedCategoryId, onSelectCategory, disabled: disableEmode }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { eModes } = useMode();

  const {
    userReserves,
    reserves,
    formattedPoolReservesAndIncentives,
    iUserSummary,
  } = useLendingSummary();

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

  // Shown only if the user has a collateral asset which is changing in LTV
  const showLTVChange = useMemo(() => {
    return (
      iUserSummary?.currentLoanToValue !== '0' &&
      Number(newSummary.currentLoanToValue).toFixed(3) !==
        Number(iUserSummary?.currentLoanToValue).toFixed(3)
    ); // Comparing without rounding causes stuttering, LTVs update asyncronously
  }, [iUserSummary?.currentLoanToValue, newSummary.currentLoanToValue]);

  const afterHealthFactor = useMemo(() => {
    return newSummary?.healthFactor || '';
  }, [newSummary?.healthFactor]);

  const ltvLineContent = useMemo(() => {
    if (disableEmode || !selectedCategoryId) {
      return showLTVChange
        ? `${formatPercent(
            Number(iUserSummary?.currentLoanToValue || '0'),
          )} → ${formatPercent(Number(newSummary.currentLoanToValue || '0'))}`
        : formatPercent(Number(newSummary.currentLoanToValue));
    }
    const targetMode = eModes[selectedCategoryId];
    return showLTVChange
      ? `${formatPercent(
          Number(iUserSummary?.currentLoanToValue || '0'),
        )} → ${formatPercent(Number(newSummary.currentLoanToValue || '0'))}`
      : formatPercent(Number(targetMode.ltv) / 10000);
  }, [
    disableEmode,
    selectedCategoryId,
    eModes,
    showLTVChange,
    iUserSummary?.currentLoanToValue,
    newSummary.currentLoanToValue,
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={[styles.item, styles.categoryContainer]}>
          <Text style={styles.title}>
            {t('page.Lending.manageEmode.overview.title')}
          </Text>
          <View style={styles.availableValueContainer}>
            <CategorySelector
              label={
                selectedCategoryId ? eModes[selectedCategoryId]?.label : ''
              }
              onChange={categoryId => onSelectCategory?.(categoryId)}
              value={selectedCategoryId}
            />
          </View>
        </View>

        <View style={[styles.item, styles.apyContainer]}>
          <View style={styles.maxLtvContainer}>
            <Text style={styles.title}>
              {t('page.Lending.manageEmode.overview.maxLtv')}
            </Text>
            <Pressable hitSlop={20} onPress={handleSupplyDescription}>
              <WarningFillCC
                width={12}
                height={12}
                color={colors2024['neutral-info']}
              />
            </Pressable>
          </View>
          <Text style={styles.ltv}>{ltvLineContent}</Text>
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
        <PairTable
          data={
            selectedCategoryId ? eModes[selectedCategoryId]?.assets || [] : []
          }
        />
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
  categoryContainer: {
    flexDirection: 'column',
    gap: 12,
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
  ltv: {
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
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 12,
    borderRadius: 6,
    paddingVertical: 8,
  },
  tableBody: {
    marginTop: 12,
    gap: 24,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
  },
  assetAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  leftCell: {
    textAlign: 'left',
  },
  headerCell: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  symbol: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    maxWidth: 100,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
