import RcIconHyper from '@/assets2024/icons/perps/IconHyper.svg';
import type { PerpsViewMode } from '@/core/services/perpsService';
import { HeaderBackPressable } from '@/hooks/navigation';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useTheme2024 } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { View } from 'react-native';

import { usePerpsPopupState } from '../../../Perps/hooks/usePerpsPopupState';
import { PerpsAccountTrigger } from '../../../PerpsShared/components/PerpsAccountTrigger';
import { PerpsModeSwitch } from '../../../PerpsShared/components/PerpsModeSwitch';
import { PERPS_PRO_HEADER_HEIGHT } from './constants';

export { PERPS_PRO_HEADER_HEIGHT } from './constants';

export const PerpsProHeader: React.FC<{
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
}> = React.memo(({ isModeSwitching, onSwitchToSimple }) => {
  const { styles } = useTheme2024({ getStyle });
  const account = perpsStore(state => state.currentPerpsAccount);
  const [popupState, setPopupState] = usePerpsPopupState();

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
        <PerpsAccountTrigger
          expanded={popupState.isShowLoginPopup}
          label={account.aliasName || ellipsisAddress(account.address)}
          onPress={() =>
            setPopupState(current => ({
              ...current,
              isShowLoginPopup: !current.isShowLoginPopup,
            }))
          }
        />
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
}));
