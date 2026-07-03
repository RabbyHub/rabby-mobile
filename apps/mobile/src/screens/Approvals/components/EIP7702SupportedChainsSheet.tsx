import React, { type Ref, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { BottomSheetFlatList, TouchableOpacity } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';

import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ModalLayouts } from '@/constant/layout';
import { useSafeSizes } from '@/hooks/useAppLayout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';
import { Text } from '@/components/Typography';
import { RcIconCheckedCC } from '../icons';

type ChainItem = {
  chainEnum: CHAINS_ENUM | string;
  name: string;
};

type SupportedChainsSheetProps = {
  chains: Array<CHAINS_ENUM | string>;
  selectedChain?: CHAINS_ENUM | string | null;
  title?: string;
  onSelect?: (chain: CHAINS_ENUM | string | null) => void;
  onClose?: () => void;
  ref?: Ref<BottomSheetModalMethods>;
};

const FOOTER_HEIGHT = 56;

export const EIP7702SupportedChainsSheet = ({
  chains,
  selectedChain,
  title = 'Supported Chains',
  onSelect,
  onClose,
  ref,
}: SupportedChainsSheetProps) => {
  const { safeOffBottom } = useSafeSizes();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => [ModalLayouts.defaultHeightPercentText], []);

  const chainItems = useMemo<ChainItem[]>(() => {
    const unique = Array.from(
      new Set(chains.filter(Boolean).map(chainEnum => chainEnum.toString())),
    );

    return unique.map(chainEnum => {
      const chainInfo = findChainByEnum(chainEnum);
      return {
        chainEnum: chainInfo?.enum || chainEnum,
        name: chainInfo?.name || chainEnum,
      };
    });
  }, [chains]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: ChainItem }) => {
      const isSelected =
        !!selectedChain &&
        selectedChain.toString() === item.chainEnum.toString();

      return (
        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.chainItem, isSelected && styles.chainItemSelected]}
          onPress={() => {
            onSelect?.(isSelected ? null : item.chainEnum);
          }}>
          <ChainIconImage
            chainEnum={item.chainEnum}
            size={46}
            containerStyle={styles.chainIcon}
          />
          <Text style={styles.chainName} numberOfLines={1}>
            {item.name}
          </Text>
          {isSelected ? (
            <RcIconCheckedCC
              width={20}
              height={20}
              color={colors2024['brand-default']}
            />
          ) : null}
        </TouchableOpacity>
      );
    },
    [colors2024, onSelect, selectedChain, styles],
  );

  return (
    <AppBottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}>
      <AppBottomSheetModalTitle title={title} style={styles.sheetTitle} />
      <View style={styles.sheetBody}>
        <BottomSheetFlatList
          data={chainItems}
          keyExtractor={item => item.chainEnum.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContainer,
            {
              paddingBottom: FOOTER_HEIGHT + safeOffBottom + 24,
            },
          ]}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      </View>
    </AppBottomSheetModal>
  );
};

EIP7702SupportedChainsSheet.displayName = 'EIP7702SupportedChainsSheet';

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  sheetTitle: {
    paddingTop: 12,
    marginBottom: 16,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  sheetBody: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flexGrow: 1,
  },
  itemSeparator: {
    height: 12,
  },
  chainItem: {
    height: 78,
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chainItemSelected: {
    backgroundColor: colors2024['brand-light-1'],
  },
  chainIcon: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  chainName: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  footerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
  },
  footerButton: {
    height: 52,
    borderRadius: 16,
  },
  footerButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
}));
