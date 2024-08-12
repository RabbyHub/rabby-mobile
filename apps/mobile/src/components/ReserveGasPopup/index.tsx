import React, {
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import BigNumber from 'bignumber.js';

import { CHAINS_ENUM } from '@debank/common';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { formatTokenAmount } from '@/utils/number';
import { findChain } from '@/utils/chain';
import { RcIconCheckedFilledCC, RcIconUncheckCC } from '@/assets/icons/common';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { AppBottomSheetModal } from '../customized/BottomSheet';
import { useSheetModal } from '@/hooks/useSheetModal';
import AutoLockView from '../AutoLockView';
import { Button } from '../Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type GasLevelType = keyof typeof SORT_SCORE;

interface ReserveGasContentProps {
  chain: CHAINS_ENUM;
  gasList?: GasLevel[];
  limit: number;
  selectedItem?: GasLevelType | string;
  onGasChange: (gasLevel: GasLevel) => void;
  rawHexBalance?: string | number;
}

const SORT_SCORE = {
  fast: 1,
  normal: 2,
  slow: 3,
  custom: 4,
};

export type ReserveGasType = {
  getSelectedGasLevel: () => GasLevel | null;
};

export const ReserveGasContent = forwardRef<
  ReserveGasType,
  ReserveGasContentProps
>((props, ref) => {
  const {
    gasList,
    chain,
    limit = 1000000,
    selectedItem = 'normal',
    onGasChange,
    rawHexBalance,
  } = props;
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { bottom } = useSafeAreaInsets();
  const [currentSelectedItem, setCurrentSelectedItem] = useState(selectedItem);
  const [gasLevel, setGasLevel] = useState<GasLevel>();

  useImperativeHandle(ref, () => ({
    getSelectedGasLevel: () => gasLevel ?? null,
  }));

  const { t } = useTranslation();
  const nameMapping = useMemo(
    () => ({
      slow: t('component.ReserveGasPopup.normal'),
      normal: t('component.ReserveGasPopup.fast'),
      fast: t('component.ReserveGasPopup.instant'),
    }),
    [t],
  );

  const { decimals, symbol } = useMemo(
    () => ({
      decimals: findChain({ enum: chain })?.nativeTokenDecimals || 1e18,
      symbol: findChain({ enum: chain })?.nativeTokenSymbol || '',
    }),
    [chain],
  );

  const sortedList = useMemo(
    () =>
      gasList?.sort((a, b) => {
        const v1 = SORT_SCORE[a.level];
        const v2 = SORT_SCORE[b.level];
        return v1 - v2;
      }),
    [gasList],
  );

  const getAmount = useCallback(
    (price: number) =>
      formatTokenAmount(
        new BigNumber(limit)
          .times(price)
          .div(10 ** decimals)
          .toString(),
        6,
      ),
    [limit, decimals],
  );

  const checkIsInsufficient = useCallback(
    (price: number) => {
      if (rawHexBalance === undefined || rawHexBalance === null) {
        return false;
      }
      return new BigNumber(rawHexBalance || 0, 16).lt(
        new BigNumber(limit).times(price),
      );
    },
    [rawHexBalance, limit],
  );

  return (
    <View style={styles.flex1}>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={styles.title}>{t('component.ReserveGasPopup.title')}</Text>

        {sortedList?.map(item => {
          const checked = currentSelectedItem === item.level;
          const gasIsSufficient = checkIsInsufficient(item.price);

          const onChecked = () => {
            if (gasIsSufficient) {
              return;
            }
            setGasLevel(item);
            setCurrentSelectedItem(item.level as any);
          };

          if (checked && gasLevel?.level !== currentSelectedItem) {
            setGasLevel(item);
          }

          const isCustom = item.level === 'custom';

          const CheckIcon = checked ? RcIconCheckedFilledCC : RcIconUncheckCC;

          return (
            <TouchableOpacity
              key={item.level}
              style={StyleSheet.flatten([
                styles.item,
                checked ? styles.itemChecked : {},
                gasIsSufficient && styles.itemDisabled,
              ])}
              onPress={onChecked}
              disabled={gasIsSufficient}>
              <View style={styles.itemContent}>
                <Text style={styles.itemText}>
                  {isCustom
                    ? t('component.ReserveGasPopup.doNotReserve')
                    : nameMapping[item.level]}
                </Text>
                {!isCustom && (
                  <>
                    <Text style={styles.separator}>·</Text>
                    <Text style={styles.itemSubText}>
                      {new BigNumber(item.price / 1e9).toFixed().slice(0, 8)}{' '}
                      Gwei
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.itemRightContent}>
                {!isCustom && (
                  <Text style={styles.itemAmount}>
                    ≈ {getAmount(item.price)} {symbol}
                  </Text>
                )}
                <CheckIcon
                  width={20}
                  height={20}
                  color={
                    checked ? colors['blue-default'] : colors['neutral-body']
                  }
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Button
        title={t('global.Confirm')}
        type="primary"
        containerStyle={[
          styles.button,
          {
            paddingBottom: 20 + bottom,
          },
        ]}
        onPress={() => {
          if (gasLevel) {
            onGasChange(gasLevel);
          }
        }}
      />
    </View>
  );
});

const ReserveGasPopup = (
  props: ReserveGasContentProps & { visible: boolean; onClose?: () => void },
) => {
  const {
    gasList,
    chain,
    onGasChange,
    limit,
    selectedItem,
    rawHexBalance,
    visible,
    onClose,
  } = props;
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const { bottom } = useSafeAreaInsets();
  const snapPoints = useMemo(() => [500 + bottom], [bottom]);

  const { sheetModalRef } = useSheetModal();

  useEffect(() => {
    if (visible) {
      sheetModalRef.current?.present();
    } else {
      sheetModalRef.current?.dismiss();
    }
  }, [visible, sheetModalRef]);

  return (
    <AppBottomSheetModal
      ref={sheetModalRef}
      snapPoints={snapPoints}
      enableDismissOnClose
      onDismiss={onClose}
      handleStyle={styles.sheetBg}
      backgroundStyle={styles.sheetBg}>
      <AutoLockView style={styles.flex1}>
        {gasList && (
          <ReserveGasContent
            gasList={gasList}
            chain={chain}
            limit={limit}
            selectedItem={selectedItem}
            onGasChange={onGasChange}
            rawHexBalance={rawHexBalance}
          />
        )}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  sheetBg: {
    backgroundColor: colors['neutral-bg-2'],
  },
  flex1: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    color: colors['neutral-title-1'],
    fontSize: 20,
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 16,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors['neutral-card-1'],
    borderWidth: 1,
    borderColor: 'transparent',
    borderStyle: 'solid',
    marginBottom: 12,
  },
  itemChecked: {
    borderColor: colors['blue-default'],
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemText: {
    fontSize: 16,
    color: colors['neutral-title1'],
    fontWeight: '500',
  },
  separator: {
    fontSize: 15,
    color: colors['neutral-foot'],
  },
  itemSubText: {
    fontSize: 15,
    color: colors['neutral-foot'],
  },
  itemRightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  itemAmount: {
    fontSize: 16,
    color: colors['neutral-title1'],
    fontWeight: '500',
  },
  checkboxIconChecked: {
    color: colors['blue-default'],
    width: '100%',
    height: '100%',
  },
  checkboxIconUnchecked: {
    color: colors['neutral-body'],
    width: '100%',
    height: '100%',
  },
  button: {
    paddingHorizontal: 16,
    marginTop: 'auto',
    paddingVertical: 20,
    paddingBottom: 20,
    borderTopColor: colors['neutral-line'],
    borderTopWidth: 0.5,
  },
}));

export { ReserveGasPopup };
