import { useCallback, useEffect, useMemo } from 'react';

import { useSafeState } from '@/hooks/useSafeState';
import { portfolio2Display } from '../utils/portfolio';
import { produce } from '@/core/utils/produce';
import { DisplayedProject } from '../utils/project';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { syncProtocols, syncSpecificProtocol } from '@/databases/hooks/assets';
import { singleDeFiNounceAtom } from './refresh';
import { useAtom, atom } from 'jotai';
import { PortocolItemEntity } from '@/databases/entities/portocolItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { debounce } from 'lodash';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
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
  const listLength = profiles.length || 0;
  const totalNetWorth = profiles.reduce(
    (acc, curr) => acc + (Number(curr.netWorth) || 0),
    0,
  );
  const threshold = Math.min((totalNetWorth || 0) / 1000, 1000);
  const thresholdIndex = profiles
    ? profiles.findIndex(m => (Number(m.netWorth) || 0) < threshold)
    : -1;
  const hasExpandSwitch =
    listLength >= 15 && thresholdIndex > -1 && thresholdIndex <= listLength - 4;

  return profiles
    .map(i => {
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
        if (isExcludeBalance) {
          return true;
        }
        if (hasExpandSwitch && (i.netWorth || 0) < threshold) {
          return true;
        }
        return false;
      })();

      i._isExcludeBalance = isExcludeBalance;
      i._isFold = isFold;
      i._isManualFold = isManualFold;

      return i;
    })
    .sort((a, b) => {
      if (a._isExcludeBalance && b._isExcludeBalance) {
        return (b.netWorth || 0) - (a.netWorth || 0);
      }
      if (a._isExcludeBalance && !b._isExcludeBalance) {
        return (b.netWorth || 0) === 0 ? -1 : 1;
      }
      if (b._isExcludeBalance && !a._isExcludeBalance) {
        return (a.netWorth || 0) === 0 ? 1 : -1;
      }
      return (b.netWorth || 0) - (a.netWorth || 0);
    });
};
export const log = () => {
  // console.log(...args);
};

export const currentPortfolioAtom = atom<{
  data: DisplayedProject[];
  address: string;
}>({ data: [], address: '' });

export const usePortfolios = (userAddr: string | undefined, visible = true) => {
  const [_data, _setData] = useAtom(currentPortfolioAtom);
  const [data, setData] = useMemo(() => {
    const innerSetData = (d: DisplayedProject[]) =>
      _setData({
        address: userAddr || '',
        data: d,
      });
    if (!userAddr) {
      return [[], innerSetData];
    }
    return [
      isSameAddress(_data.address, userAddr) ? _data.data : [],
      innerSetData,
    ];
  }, [_data.address, _data.data, _setData, userAddr]);
  const [isLoading, setLoading] = useSafeState(true);
  const [hasValue, setHasValue] = useSafeState(false);
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
      if (!force) {
        const cachePortocols = await PortocolItemEntity.batchQueryPortocols(
          userAddr,
        );
        if (cachePortocols.length) {
          let cacheProjectDict: Record<string, DisplayedProject> | null = {};
          cachePortocols.forEach(project => {
            if (cacheProjectDict) {
              cacheProjectDict = produce(cacheProjectDict, draft => {
                project && portfolio2Display(project, draft);
              });
            }
          });
          const realtimeData = Object.values(cacheProjectDict)?.sort(
            (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
          );
          const tokenSetting = await preferenceService.getUserTokenSettings();
          setData(tagProfiles(realtimeData, tokenSetting));
          setLoading(false);
          setHasValue(!!cachePortocols.length);
        }
      }
      try {
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
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [setData, setHasValue, setLoading, userAddr],
  );

  const batchLocalData = useCallback(async () => {
    if (!userAddr) {
      return;
    }
    const cachePortocols = await PortocolItemEntity.batchQueryPortocols(
      userAddr,
    );
    if (cachePortocols.length) {
      let cacheProjectDict: Record<string, DisplayedProject> | null = {};
      cachePortocols.forEach(project => {
        if (cacheProjectDict) {
          cacheProjectDict = produce(cacheProjectDict, draft => {
            project && portfolio2Display(project, draft);
          });
        }
      });
      const realtimeData = Object.values(cacheProjectDict)?.sort(
        (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
      );
      const tokenSetting = await preferenceService.getUserTokenSettings();
      setData(tagProfiles(realtimeData, tokenSetting));
      setHasValue(!!cachePortocols.length);
    }
  }, [setData, setHasValue, userAddr]);

  const refreshTagPortfolio = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    _setData(pre => ({
      ...pre,
      data: tagProfiles(pre.data || [], tokenSettings),
    }));
  }, [_setData]);

  const debounceUpdatePortfolio = useMemo(
    () => debounce(batchLocalData, 2000),
    [batchLocalData],
  );

  useAppOrmSyncEvents({
    taskFor: ['protocols'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !userAddr ||
          !isSameAddress(ctx.owner_addr, userAddr) ||
          !ctx.success ||
          isLoading
        ) {
          return;
        }
        const currentUpdateCount =
          ctx.syncDetails.batchSize * ctx.syncDetails.round +
          ctx.syncDetails.count;

        if (
          currentUpdateCount >= ctx.syncDetails.total ||
          currentUpdateCount > (data?.length || 0)
        ) {
          debounceUpdatePortfolio();
        }
      },
      [userAddr, isLoading, data?.length, debounceUpdatePortfolio],
    ),
  });

  useEffect(() => {
    if (singleDeFiNounce > 0) {
      refreshTagPortfolio();
      setSingleDeFiNounce(0);
    }
  }, [refreshTagPortfolio, setSingleDeFiNounce, singleDeFiNounce]);

  const updateSpecificProtocol = useCallback(
    async (protocolId: string, chain: string) => {
      if (!userAddr || !protocolId || !chain) {
        return;
      }

      try {
        // 获取特定协议的最新数据
        const protocols = await syncSpecificProtocol(
          userAddr,
          protocolId,
          chain,
        );
        const targetProtocol = protocols[0];
        if (!targetProtocol || !targetProtocol.portfolio_item_list?.length) {
          setData(data.filter(item => item.id !== protocolId));
          return;
        }
        const protocolDisplayData = new DisplayedProject(
          targetProtocol,
          targetProtocol.portfolio_item_list,
        );

        // 更新内存中的数据
        const tokenSetting = await preferenceService.getUserTokenSettings();

        const currentProtocolIndex = data.findIndex(
          item => item.id === protocolId,
        );
        const preData = [...data];

        if (currentProtocolIndex > -1) {
          // 更新现有协议数据
          preData[currentProtocolIndex] = protocolDisplayData;
        } else {
          // 添加新协议数据
          preData.push(protocolDisplayData);
        }
        // 重新排序
        const sortedData = preData.sort(
          (a, b) => (b.netWorth || 0) - (a.netWorth || 0),
        );

        setData(tagProfiles(sortedData, tokenSetting));
      } catch (error) {
        console.error('Failed to update specific protocol:', error);
      }
    },
    [userAddr, data, setData],
  );

  return {
    data: data || [],
    hasValue,
    isLoading,
    updateData: loadProcess,
    updateSpecificProtocol,
  };
};
