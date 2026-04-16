import React, { useCallback } from 'react';
import RcLpTokenIcon from '@/assets2024/icons/home/RcLpTokenIcon.svg';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { TouchableOpacity } from 'react-native';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

const LpTokenIcon: React.FC<{ protocolId: string }> = ({ protocolId }) => {
  const { colors2024 } = useTheme2024({ getStyle: getStyles });

  const handleOpenLpTokenDetail = useCallback(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.LP_TOKEN_DETAIL,
      protocolId,
      onClose: () => {
        removeGlobalBottomSheetModal2024(modalId);
      },
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        handleStyle: {
          backgroundColor: colors2024['neutral-bg-1'],
        },
      },
    });
  }, [colors2024, protocolId]);

  return (
    <TouchableOpacity onPress={handleOpenLpTokenDetail}>
      <RcLpTokenIcon
        width={16}
        height={16}
        color={colors2024['neutral-secondary']}
      />
    </TouchableOpacity>
  );
};

export default LpTokenIcon;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    color: colors2024['red-default'],
  },
}));
