import { CHAINS_ENUM } from '@/constant/chains';
import { apiCustomRPC } from '@/core/apis';
import { RPCItem } from '@/core/services/customRPCService';
import { useMemoizedFn } from 'ahooks';
import { atom, useAtom } from 'jotai';

const customRPCAtom = atom<Partial<Record<CHAINS_ENUM, RPCItem>>>({});

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
