// emode 和 isolate 属于模式管理,并且互斥，同处这个hook管理

import { useCallback, useMemo } from 'react';
import {
  // iUserSummaryAtom,
  useLendingISummary,
  useFormattedPoolReservesAndIncentivesAtom,
} from '../hooks';
import { useAtomValue } from 'jotai';
import { formatEmodes, isEmodeEnabled } from '../utils/emode';
import { selectAtom } from 'jotai/utils';

export const useMode = () => {
  console.debug('[perf] useMode:: called');
  // const iUserSummary = useAtomValue(
  //   selectAtom(
  //     iUserSummaryAtom,
  //     useCallback(s => ({
  //       userEmodeCategoryId: s?.userEmodeCategoryId,
  //       isInIsolationMode: s?.isInIsolationMode,
  //     }), [])
  //   )
  // );
  const { iUserSummary } = useLendingISummary();
  const formattedPoolReserves = useFormattedPoolReservesAndIncentivesAtom();

  const emodeEnabled = useMemo(() => {
    return iUserSummary ? isEmodeEnabled(iUserSummary) : false;
  }, [iUserSummary]);

  const eModeInfo = useMemo(() => {
    const _eModes = formattedPoolReserves
      ? formatEmodes(formattedPoolReserves)
      : {};
    const currentEmode =
      iUserSummary?.userEmodeCategoryId !== undefined &&
      iUserSummary.userEmodeCategoryId !== 0
        ? _eModes[iUserSummary.userEmodeCategoryId] ?? undefined
        : undefined;
    return {
      eModes: _eModes,
      currentEmode,
    };
  }, [formattedPoolReserves, iUserSummary?.userEmodeCategoryId]);

  return {
    emodeEnabled,
    isInIsolationMode: iUserSummary?.isInIsolationMode,
    emodeCategoryId: iUserSummary?.userEmodeCategoryId,
    eModes: eModeInfo.eModes,
    currentEmode: eModeInfo.currentEmode,
  };
};
