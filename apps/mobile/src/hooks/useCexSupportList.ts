import { useEffect } from 'react';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';

import { openapi } from '@/core/request';
import { getCexId } from '@/utils/addressCexId';

export const globalSupportCexList: ProjectItem[] = [];
export const supportCexListAtom = atom<ProjectItem[]>([]);
export const useCexSupportList = () => {
  const [list, setList] = useAtom(supportCexListAtom);

  useEffect(() => {
    if (list.length) {
      return;
    }
    openapi.getCexSupportList().then(res => {
      globalSupportCexList.push(...res);
      setList(res);
    });
  }, [list.length, setList]);

  return {
    list,
  };
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
