import React from 'react';
import type { ColorValue } from 'react-native';
import { Platform, Pressable, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BSheetModal } from '@/components/BottomSheetModal';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import {
  BOTTOM_BUTTON_BOTTOM_OFFSET,
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export type TokenMoreAction = {
  key: string;
  title: string;
  Icon?: React.ComponentType<SvgProps>;
  iconColor?: ColorValue;
  onPress: () => void;
  disabled?: boolean;
  buttonType?: 'primary' | 'ghost';
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
  const hasButtons = items.some(item => item.buttonType);
  const sheetHeight = hasButtons
    ? 20 +
      styles.list.paddingTop +
      BOTTOM_BUTTON_DOUBLE_HEIGHT * items.length +
      BOTTOM_BUTTON_GAP * (items.length - 1) +
      BOTTOM_BUTTON_BOTTOM_OFFSET
    : 80 + 70 * items.length;

  return (
    <BSheetModal
      ref={modalRef}
      backgroundStyle={styles.sheetModal}
      handleStyle={styles.sheetModal}
      snapPoints={[sheetHeight]}>
      <AutoLockView
        as="BottomSheetView"
        style={[styles.list, hasButtons && styles.buttonList]}>
        {items.map(item => {
          const onPress = item.disabled
            ? onDisabledAction
            : () => {
                modalRef.current?.dismiss();
                item.onPress();
              };

          if (item.buttonType) {
            return (
              <Button
                key={item.key}
                type={item.buttonType}
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                title={({ titleStyle }) => (
                  <Text style={titleStyle}>{item.title}</Text>
                )}
                accessibilityLabel={item.title}
                titleStyle={styles.buttonTitle}
                buttonStyle={[
                  styles.button,
                  item.buttonType === 'ghost'
                    ? styles.ghostButton
                    : styles.primaryButton,
                ]}
                containerStyle={item.disabled && styles.disabledAction}
                noShadow
                onPress={onPress}
              />
            );
          }

          return (
            <Pressable
              key={item.key}
              style={[styles.item, item.disabled && styles.disabledAction]}
              onPress={onPress}>
              <View style={styles.itemLeft}>
                {item.Icon && (
                  <item.Icon width={40} height={40} color={item.iconColor} />
                )}
                <Text style={[styles.itemText, item.Icon && styles.iconText]}>
                  {item.title}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </AutoLockView>
    </BSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  sheetModal: { backgroundColor: colors2024['neutral-bg-1'] },
  list: { gap: 40, paddingTop: 16, paddingHorizontal: 20 },
  buttonList: {
    gap: BOTTOM_BUTTON_GAP,
    paddingBottom: BOTTOM_BUTTON_BOTTOM_OFFSET,
  },
  button: { borderRadius: 10 },
  buttonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
    paddingVertical: 0,
  },
  ghostButton: {
    backgroundColor: colors2024['brand-light-1'],
    borderColor: 'transparent',
  },
  primaryButton: {
    borderColor: colors2024['brand-default'],
    ...Platform.select({
      ios: {
        shadowColor: colors['blue-default'],
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 12,
        shadowOpacity: 0.1,
      },
    }),
  },
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
