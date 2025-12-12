import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import ArrowDownSVG from '@/assets/icons/common/arrow-down-cc.svg';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

import { useMode } from '../../hooks/useMode';

const getStyle = createGetStyles2024(({ isLight, colors2024 }) => {
  return {
    container: {
      width: '100%',
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: colors2024['neutral-bg-2'],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 4,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flex: 1,
    },
    chainName: {
      color: colors2024['neutral-title-1'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      lineHeight: 22,
      height: 22,
      fontWeight: '700',
      maxWidth: '90%',
    },
    unavailablePlaceholder: {
      color: colors2024['neutral-secondary'],
      maxWidth: '60%',
    },
    unavailableText: {
      color: colors2024['neutral-secondary'],
      fontWeight: '400',
      fontSize: 14,
      lineHeight: 18,
      fontFamily: 'SF Pro Rounded',
    },
    placeholderText: {
      color: colors2024['neutral-secondary'],
      fontWeight: '400',
    },
    icon: {
      // transform: [{ rotate: '90deg' }],
    },
    iconContainer: {
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 100,
      backgroundColor: isLight
        ? 'rgba(0, 0, 0, 0.1)'
        : colors2024['neutral-line'],
    },
    enabledText: {
      fontSize: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['green-default'],
      fontFamily: 'SF Pro Rounded',
    },
  };
});

export function CategorySelector({
  style,
  disable,
  label,
  value,
  onChange,
  isUnAvailable,
}: React.PropsWithChildren<
  RNViewProps & {
    label?: string;
    onChange?: (categoryId: number) => void;
    disable?: boolean;
    value?: number;
    isUnAvailable?: boolean;
  }
>) {
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const modalRef = React.useRef<MODAL_ID>();
  const { emodeEnabled } = useMode();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);
  const isCloseMode = useMemo(() => {
    return !!emodeEnabled;
  }, [emodeEnabled]);

  const createChainModal = React.useCallback(() => {
    if (isCloseMode) {
      return;
    }
    removeChainModal();
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_EMODE_CATEGORY,
      allowAndroidHarewareBack: true,
      titleText: t('page.Lending.manageEmode.categorySelector.label'),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        rootViewType: 'View',
        handleStyle: {
          backgroundColor: isLight
            ? colors2024['neutral-bg-0']
            : colors2024['neutral-bg-1'],
        },
      },
      value,
      onChange: categoryId => {
        onChange?.(categoryId);
        removeChainModal();
      },
    });
  }, [isCloseMode, removeChainModal, t, isLight, colors2024, value, onChange]);

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      disabled={disable}
      onPress={createChainModal}>
      <View style={styles.left}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.chainName,
            !label && styles.placeholderText,
            isUnAvailable && styles.unavailablePlaceholder,
          ]}>
          {label || t('page.Lending.manageEmode.categorySelector.placeholder')}
        </Text>
        {isUnAvailable ? (
          <Text style={styles.unavailableText}>
            {t('page.Lending.manageEmode.unavailable')}
          </Text>
        ) : null}
      </View>

      {!disable && !isCloseMode ? (
        <View style={styles.iconContainer}>
          <ArrowDownSVG
            width={16}
            height={16}
            style={styles.icon}
            color={colors2024['neutral-body']}
          />
        </View>
      ) : null}
      {isCloseMode ? (
        <Text style={styles.enabledText}>
          {t('page.Lending.manageEmode.enabled')}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}
