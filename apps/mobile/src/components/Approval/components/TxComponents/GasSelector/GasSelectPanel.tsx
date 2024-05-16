import BigNumber from 'bignumber.js';
import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chain } from '@/constant/chains';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { formatTokenAmount } from '@/utils/number';
import { Tip } from '@/components/Tip';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextInputChangeEventData,
  View,
} from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { GasSelectContainer } from './GasSelectContainer';

export interface GasSelectorResponse extends GasLevel {
  gasLimit: number;
  nonce: number;
  maxPriorityFee: number;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    gasPriceDesc: {
      marginTop: 12,
      marginBottom: 0,
    },
    GasPriceDescText: {
      fontSize: 13,
      color: colors['neutral-body'],
      paddingLeft: 12,
      marginBottom: 8,
    },
    GasPriceDescTextLast: {
      marginBottom: 0,
    },
    GasPriceDescDot: {
      position: 'absolute',
      width: 4,
      height: 4,
      borderRadius: 100,
      backgroundColor: colors['neutral-body'],
      left: 0,
      top: 6,
    },
  });

export const GasSelectPanel = ({
  gasList,
  selectedGas,
  panelSelection,
  customGas,
  customGasConfirm = () => null,
  handleCustomGasChange,
  disabled,
  chain,
  nativeTokenBalance,
  gasPriceMedian,
}: {
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  panelSelection: (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
    item: GasLevel,
  ) => void;
  customGas: string | number;
  customGasConfirm?: () => null | undefined;
  handleCustomGasChange: (
    e: NativeSyntheticEvent<TextInputChangeEventData>,
  ) => void;
  disabled?: boolean;
  chain: Chain;
  nativeTokenBalance: string;
  gasPriceMedian: number | null;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <Tip
      content={
        disabled ? t('page.signTx.gasNotRequireForSafeTransaction') : undefined
      }>
      <GasSelectContainer
        gasList={gasList}
        selectedGas={selectedGas}
        panelSelection={panelSelection}
        customGas={customGas}
        customGasConfirm={customGasConfirm}
        handleCustomGasChange={handleCustomGasChange}
        disabled={disabled}
      />
      <View style={styles.gasPriceDesc}>
        <View>
          <View style={styles.GasPriceDescDot} />
          <Text style={StyleSheet.flatten([styles.GasPriceDescText])}>
            {t('page.signTx.myNativeTokenBalance', {
              symbol: chain.nativeTokenSymbol,
              amount: formatTokenAmount(
                new BigNumber(nativeTokenBalance).div(1e18).toFixed(),
                4,
                true,
              ),
            })}
          </Text>
        </View>
        {gasPriceMedian !== null && (
          <View>
            <View style={styles.GasPriceDescDot} />
            <Text
              style={StyleSheet.flatten([
                styles.GasPriceDescText,
                styles.GasPriceDescTextLast,
              ])}>
              {t('page.signTx.gasPriceMedian')}
              {new BigNumber(gasPriceMedian).div(1e9).toFixed()} Gwei
            </Text>
          </View>
        )}
      </View>
    </Tip>
  );
};
