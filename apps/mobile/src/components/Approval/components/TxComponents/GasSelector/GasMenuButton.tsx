import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import GasLevelCustomSVG from '@/assets/icons/sign/gas-level-custom.svg';
import GasLevelFastSVG from '@/assets/icons/sign/gas-level-fast.svg';
import GasLevelNormalSVG from '@/assets/icons/sign/gas-level-normal.svg';
import GasLevelInstantSVG from '@/assets/icons/sign/gas-level-instant.svg';
import ArrowSVG from '@/assets/icons/sign/arrow-cc.svg';
import { StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import {
  useGetBinaryMode,
  useTheme2024,
  useThemeColors,
  useThemeStyles,
} from '@/hooks/theme';
import { createGetStyles, createGetStyles2024 } from '@/utils/styles';
import { AppColorsVariants } from '@/constant/theme';
import { getGasLevelI18nKey } from '@/utils/trans';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';
import { Skeleton } from '@rneui/themed';
import React from 'react';
import * as DropdownMenu from 'zeego/src/dropdown-menu';

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
  const { styles, colors } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
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
      };
    });

    if (Platform.OS === 'ios') {
      return list.reverse();
    }

    return list;
  }, [colors, gasList, selectedGas?.level, showCustomGasPrice, t]);
  const onPressAction = React.useCallback(
    ({ state, id }) => {
      if (state !== 'on') {
        return;
      }
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger action="press">{Content}</DropdownMenu.Trigger>
      <DropdownMenu.Content
        loop
        alignOffset={5}
        avoidCollisions
        // @ts-expect-error TODO: fix it
        side
        // @ts-expect-error TODO: fix it
        align
        collisionPadding={0}
        sideOffset={0}>
        <DropdownMenu.Label>
          {t('page.sign.transactionSpeed')}
        </DropdownMenu.Label>
        {actions.map(action => (
          <DropdownMenu.CheckboxItem
            onValueChange={state => onPressAction({ state, id: action.id })}
            value={action.state as any}
            key={action.id}>
            <DropdownMenu.ItemTitle
              style={{
                color: action.titleColor,
              }}>
              {action.title}
            </DropdownMenu.ItemTitle>
            {action.subtitle ? (
              <DropdownMenu.ItemSubtitle>
                {action.subtitle}
              </DropdownMenu.ItemSubtitle>
            ) : null}
          </DropdownMenu.CheckboxItem>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  menuButton: {
    alignItems: 'center',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: colors['neutral-line'],
    borderStyle: 'solid',
    flexDirection: 'row',
    minHeight: 26,
  },
  gwei: {
    color: colors['neutral-foot'],
    alignItems: 'center',
    fontSize: 14,
    lineHeight: 16,
  },
  levelText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
    color: colors['neutral-body'],
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors['neutral-foot'],
    marginHorizontal: 4,
  },
}));
