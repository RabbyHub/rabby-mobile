import { useCallback } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { colord } from 'colord';

import { IconSwitchChange, IconSwitchAssets } from '@/assets/icons';
import { Colors } from '@/consts';
import { useThemeColors } from '@/hooks';
import { CustomTouchableOpacity } from '@/components';

const AssetsView = [
  {
    value: 'default',
    icon: IconSwitchAssets,
  },
  {
    value: 'change',
    icon: IconSwitchChange,
  },
] as const;

export type AssetsViewType = (typeof AssetsView)[number]['value'];

type SwichButtonProps = {
  mode: AssetsViewType;
  onModeChange?(v: AssetsViewType): void;
};

const SwichButton = ({ mode, onModeChange }: SwichButtonProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  const handleItemPress = useCallback(
    (x: (typeof AssetsView)[number]) => {
      if (x.value !== mode) {
        onModeChange?.(x.value);
      }
    },
    [onModeChange, mode],
  );

  return (
    <View style={styles.btnContainer}>
      {AssetsView.map(x => (
        <CustomTouchableOpacity
          key={x.value}
          style={StyleSheet.flatten([
            styles.item,
            x.value === mode && styles.selected,
          ])}
          onPress={() => handleItemPress(x)}>
          {
            <x.icon
              color={x.value === mode ? colors.white : colors.lightSideInfo}
            />
          }
        </CustomTouchableOpacity>
      ))}
    </View>
  );
};

export const AssetsSwitch = (props: SwichButtonProps) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.switchTitle}>Assets</Text>
      <SwichButton {...props} />
    </View>
  );
};

const getStyle = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: 27,
      paddingTop: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    switchTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.darkBlue,
    },
    btnContainer: {
      flexDirection: 'row',
      borderRadius: 12,
      height: 24,
      overflow: 'hidden',
      backgroundColor: colord(colors.border).alpha(0.75).toRgbString(),
    },
    item: {
      width: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: {
      backgroundColor: colors.midSideInfo,
    },
  });
