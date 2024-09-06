import { CHAINS_ENUM } from '@/constant/chains';
import { apiCustomRPC } from '@/core/apis';
import { RPCItem } from '@/core/services/customRPCService';
import { useMemoizedFn, useRequest } from 'ahooks';
import { atom, useAtom } from 'jotai';
import { useMemo } from 'react';

const customRPCAtom = atom<Partial<Record<CHAINS_ENUM, RPCItem>>>({});
const customRPCStatusAtom = atom<
  Partial<Record<CHAINS_ENUM, 'success' | 'error' | undefined>>
>({});

export const useCustomRPC = () => {
  const [customRPCStore, setCustomRPCStore] = useAtom(customRPCAtom);

  const getAllRPC = useMemoizedFn(async () => {
    const rpcMap = await apiCustomRPC.getAllCustomRPC();
    setCustomRPCStore(rpcMap);
    return rpcMap;
  });

  const setCustomRPC = useMemoizedFn(
    async (payload: { chain: CHAINS_ENUM; url: string }) => {
      await apiCustomRPC.setCustomRPC(payload.chain, payload.url);
      getAllRPC();
    },
  );

  const setRPCEnable = useMemoizedFn(
    async (payload: { chain: CHAINS_ENUM; enable: boolean }) => {
      await apiCustomRPC.setRPCEnable(payload.chain, payload.enable);
      getAllRPC();
    },
  );

  const deleteCustomRPC = useMemoizedFn(async (chain: CHAINS_ENUM) => {
    await apiCustomRPC.removeCustomRPC(chain);
    getAllRPC();
  });

  return {
    customRPCStore,
    getAllRPC,
    setCustomRPC,
    setRPCEnable,
    deleteCustomRPC,
  };
};

export const useCustomRPCStatus = (chainEnum?: CHAINS_ENUM) => {
  const { customRPCStore } = useCustomRPC();
  const [customRPCStatus, setCustomRPCStatus] = useAtom(customRPCStatusAtom);
  const hasCustomRPC = useMemo(() => {
    return chainEnum && customRPCStore[chainEnum]?.enable;
  }, [chainEnum, customRPCStore]);

  useRequest(
    async () => {
      if (!chainEnum || !hasCustomRPC) {
        return;
      }
      const isAvailable = await apiCustomRPC.pingCustomRPC(chainEnum);
      return isAvailable ? 'success' : 'error';
    },
    {
      refreshDeps: [chainEnum, hasCustomRPC],
      onSuccess: status => {
        if (!chainEnum) {
          return;
        }
        setCustomRPCStatus(prev => ({
          ...prev,
          [chainEnum]: status,
        }));
      },
    },
  );

  return chainEnum ? customRPCStatus[chainEnum] : undefined;
};
