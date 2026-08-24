import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { HeaderBackPressable } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PERPS_HEADER_HEIGHT } from '../constants';
import { PerpsAccountTrigger } from './PerpsAccountTrigger';
import { PerpsModeSwitch } from './PerpsModeSwitch';

export type PerpsHeaderProps = {
  accountExpanded?: boolean;
  accountLabel?: string | null;
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
    accountExpanded = false,
    accountLabel,
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
    const { styles } = useTheme2024({ getStyle });

    return (
      <View
        style={[
          styles.header,
          activeMode === 'simple' ? styles.simpleHeader : null,
        ]}
        testID="perps-header">
        <View style={styles.left} testID="perps-header-left">
          <HeaderBackPressable
            style={styles.backButton}
            testID="perps-header-back"
          />
          <View style={styles.identity} testID="perps-header-identity">
            <RcIconHyper height={15} width={19} />
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
            expanded={accountExpanded}
            label={accountLabel}
            onPress={onPressAccount}
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
    paddingLeft: 8,
    paddingRight: 15,
    position: 'relative',
  },
  simpleHeader: {
    backgroundColor: 'transparent',
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
    height: 24,
    marginLeft: 0,
    paddingLeft: 0,
    width: 24,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    minWidth: 0,
  },
}));
