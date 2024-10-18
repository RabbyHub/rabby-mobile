import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import GasLevelCustomSVG from '@/assets/icons/sign/gas-level-custom.svg';
import GasLevelFastSVG from '@/assets/icons/sign/gas-level-fast.svg';
import GasLevelNormalSVG from '@/assets/icons/sign/gas-level-normal.svg';
import GasLevelInstantSVG from '@/assets/icons/sign/gas-level-instant.svg';
import ArrowSVG from '@/assets/icons/sign/arrow-cc.svg';
import {
  StyleSheet,
  View,
  Text,
  Touchable,
  TouchableOpacity,
  Platform,
} from 'react-native';
import {
  useGetBinaryMode,
  useThemeColors,
  useThemeStyles,
} from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { AppColorsVariants } from '@/constant/theme';
import { getGasLevelI18nKey } from '@/utils/trans';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { Skeleton } from '@rneui/themed';
import { MenuView, MenuAction } from '@react-native-menu/menu';
import React from 'react';

interface Props {
  gasList: GasLevel[];
  selectedGas: GasLevel | null;
  onSelect: (gas: GasLevel) => void;
  onCustom: () => void;
  showCustomGasPrice: boolean;
  disabled?: boolean;
}

const GasLevelIcon: React.FC<{ level: string; isActive }> = ({
  level,
  isActive,
}) => {
  const colors = useThemeColors();
  const GasLevelSVG =
    level === 'slow'
      ? GasLevelNormalSVG
      : level === 'normal'
      ? GasLevelFastSVG
      : level === 'fast'
      ? GasLevelInstantSVG
      : GasLevelCustomSVG;
  return (
    <div>
      <GasLevelSVG
        color={isActive ? colors['blue-default'] : colors['neutral-body']}
        width={20}
      />
    </div>
  );
};

export const GasMenuButton: React.FC<Props> = ({
  gasList,
  selectedGas,
  onSelect,
  onCustom,
  showCustomGasPrice,
  disabled,
}) => {
  const { styles } = useThemeStyles(getStyle);
  const { t } = useTranslation();
  const colors = useThemeColors();
  const actions = React.useMemo(() => {
    const list = gasList.map(gas => {
      const gwei = new BigNumber(gas.price / 1e9).toFixed().slice(0, 8);
      return {
        id: gas.level,
        title: t(getGasLevelI18nKey(gas.level)),
        titleColor: colors['neutral-body'],
        imageColor: colors['neutral-body'],
        subtitle:
          gas.level !== 'custom' || showCustomGasPrice
            ? `${gwei} Gwei`
            : undefined,
        state: gas.level === selectedGas?.level ? 'on' : 'off',
      } as MenuAction;
    });

    if (Platform.OS === 'android') {
      return list.reverse();
    }

    return list;
  }, [colors, gasList, selectedGas?.level, showCustomGasPrice, t]);
  const onPressAction = React.useCallback(
    ({ nativeEvent: { event } }) => {
      const id = event;
      const gas = gasList.find(g => g.level === id);
      if (gas) {
        onSelect(gas);
        if (gas.level === 'custom') {
          onCustom();
        }
      }
    },
    [gasList, onCustom, onSelect],
  );
  const customGasInfo = gasList.find(g => g.level === 'custom')!;

  const mode = useGetBinaryMode();

  const Content = selectedGas ? (
    <TouchableOpacity style={styles.menuButton} disabled={disabled}>
      <Text style={styles.levelText}>
        {t(getGasLevelI18nKey(selectedGas.level ?? 'slow'))}
      </Text>
      {/* {(selectedGas.level !== 'custom' || showCustomGasPrice) && (
        <>
          <View style={styles.dot} />

          <Text style={styles.gwei}>
            {new BigNumber(
              (selectedGas.level === 'custom'
                ? customGasInfo.price
                : selectedGas.price) / 1e9,
            )
              .toFixed()
              .slice(0, 8)}
          </Text>
        </>
      )} */}
      <ArrowSVG
        color={colors['neutral-foot']}
        style={StyleSheet.flatten({ marginLeft: 2 })}
      />
    </TouchableOpacity>
  ) : (
    <Skeleton width={100} height={20} />
  );
  if (disabled) {
    return Content;
  }
  return (
    <MenuView
      title={t('page.sign.transactionSpeed')}
      actions={actions}
      shouldOpenOnLongPress={false}
      themeVariant={mode ?? 'light'}
      onPressAction={onPressAction}>
      {Content}
    </MenuView>
  );
};

const getStyle = createGetStyles((colors: AppColorsVariants) => ({
  menuButton: {
    alignItems: 'center',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: colors['neutral-line'],
    borderStyle: 'solid',
    flexDirection: 'row',
  },
  gwei: {
    color: colors['neutral-foot'],
    alignItems: 'center',
    fontSize: 14,
    lineHeight: 16,
  },
  levelText: {
    color: colors['neutral-body'],
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors['neutral-foot'],
    marginHorizontal: 4,
  },
}));
