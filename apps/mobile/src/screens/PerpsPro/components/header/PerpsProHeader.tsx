import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import RcAccountCaret from '@/assets2024/icons/perps/PerpsProAccountCaret.svg';
import { Text } from '@/components/Typography';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { HeaderBackPressable } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { PerpsModeSwitch } from '../../../PerpsShared/components/PerpsModeSwitch';
import { PERPS_PRO_HEADER_HEIGHT } from './constants';

export { PERPS_PRO_HEADER_HEIGHT } from './constants';

export const PerpsProHeader: React.FC<{
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
}> = React.memo(({ isModeSwitching, onSwitchToSimple }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const account = perpsStore(state => state.currentPerpsAccount);

  const handleSelectMode = (viewMode: PerpsViewMode) => {
    if (viewMode === 'simple') {
      onSwitchToSimple();
    }
  };

  return (
    <View style={styles.header} testID="perps-pro-header">
      <View style={styles.left}>
        <HeaderBackPressable style={styles.backButton} />
        <RcIconHyper />
        <PerpsModeSwitch
          activeMode="pro"
          disabled={isModeSwitching}
          onSelectMode={handleSelectMode}
        />
      </View>
      {account ? (
        <View
          accessibilityState={{ disabled: true }}
          style={styles.account}
          testID="perps-pro-account-frame">
          <WalletIcon
            address={account.address}
            height={18}
            type={account.brandName}
            width={18}
          />
          <Text numberOfLines={1} style={styles.accountName}>
            {account.aliasName || ellipsisAddress(account.address, 3)}
          </Text>
          <View style={styles.accountCaret}>
            <RcAccountCaret
              color={colors2024['neutral-title-1']}
              height={14}
              width={14}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
});

PerpsProHeader.displayName = 'PerpsProHeader';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    height: PERPS_PRO_HEADER_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  left: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  backButton: {
    marginLeft: 0,
    paddingLeft: 0,
  },
  account: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    borderColor: colors2024['neutral-line'],
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    maxWidth: 108,
    minHeight: 30,
    paddingHorizontal: 6,
  },
  accountName: {
    color: colors2024['neutral-foot'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  accountCaret: {
    backgroundColor: colors2024['neutral-line'],
    borderRadius: 7,
    height: 14,
    transform: [{ rotate: '90deg' }],
    width: 14,
  },
}));
