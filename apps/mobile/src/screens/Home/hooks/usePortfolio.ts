import { useCallback, useEffect } from 'react';

import { useSafeState } from '@/hooks/useSafeState';
import { portfolio2Display } from '../utils/portfolio';
import { produce } from '@/core/utils/produce';
import { DisplayedProject } from '../utils/project';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { syncProtocols } from '@/databases/hooks/assets';
import { singleDeFiNounceAtom } from './refresh';
import { useAtom } from 'jotai';
export const tagProfiles = (
  profiles: DisplayedProject[],
  tokenSetting: ITokenSetting,
): DisplayedProject[] => {
  const {
    includeDefiAndTokens = [],
    excludeDefiAndTokens = [],
    foldDefis = [],
    unFoldDefis = [],
  } = tokenSetting;
  const excludeDefiAndTokensSet = new Set(
    excludeDefiAndTokens.map(x => `${x.id}-${x.type}`),
  );
  const includeDefiAndTokensSet = new Set(
    includeDefiAndTokens.map(x => `${x.id}-${x.type}`),
  );
  const foldDefisSet = new Set(foldDefis);
  const unFoldDefisSet = new Set(unFoldDefis);
  return profiles.map(i => {
    const isExcludeBalance = (() => {
      if (excludeDefiAndTokensSet.has(`${i.id}-defi`)) {
        return true;
      }
      if (includeDefiAndTokensSet.has(`${i.id}-defi`)) {
        return false;
      }
      return false;
    })();

    const isManualFold = foldDefisSet.has(i.id);

    const isFold = (() => {
      if (isManualFold) {
        return true;
      }
      if (unFoldDefisSet.has(i.id)) {
        return false;
      }
      if ((i.netWorth || 0) < 1) {
        return true;
      }
      return false;
    })();

    i._isExcludeBalance = isExcludeBalance;
    i._isFold = isFold;
    i._isManualFold = isManualFold;

    return i;
  });
};
export const log = (...args: any) => {
  // console.log(...args);
};

export const usePortfolios = (userAddr: string | undefined, visible = true) => {
  const [data, setData] = useSafeState<DisplayedProject[]>([]);
  const [hasValue, setHasValue] = useSafeState(false);
  const [isLoading, setLoading] = useSafeState(false);
  const [singleDeFiNounce, setSingleDeFiNounce] = useAtom(singleDeFiNounceAtom);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (userAddr) {
      timer = setTimeout(() => {
        if (visible) {
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

  const loadProcess = useCallback(
    async (force?: boolean) => {
      if (!userAddr) {
        return;
      }
      setHasValue(false);

      let projectDict: Record<string, DisplayedProject> | null = {};
      const protocols = await syncProtocols(userAddr, force);
      protocols.forEach(project => {
        if (projectDict) {
          projectDict = produce(projectDict, draft => {
            project && portfolio2Display(project, draft);
          });
        }
      });
      const realtimeData = Object.values(projectDict)?.sort(
        (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
      );
      const tokenSetting = await preferenceService.getUserTokenSettings();
      setData(tagProfiles(realtimeData, tokenSetting));
      setHasValue(!!protocols.length);
      setLoading(false);
    },
    [setData, setHasValue, setLoading, userAddr],
  );

  const refreshTagPortfolio = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    setData(pre => tagProfiles(pre || [], tokenSettings));
  }, [setData]);

  useEffect(() => {
    if (singleDeFiNounce > 0) {
      refreshTagPortfolio();
      setSingleDeFiNounce(0);
    }
  }, [refreshTagPortfolio, setSingleDeFiNounce, singleDeFiNounce]);

  return {
    data: data || [],
    hasValue,
    isLoading,
    updateData: loadProcess,
  };
};
