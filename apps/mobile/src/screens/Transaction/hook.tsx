import { ProjectItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useEffect, useState } from 'react';
import { CexEntity } from '@/databases/entities/cex';
import { useMemoizedFn, useMount } from 'ahooks';
import { globalSupportCexList } from '@/hooks/useCexSupportList';
import { getCexId } from '@/utils/addressCexId';

export const useGetCexList = () => {
  // const [list, setList] = useState<ProjectItem[]>([]);
  const [addressCex, setAddressCex] = useState<Record<string, ProjectItem>>({});
  const getCexInfoByAddress = useCallback(
    (address: string) => {
      const localCexId = getCexId(address);
      const localCexInfo = globalSupportCexList.find(
        item => item.id === localCexId,
      );
      return localCexInfo || addressCex[address.toLowerCase()];
    },
    [addressCex],
  );

  const fetchCexList = useMemoizedFn(async () => {
    const res = await CexEntity.getCexList();
    const tempObj = {} as Record<string, ProjectItem>;
    const cexList = res.filter(item => item.is_deposit);
    cexList.forEach(item => {
      tempObj[item.owner_addr] = {
        id: item.cexId,
        name: item.name,
        site_url: '',
        logo_url: item.logo_url,
      };
    });
    setAddressCex(tempObj);
  });

  useMount(() => {
    fetchCexList();
  });

  return {
    addressCex,
    getCexInfoByAddress,
  };
};
