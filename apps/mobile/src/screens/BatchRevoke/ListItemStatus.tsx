import React from 'react';
import { Text, View } from 'react-native';
import { AssetApprovalSpenderWithStatus } from './useBatchRevokeTask';
import { formatGasCostUsd } from '@/utils/number';
import { useTranslation } from 'react-i18next';

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
          <Text>{formatGasCostUsd(data.$status?.gasCost.gasCostUsd)}</Text>
        </View>
      )}
      {!data.$status?.status && (
        <Text> {isPaused ? t('page.approvals.revokeModal.paused') : '-'} </Text>
      )}
    </View>
  );
};
