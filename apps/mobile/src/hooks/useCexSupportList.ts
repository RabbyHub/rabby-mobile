import { useEffect } from 'react';
import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';

import { openapi } from '@/core/request';

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
