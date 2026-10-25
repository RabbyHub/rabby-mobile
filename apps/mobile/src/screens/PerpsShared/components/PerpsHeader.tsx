import RcHeaderBackground from '@/assets2024/icons/perps/PerpsHeaderBackground.svg';
import RcHeaderBack from '@/assets2024/icons/perps/PerpsHeaderBack.svg';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { navBack } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';
import type { RootScenePagerUI } from '@rabby-wallet/rn-collapsible-scene-view';

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
  businessControlsEnabled?: boolean;
  extendProHitAreaRight?: boolean;
  isModeSwitching: boolean;
  navigationEnabled?: boolean;
  pagerUI?: RootScenePagerUI;
  onPressAccount?: () => void;
  onPressInMode?: (viewMode: PerpsViewMode) => void;
  onPressOutMode?: (viewMode: PerpsViewMode) => void;
  onSelectMode: (viewMode: PerpsViewMode) => void;
  showBottomDivider: boolean;
  showProNewBadge?: boolean;
  transparentBackground?: boolean;
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
    businessControlsEnabled,
    extendProHitAreaRight = false,
    isModeSwitching,
    navigationEnabled,
    pagerUI,
    onPressAccount,
    onPressInMode,
    onPressOutMode,
    onSelectMode,
    showBottomDivider,
    showProNewBadge = false,
    transparentBackground = false,
  }) => {
    const { colors2024, styles } = useTheme2024({ getStyle });
    const accountControl =
      accountLabel && onPressAccount ? (
        <PerpsAccountTrigger
          address={accountAddress}
          brandName={accountBrandName}
          expanded={accountExpanded}
          label={accountLabel}
          onPress={onPressAccount}
          variant={accountTriggerVariant}
        />
      ) : null;

    return (
      <View
        style={[
          styles.header,
          activeMode === 'simple' || transparentBackground
            ? styles.transparentHeader
            : null,
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
            as="RNGHTouchableOpacity"
            accessibilityRole="button"
            disabled={businessControlsEnabled === false}
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
              disabled={pagerUI ? navigationEnabled === false : isModeSwitching}
              pagerUI={pagerUI}
              extendProHitAreaRight={extendProHitAreaRight}
              onPressInMode={onPressInMode}
              onPressOutMode={onPressOutMode}
              onSelectMode={onSelectMode}
              showProNewBadge={showProNewBadge}
            />
          </View>
        </View>
        {accountControl && businessControlsEnabled !== undefined ? (
          <View
            collapsable={false}
            pointerEvents={businessControlsEnabled ? 'auto' : 'none'}
            accessibilityElementsHidden={!businessControlsEnabled}
            importantForAccessibility={
              businessControlsEnabled ? 'auto' : 'no-hide-descendants'
            }
            testID="perps-header-account-controls">
            {accountControl}
          </View>
        ) : (
          accountControl
        )}
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
  transparentHeader: {
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
