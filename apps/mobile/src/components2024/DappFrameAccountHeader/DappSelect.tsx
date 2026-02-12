import AutoLockView from '@/components/AutoLockView';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import RcCaretDownSmallCC from '@/assets2024/icons/common/caret-down-small-cc.svg';
import { DappSelectItem } from './constants';
import { getStyle } from './styles';

type Props = {
  activeId: string;
  list: DappSelectItem[];
  title?: string;
  onSelect?: (item: DappSelectItem) => void;
};

export const DappSelect = ({ activeId, list, title, onSelect }: Props) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { height } = useWindowDimensions();
  const modalRef = React.useRef<AppBottomSheetModal>(null);
  const [visible, setVisible] = React.useState(false);
  const maxHeight = React.useMemo(() => height - 200, [height]);

  const activeItem = list.find(item => item.id === activeId);
  const sheetTitle = title ?? 'Select Dapp';

  React.useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }
    modalRef.current?.dismiss();
  }, [visible]);

  const handleOpen = React.useCallback(() => {
    setVisible(true);
  }, []);

  const handleDismiss = React.useCallback(() => {
    setVisible(false);
  }, []);

  const handleSelect = React.useCallback(
    (item: DappSelectItem) => {
      item.onPress?.(item);
      onSelect?.(item);
      setVisible(false);
    },
    [onSelect],
  );

  if (!activeItem) {
    return null;
  }

  return (
    <>
      <TouchableOpacity style={styles.leftGroup} onPress={handleOpen}>
        <View
          style={[
            styles.marketPill,
            { backgroundColor: activeItem.themeColor },
          ]}>
          <FastImage
            style={styles.marketIcon}
            defaultSource={activeItem.icon}
            source={
              activeItem?.remoteUrl
                ? { uri: activeItem?.remoteUrl }
                : activeItem.icon
            }
          />
          <View style={styles.marketTextGroup}>
            <Text style={styles.marketText}>{activeItem.name}</Text>
            <RcCaretDownSmallCC
              style={styles.marketCaret}
              color={colors2024['neutral-info']}
            />
          </View>
        </View>
      </TouchableOpacity>
      <AppBottomSheetModal
        ref={modalRef}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        onDismiss={handleDismiss}
        enableDynamicSizing
        enableContentPanningGesture
        maxDynamicContentSize={maxHeight}>
        <BottomSheetScrollView>
          <AutoLockView style={styles.sheetContainer}>
            {sheetTitle ? (
              <Text style={styles.sheetTitle}>{sheetTitle}</Text>
            ) : null}
            <View style={styles.sheetList}>
              {list.map(item => {
                const rightText = item.rightText ?? item.value;

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => handleSelect(item)}>
                    <View
                      style={[
                        styles.sheetItem,
                        item.id === activeId && styles.sheetItemActive,
                      ]}>
                      <View style={styles.sheetItemLeft}>
                        <FastImage
                          style={styles.sheetItemIcon}
                          defaultSource={item.icon}
                          source={
                            item?.remoteUrl
                              ? { uri: item?.remoteUrl }
                              : item.icon
                          }
                        />
                        <View style={styles.sheetItemTextGroup}>
                          <Text style={styles.sheetItemTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.description ? (
                            <Text
                              style={styles.sheetItemSubtitle}
                              numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                          {item.extraInfo ? (
                            <Text
                              style={styles.sheetItemMeta}
                              numberOfLines={1}>
                              {item.extraInfo}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {rightText ? (
                        <Text style={styles.sheetItemRight} numberOfLines={1}>
                          {rightText}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AutoLockView>
        </BottomSheetScrollView>
      </AppBottomSheetModal>
    </>
  );
};
