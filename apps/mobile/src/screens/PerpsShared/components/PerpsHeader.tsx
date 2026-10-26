import RcHeaderBackground from '@/assets2024/icons/perps/PerpsHeaderBackground.svg';
import RcHeaderBack from '@/assets2024/icons/perps/PerpsHeaderBack.svg';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { navBack } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PERPS_HEADER_HEIGHT } from '../constants';
import { PerpsAccountTrigger } from './PerpsAccountTrigger';
import { PerpsModeSwitch } from './PerpsModeSwitch';

export type PerpsHeaderProps = {
  accountAddress?: string;
  accountBrandName?: string;
  accountExpanded?: boolean;
  accountLabel?: string | null;
  accountTriggerVariant?: 'compact' | 'wallet' | 'wallet-icon';
  activeMode: PerpsViewMode;
  extendProHitAreaRight?: boolean;
  isModeSwitching: boolean;
  onPressAccount?: () => void;
  onPressInMode?: (viewMode: PerpsViewMode) => void;
  onPressOutMode?: (viewMode: PerpsViewMode) => void;
  onSelectMode: (viewMode: PerpsViewMode) => void;
  showBottomDivider: boolean;
  showProNewBadge?: boolean;
};

/**
 * Shared Perps header geometry. Account, popup, runtime, and scroll ownership
 * stay in the Simple/Pro wrappers that provide these presentation props.
 */
export const PerpsHeader: React.FC<PerpsHeaderProps> = React.memo(
  ({
    accountAddress,
    accountBrandName,
    accountExpanded = false,
    accountLabel,
    accountTriggerVariant = 'compact',
    activeMode,
    extendProHitAreaRight = false,
    isModeSwitching,
    onPressAccount,
    onPressInMode,
    onPressOutMode,
    onSelectMode,
    showBottomDivider,
    showProNewBadge = false,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });

    return (
      <View
        style={[
          styles.header,
          activeMode === 'simple' ? styles.simpleHeader : null,
        ]}
        testID="perps-header">
        <RcHeaderBackground
          height={48}
          width={61}
          pointerEvents="none"
          style={styles.backgroundMark}
          testID="perps-header-background-mark"
        />
        <View style={styles.left} testID="perps-header-left">
          <CustomTouchableOpacity
            accessibilityRole="button"
            onPress={navBack}
            style={styles.backButton}
            testID="perps-header-back">
            <RcHeaderBack
              color={colors2024['neutral-title-1']}
              height={24}
              width={24}
              style={styles.backIcon}
            />
          </CustomTouchableOpacity>
          <View style={styles.identity} testID="perps-header-identity">
            <PerpsModeSwitch
              activeMode={activeMode}
              disabled={isModeSwitching}
              extendProHitAreaRight={extendProHitAreaRight}
              onPressInMode={onPressInMode}
              onPressOutMode={onPressOutMode}
              onSelectMode={onSelectMode}
              showProNewBadge={showProNewBadge}
            />
          </View>
        </View>
        {accountLabel && onPressAccount ? (
          <PerpsAccountTrigger
            address={accountAddress}
            brandName={accountBrandName}
            expanded={accountExpanded}
            label={accountLabel}
            onPress={onPressAccount}
            variant={accountTriggerVariant}
          />
        ) : null}
        {showBottomDivider ? (
          <View
            pointerEvents="none"
            style={styles.bottomDivider}
            testID="perps-header-bottom-divider"
          />
        ) : null}
      </View>
    );
  },
);

PerpsHeader.displayName = 'PerpsHeader';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    gap: 8,
    height: PERPS_HEADER_HEIGHT,
    paddingLeft: 16,
    paddingRight: 16,
    position: 'relative',
  },
  simpleHeader: {
    backgroundColor: 'transparent',
  },
  backgroundMark: {
    left: 16,
    position: 'absolute',
    top: -2,
  },
  bottomDivider: {
    backgroundColor: colors2024['neutral-bg-5'],
    bottom: 0,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  left: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  backButton: {
    height: 44,
    justifyContent: 'center',
    width: 24,
  },
  backIcon: { transform: [{ rotate: '180deg' }] },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
}));
