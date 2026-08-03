import { atom, useAtom } from 'jotai';

const scannerTextAtom = atom<string | undefined>(undefined);

export const useScanner = () => {
  const [text, setText] = useAtom(scannerTextAtom);

  const clear = () => setText(undefined);

  return { text, setText, clear };
};
