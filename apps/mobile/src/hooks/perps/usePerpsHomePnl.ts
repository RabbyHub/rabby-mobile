import { useMemoizedFn } from 'ahooks';
import { useCallback } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { initialState, perpsStore, usePerpsStore } from './usePerpsStore';
import { useFocusEffect } from '@react-navigation/native';
import { formatPositionPnl } from '@/utils/perps';
import { useShallow } from 'zustand/react/shallow';

export const usePerpsHomePnl = () => {
  const { homePositionPnl } = perpsStore(
    useShallow(s => ({
      homePositionPnl: s.homePositionPnl,
    })),
  );

  return {
    perpsPositionInfo: homePositionPnl,
  };
};
