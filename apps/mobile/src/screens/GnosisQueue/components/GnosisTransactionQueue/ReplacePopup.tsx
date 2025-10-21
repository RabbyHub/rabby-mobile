import { RcIconRightCC } from '@/assets/icons/common';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { BottomSheetView, TouchableOpacity } from '@gorhom/bottom-sheet';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

interface ReplacePopupProps {
  visible?: boolean;
  onClose?: () => void;
  onSelect?: (value: string) => void;
}
export const ReplacePopup = ({
  visible,
  onClose,
  onSelect,
}: ReplacePopupProps) => {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const options = useMemo(
    () => [
      {
        label: t('page.safeQueue.ReplacePopup.options.send'),
        value: 'send',
      },
      {
        label: t('page.safeQueue.ReplacePopup.options.reject'),
        value: 'reject',
      },
    ],
    [t],
  );

  React.useEffect(() => {
    if (!visible) {
      modalRef.current?.close();
    } else {
      modalRef.current?.present();
    }
  }, [visible]);
  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={() => onClose?.()}
      snapPoints={[280]}>
      <BottomSheetView>
        <View style={styles.popupContainer}>
          <Text style={styles.title}>
            {t('page.safeQueue.ReplacePopup.title')}
          </Text>
          <View>
            <Text style={styles.desc}>
              {t('page.safeQueue.ReplacePopup.desc')}
            </Text>
            <View style={styles.optionList}>
              {options.map(item => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.optionListItem}
                  activeOpacity={0.6}
                  onPress={() => {
                    onSelect?.(item.value);
                  }}>
                  <Text style={styles.optionListItemContent}>{item.label}</Text>
                  <View style={styles.optionListItemRight}>
                    <RcIconRightCC color={themeColors['neutral-foot']} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
};

const getStyles = createGetStyles(colors => ({
  popupContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    color: colors['neutral-title-1'],
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 10,
    lineHeight: 20,
  },
  desc: {
    color: colors['neutral-body'],
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 20,
    lineHeight: 17,
  },
  optionList: {
    flexDirection: 'column',
    gap: 12,
  },
  optionListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: colors['neutral-card-2'],
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 15,
  },
  optionListItemNotLastChild: {
    marginBottom: 12,
  },
  optionListItemHover: {
    borderColor: colors['blue-default'],
    backgroundColor: colors['blue-light-1'],
  },
  optionListItemContent: {
    color: colors['neutral-title-1'],
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
  },
  optionListItemRight: {
    marginLeft: 'auto',
  },
}));
