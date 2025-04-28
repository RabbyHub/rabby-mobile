import React from 'react';
import { View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { formatGasCostUsd } from '@/utils/number';
import { useTranslation } from 'react-i18next';
import SuccessSVG from '@/assets/icons/batchRevoke/success.svg';
import FailedSVG from '@/assets/icons/batchRevoke/failed.svg';
import { CellText } from './Cell';

export const ListItemStatus: React.FC<{
  data: AssetApprovalSpenderWithStatus;
  isPaused: boolean;
  onStillRevoke: () => void;
}> = ({ data, isPaused, onStillRevoke }) => {
  const { t } = useTranslation();

  if (!data) {
    return null;
  }

  return (
    <View>
      {data.$status?.status === 'success' && (
        <View>
          <CellText>
            {formatGasCostUsd(data.$status?.gasCost.gasCostUsd)}
          </CellText>
        </View>
      )}
      {!data.$status?.status && (
        <CellText>
          {isPaused ? t('page.approvals.revokeModal.paused') : '-'}{' '}
        </CellText>
      )}
    </View>
  );
};
