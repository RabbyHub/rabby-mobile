import { atom, useAtomValue, useSetAtom } from 'jotai';

const oneKeyCheckBlePendingAtom = atom(false);
const ledgerCheckBlePendingAtom = atom(false);

export const useSetHardWareWalletSignBleStatus = () => {
  const setOneKeyCheckBlePending = useSetAtom(oneKeyCheckBlePendingAtom);
  const setLedgerCheckBlePending = useSetAtom(ledgerCheckBlePendingAtom);
  return {
    setOneKeyCheckBlePending,
    setLedgerCheckBlePending,
  };
};

export const useHardwareWalletMiniSignBleStatus = () => {
  const oneKeyCheckBlePending = useAtomValue(oneKeyCheckBlePendingAtom);
  const ledgerCheckBlePending = useAtomValue(ledgerCheckBlePendingAtom);
  return {
    oneKeyCheckBlePending,
    ledgerCheckBlePending,
  };
};
