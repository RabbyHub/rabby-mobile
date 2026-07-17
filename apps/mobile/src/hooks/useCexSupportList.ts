import { useEffect } from 'react';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';

import { openapi } from '@/core/request';
import { getCexId } from '@/utils/addressCexId';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { runStartupTask } from '@/core/utils/startupScheduler';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';

export const globalSupportCexList: ProjectItem[] = [];
type SupportedCexListState = {
  list: ProjectItem[];
};
const supportCexListStore = zCreate<SupportedCexListState>(() => ({
  list: [],
}));

function setSupportCexList(valOrFunc: UpdaterOrPartials<ProjectItem[]>) {
  supportCexListStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.list, valOrFunc);

    return { ...prev, list: newVal };
  });
}

runStartupTask(() => {
  openapi.getCexSupportList().then(res => {
    globalSupportCexList.length === 0 && globalSupportCexList.push(...res);
    setSupportCexList(res);
  });
}, STARTUP_TASKS.cexSupportListFetch);
export const useCexSupportList = () => {
  const list = supportCexListStore(s => s.list);

  return { list };
};
export const getCexInfo = (address: string) => {
  if (!address) {
    return undefined;
  }
  const cexId = getCexId(address);
  const cexInfo = globalSupportCexList.find(item => item.id === cexId);
  if (!cexInfo || !cexId) {
    return undefined;
  }
  return {
    id: cexId,
    name: cexInfo?.name || '',
    logo: cexInfo?.logo_url || '',
  };
};
