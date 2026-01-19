import React, { forwardRef, useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/src/types';
import { useTranslation } from 'react-i18next';

import { AppBottomSheetModal, AppBottomSheetModalTitle } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { ModalLayouts } from '@/constant/layout';
import { Button } from '@/components2024/Button';
import { useSafeSizes } from '@/hooks/useAppLayout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';

type ChainItem = {
  chainEnum: CHAINS_ENUM | string;
  name: string;
};

type SupportedChainsSheetProps = {
  chains: Array<CHAINS_ENUM | string>;
  title?: string;
  onClose?: () => void;
};

const FOOTER_HEIGHT = 56;

export const EIP7702SupportedChainsSheet = forwardRef<
  BottomSheetModalMethods,
  SupportedChainsSheetProps
>(({ chains, title = 'Supported Chains', onClose }, ref) => {
  const { t } = useTranslation();
  const { safeOffBottom } = useSafeSizes();
  const { styles, colors2024 } = useTheme2024({ getStyle });

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
      return (
        <View style={styles.chainItem}>
          <ChainIconImage
            chainEnum={item.chainEnum}
            size={46}
            containerStyle={styles.chainIcon}
          />
          <Text style={styles.chainName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      );
    },
    [styles],
  );

  return (
    <AppBottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      onDismiss={onClose}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: 'bg1',
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
        <View
          style={[
            styles.footerContainer,
            { paddingBottom: safeOffBottom + 12 },
          ]}>
          <Button
            title={t('global.GotIt')}
            onPress={handleClose}
            buttonStyle={styles.footerButton}
            titleStyle={styles.footerButtonText}
          />
        </View>
      </View>
    </AppBottomSheetModal>
  );
});

EIP7702SupportedChainsSheet.displayName = 'EIP7702SupportedChainsSheet';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
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
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
