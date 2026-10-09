import React from 'react';
import type { ColorValue } from 'react-native';
import { Pressable, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BSheetModal } from '@/components/BottomSheetModal';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export type TokenMoreAction = {
  key: string;
  title: string;
  Icon?: React.ComponentType<SvgProps>;
  iconColor?: ColorValue;
  onPress: () => void;
  disabled?: boolean;
};

export function TokenMoreSheet({
  modalRef,
  items,
  onDisabledAction,
}: {
  modalRef: React.RefObject<BottomSheetModal | null>;
  items: TokenMoreAction[];
  onDisabledAction?: () => void;
}) {
  const { styles } = useTheme2024({ getStyle });

  return (
    <BSheetModal
      ref={modalRef}
      backgroundStyle={styles.sheetModal}
      handleStyle={styles.sheetModal}
      snapPoints={[80 + 70 * items.length]}>
      <AutoLockView as="BottomSheetView" style={styles.list}>
        {items.map(item => (
          <Pressable
            key={item.key}
            style={[styles.item, item.disabled && styles.disabledAction]}
            onPress={
              item.disabled
                ? onDisabledAction
                : () => {
                    modalRef.current?.dismiss();
                    item.onPress();
                  }
            }>
            <View style={styles.itemLeft}>
              {item.Icon && (
                <item.Icon width={40} height={40} color={item.iconColor} />
              )}
              <Text style={[styles.itemText, item.Icon && styles.iconText]}>
                {item.title}
              </Text>
            </View>
          </Pressable>
        ))}
      </AutoLockView>
    </BSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  sheetModal: { backgroundColor: colors2024['neutral-bg-1'] },
  list: { gap: 40, paddingTop: 16, paddingHorizontal: 20 },
  item: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 1,
    width: '100%',
  },
  itemText: {
    color: colors2024['neutral-title-1'],
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  iconText: { marginLeft: 16 },
  disabledAction: { opacity: 0.6 },
}));
