import React from 'react';
import { View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { formatGasCostUsd } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import SuccessSVG from '@/assets/icons/batchRevoke/success.svg';
import FailedSVG from '@/assets/icons/batchRevoke/failed.svg';
import { CellText } from './Cell';
import { CircleSpinner } from '@/components2024/CircleSpinner/CircleSpinner';
import { TouchableOpacity } from 'react-native';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export const ListItemStatus: React.FC<{
  data: AssetApprovalSpenderWithStatus;
  isPaused: boolean;
  onStillRevoke: () => void;
}> = ({ data, isPaused, onStillRevoke }) => {
  const { styles } = useTheme2024({
    getStyle: getStyle,
  });
  const { t } = useTranslation();

  const handlePressErrorReason = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.BATCH_REVOKE_ERROR_REASON,
      bottomSheetModalProps: {
        enableDynamicSizing: true,
      },
      onCancel: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      onStillRevoke: () => {
        onStillRevoke();
        removeGlobalBottomSheetModal2024(id);
      },
      failedCode:
        data.$status?.status === 'fail' ? data.$status.failedCode : undefined,
      gasCostUsd:
        data.$status?.status === 'fail'
          ? data.$status?.gasCost?.gasCostUsd
          : undefined,
    });
  }, [data.$status, onStillRevoke]);

  if (!data) {
    return null;
  }

  return (
    <View>
      {data.$status?.status === 'success' && (
        <View style={styles.success}>
          <SuccessSVG style={styles.successIcon} />
          <CellText>
            ${formatGasCostUsd(data.$status?.gasCost.gasCostUsd)}
          </CellText>
        </View>
      )}
      {data.$status?.status === 'fail' && (
        <TouchableOpacity hitSlop={10} onPress={handlePressErrorReason}>
          <FailedSVG />
        </TouchableOpacity>
      )}
      {data.$status?.status === 'pending' && (
        <View>
          <CircleSpinner />
        </View>
      )}

      {!data.$status?.status && (
        <CellText>
          {isPaused ? t('page.approvals.revokeModal.paused') : '-'}
        </CellText>
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  success: {
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 2,
  },
}));
