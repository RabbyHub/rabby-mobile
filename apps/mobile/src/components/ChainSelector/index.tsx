import React, { ReactNode } from 'react';
import RcIconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { findChainByEnum } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

interface ChainSelectorProps {
  value: CHAINS_ENUM;
  onChange(value: CHAINS_ENUM): void;
  direction?: 'top' | 'bottom';
  connection?: boolean;
  showModal?: boolean;
  title?: ReactNode;
  onAfterOpen?: () => void;
  showRPCStatus?: boolean;
  modalHeight?: number;
  style?: StyleProp<ViewStyle>;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    chainIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      marginRight: 6,
    },
    wrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderColor: colors['neutral-line'],
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 6,
    },
    chainText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    buttonIcon: {
      transform: [{ rotate: '90deg' }],
      marginLeft: 4,
    },
  });

export const ChainSelector = ({
  title,
  value,
  onChange,
  connection = false,
  showModal = false,
  style = {},
  onAfterOpen,
  showRPCStatus = false,
}: ChainSelectorProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { closePopup, activePopup, setData } = useCommonPopupView();
  const chainInfo = React.useMemo(() => {
    return findChainByEnum(value);
  }, [value]);

  const activeSelectChainPopup = () => {
    setData({
      value,
      onChange: (v: CHAINS_ENUM) => {
        onChange?.(v);
      },
    });
    activePopup('SELECT_CHAIN');
  };

  const handleClickSelector = () => {
    activeSelectChainPopup();
    onAfterOpen?.();
  };

  return (
    <TouchableOpacity
      style={StyleSheet.flatten([styles.wrapper, style])}
      onPress={handleClickSelector}>
      <View>
        {chainInfo && (
          <Image
            source={{
              uri: chainInfo.logo,
            }}
            style={styles.chainIcon}
          />
        )}
      </View>
      <Text style={styles.chainText}>{findChainByEnum(value)?.name}</Text>
      <RcIconArrowRight style={styles.buttonIcon} />
    </TouchableOpacity>
  );
};
