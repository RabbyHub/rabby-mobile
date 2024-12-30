import { useEffect, useRef } from 'react';
// import { atom, useSetAtom } from 'jotai';

import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { getExpandListSwitch } from '@/hooks/useExpandList';
import { useSafeState } from '@/hooks/useSafeState';
import { chunk } from 'lodash';
import { addressUtils } from '@rabby-wallet/base-utils';
import {
  loadTestnetPortfolioSnapshot,
  loadPortfolioSnapshot,
  snapshot2Display,
  batchLoadProjects,
  portfolio2Display,
} from '../utils/portfolio';
import { DisplayedProject } from '../utils/project';
import { produce } from '@/core/utils/produce';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';

const chunkSize = 5;
const { isSameAddress } = addressUtils;
const tagProfiles = (
  profiles: DisplayedProject[],
  tokenSetting: ITokenSetting,
): DisplayedProject[] => {
  const { includeDefiAndTokens = [], excludeDefiAndTokens = [] } = tokenSetting;

  return profiles.map(i => {
    const isExcludeBalance = (() => {
      if (excludeDefiAndTokens.some(x => x.id === i.id && x.type === 'defi')) {
        return true;
      }
      if (includeDefiAndTokens.some(x => x.id === i.id && x.type === 'defi')) {
        return false;
      }
      return false;
    })();

    return Object.assign(i, {
      _isExcludeBalance: isExcludeBalance,
    });
  });
};
export const log = (...args: any) => {
  // console.log(...args);
};

// export const portfolioChangeLoadingAtom = atom(true);

export const usePortfolios = (
  userAddr: string | undefined,
  visible = true,
  isTestnet = false,
) => {
  const [data, setData] = useSafeState<DisplayedProject[]>([]);
  const [netWorth, setNetWorth] = useSafeState(0);
  const [hasValue, setHasValue] = useSafeState(false);
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(true);
  const projectDict = useRef<Record<string, DisplayedProject> | null>({});
  const historyLoad = useRef<boolean>(false);
  const realtimeIds = useRef<string[]>([]);
  const userAddrRef = useRef('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (userAddr && !isSameAddress(userAddr, userAddrRef.current)) {
      setData([]);
      setNetWorth(0);
    }

    if (userAddr) {
      timer = setTimeout(() => {
        if (visible && !isSameAddress(userAddr, userAddrRef.current)) {
          abortProcess.current?.abort();
          userAddrRef.current = userAddr;
          loadProcess();
        }
      });
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddr, visible]);

  const loadProcess = async () => {
    if (!userAddr) {
      return;
    }
    projectDict.current = {};

    const currentAbort = new AbortController();
    abortProcess.current = currentAbort;

    historyLoad.current = false;

    setLoading(true);
    // setPortfolioChangeLoading(withHistory);

    log('======Start-Portfolio======', userAddr);
    setData([]);
    setHasValue(false);

    let snapshotRes: ComplexProtocol[] = [];
    if (isTestnet) {
      snapshotRes = await loadTestnetPortfolioSnapshot(userAddr);
    } else {
      snapshotRes = await loadPortfolioSnapshot(userAddr);
    }

    if (currentAbort.signal.aborted || !snapshotRes) {
      log('--Terminate-portfolio-snapshot-', userAddr);
      setLoading(false);
      return;
    }

    // request success
    const _hasValue = Object.values(snapshotRes).some(
      x => Object.keys(x).length > 0,
    );

    if (_hasValue) {
      setHasValue(true);
    }

    const { list, netWorth: snapshotNetWorth } = snapshot2Display(snapshotRes);

    projectDict.current = list;
    const snapshotData = Object.values(list)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    const tokenSetting = await preferenceService.getUserTokenSettings(userAddr);
    setData(tagProfiles(snapshotData, tokenSetting));
    setNetWorth(snapshotNetWorth);

    const { thresholdIndex, hasExpandSwitch } = getExpandListSwitch(
      snapshotData,
      snapshotNetWorth,
    );

    realtimeIds.current = hasExpandSwitch
      ? snapshotData.slice(0, thresholdIndex).map(x => x.id)
      : snapshotRes.map(x => x.id);

    if (currentAbort.signal.aborted || !realtimeIds.current.length) {
      log('--Terminate-portfolio-loadProjectIds-', userAddr);
      projectDict.current = null;
      setLoading(false);
      return;
    }

    const chunkIds = chunk(realtimeIds.current, chunkSize);

    let realtimeData: DisplayedProject[] = [];

    await Promise.all(
      chunkIds.map(async ids => {
        if (currentAbort.signal.aborted) {
          return;
        }

        const projectListRes = await batchLoadProjects(
          userAddr,
          ids,
          isTestnet,
        );

        const projects = projectListRes;

        if (!projects?.length || currentAbort.signal.aborted) {
          return;
        }

        projects.forEach(project => {
          if (!currentAbort.signal.aborted && projectDict.current) {
            log('#####################REALTIME###############################');
            projectDict.current = produce(projectDict.current, draft => {
              portfolio2Display(project, draft);
            });
          }
        });
      }),
    );

    realtimeData = Object.values(projectDict.current)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    setData(tagProfiles(realtimeData, tokenSetting));

    setNetWorth(realtimeData.reduce((m, n) => m + n.netWorth, 0));
    setLoading(false);

    log('portfolios-end', userAddr);
  };

  useEffect(() => {
    return () => {
      abortProcess.current?.abort();
    };
  }, []);

  return {
    data,
    hasValue,
    isLoading,
    updateData: loadProcess,
  };
};
