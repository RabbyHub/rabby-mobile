import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Typography';

export type PerpsWithdrawChainOption = {
  serverChain: string;
  name: string;
};

export const PerpsWithdrawSelectChainPopup: React.FC<{
  visible?: boolean;
  onClose?(): void;
  title?: string;
  options: PerpsWithdrawChainOption[];
  height?: number | string;
  onSelect?(option: PerpsWithdrawChainOption): void;
}> = ({ visible, onClose, options, title, height, onSelect }) => {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });

  const renderItem = useMemoizedFn(
    ({ item }: { item: PerpsWithdrawChainOption }) => (
      <TouchableOpacity
        style={styles.chainListItem}
        onPress={() => {
          onSelect?.(item);
          onClose?.();
        }}>
        <ChainIconImage size={36} chainServerId={item.serverChain} />
        <Text style={styles.chainName}>{item.name}</Text>
      </TouchableOpacity>
    ),
  );

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={onClose}
      snapPoints={[height || 280]}>
      <AutoLockView style={styles.container}>
        <Text style={styles.title}>{title || 'Select Chain'}</Text>
        <BottomSheetFlatList
          keyboardShouldPersistTaps="handled"
          data={options}
          style={styles.flatList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          keyExtractor={item => item.serverChain}
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => ({
  container: {
    width: '100%',
    paddingBottom: 40,
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    marginBottom: 12,
    textAlign: 'center',
  },
  flatList: {
    paddingHorizontal: 16,
  },
  chainListItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: '100%',
    height: 64,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 16,
    gap: 8,
  },
  chainName: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  divider: {
    height: 8,
  },
}));
