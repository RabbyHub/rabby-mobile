import { useEffect, useRef } from 'react';

import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { getExpandListSwitch } from '@/hooks/useExpandList';
import { useSafeState } from '@/hooks/useSafeState';
import { chunk } from 'lodash';
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
import { usePortfoliosAtom } from './store';

const chunkSize = 5;
export const tagProfiles = (
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

export const usePortfolios = (
  userAddr: string | undefined,
  visible = true,
  isTestnet = false,
) => {
  const [data, setData] = usePortfoliosAtom(userAddr);
  const [hasValue, setHasValue] = useSafeState(false);
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(false);
  const projectDict = useRef<Record<string, DisplayedProject> | null>({});
  const realtimeIds = useRef<string[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (userAddr) {
      timer = setTimeout(() => {
        if (visible) {
          abortProcess.current?.abort();
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

  useEffect(() => {
    return () => {
      abortProcess.current?.abort();
    };
  }, []);

  const loadProcess = async () => {
    if (!userAddr) {
      return;
    }
    console.log('🔍 CUSTOM_LOGGER:=>: portfolios==loadProcess)', userAddr);
    projectDict.current = {};

    const currentAbort = new AbortController();
    abortProcess.current = currentAbort;

    setLoading(true);

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
              project && portfolio2Display(project, draft);
            });
          }
        });
      }),
    );

    realtimeData = Object.values(projectDict.current)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    setData(tagProfiles(realtimeData, tokenSetting));
    setLoading(false);

    log('portfolios-end', userAddr);
  };

  return {
    data,
    hasValue,
    isLoading,
    updateData: loadProcess,
  };
};
