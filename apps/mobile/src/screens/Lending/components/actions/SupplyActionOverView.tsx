import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { PopupDetailProps } from '../../type';
import { isHFEmpty } from '../../utils';
import WarningFillCC from '@/assets2024/icons/common/WarningFill-cc.svg';
import HealthFactorText from '../HealthFactorText';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTranslation } from 'react-i18next';
import { formatNetworth } from '@/utils/math';
import IsolatedTag from '../IsolatedTag';
import { formatApy } from '../../utils/format';
import { getSupplyCapData } from '../../utils/supply';
import {
  getAssetCollateralType,
  getCollateralState,
} from '../../utils/collateral';

const SupplyActionOverView: React.FC<
  PopupDetailProps & {
    afterHF?: string;
    afterAvailable?: string;
  }
> = ({ reserve, userSummary, afterHF, afterAvailable }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { availableBorrowsUSD = '0', healthFactor = '0' } = userSummary;
  const { t } = useTranslation();

  const apyText = useMemo(() => {
    return formatApy(Number(reserve?.reserve?.supplyAPY || '0'));
  }, [reserve?.reserve?.supplyAPY]);

  const availableText = useMemo(() => {
    return `${formatNetworth(Number(availableBorrowsUSD || '0'))}`;
  }, [availableBorrowsUSD]);

  const [canBeEnabledAsCollateral, collateralState] = useMemo(() => {
    const { supplyCapReached } = getSupplyCapData(reserve);
    const collateralType = getAssetCollateralType(
      reserve,
      userSummary.totalCollateralUSD,
      userSummary.isInIsolationMode,
      supplyCapReached,
    );
    return getCollateralState({ collateralType });
  }, [reserve, userSummary]);

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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('page.Lending.popup.title')}</Text>
      <View style={styles.content}>
        <View style={styles.item}>
          <Text style={styles.title}>
            {t('page.Lending.supplyDetail.availableToBorrow')}
          </Text>
          <View style={styles.availableValueContainer}>
            <Text style={styles.availableValue}>
              {afterAvailable
                ? `${availableText} → ${formatNetworth(
                    Number(afterAvailable || '0'),
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
          <Text style={styles.title}>
            {t('page.Lending.supplyDetail.supplyAPY')}
          </Text>
          <Text style={styles.apy}>{apyText}</Text>
        </View>

        <View style={[styles.item, styles.apyContainer]}>
          <View style={styles.collateralizationContainer}>
            <Text style={styles.title}>
              {t('page.Lending.supplyDetail.collateralization')}
            </Text>
            {reserve?.reserve?.isIsolated && <IsolatedTag />}
          </View>
          <View style={styles.availableValueContainer}>
            <Text
              style={[
                styles.collateralizationValue,
                canBeEnabledAsCollateral ? styles.enabled : styles.unavailable,
              ]}>
              {' • '}
              {collateralState}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.item,
            styles.hfContainer,
            isHFEmpty(Number(healthFactor || '0')) && styles.hidden,
          ]}>
          <Text style={styles.title}>{t('page.Lending.hf')}</Text>
          <Text style={styles.hfValue}>
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
}));
