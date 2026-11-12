import React, { useEffect } from 'react';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';
import { scheduleStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import {
  refreshMemeHoldings,
  useMemeHoldings,
} from '@/screens/MemeCoin/data/memeHoldingsStore';
import { formatMemeBalanceUsd } from '@/screens/MemeCoin/ui/formatBalance';
import { createGetStyles2024 } from '@/utils/styles';
import { BALANCE_HIDE_TYPE, useHideBalance } from '../hooks/useHideBalance';

export const MemeCoinBalance: React.FC = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  // the account the Memecoin page opens with
  const { finalSceneCurrentAccount: account } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const address = account?.address;
  const { totalUsd, loaded, loadFailed } = useMemeHoldings(address);
  const [hideType] = useHideBalance();

  useEffect(() => {
    if (!address || loaded) {
      return;
    }
    const handle = scheduleStartupTask(() => {
      refreshMemeHoldings(address);
    }, STARTUP_TASKS.homeMemeHoldingsWarmup);
    return () => {
      if (handle && typeof handle === 'object' && 'cancel' in handle) {
        handle.cancel();
      }
    };
  }, [address, loaded]);

  if (!address || loadFailed) {
    return null;
  }
  if (!loaded) {
    return <CustomSkeleton width={50} height={18} style={styles.skeleton} />;
  }
  if (totalUsd <= 0) {
    return null;
  }
  return (
    <Text style={styles.value}>
      {hideType === BALANCE_HIDE_TYPE.HIDE
        ? '****'
        : formatMemeBalanceUsd(totalUsd)}
    </Text>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  value: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  skeleton: {
    borderRadius: 8,
  },
}));
