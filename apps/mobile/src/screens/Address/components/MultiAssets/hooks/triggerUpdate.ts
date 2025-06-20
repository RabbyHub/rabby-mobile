import { atom, useAtom } from 'jotai';

export const triggerUpdateAtom = atom(false);

export const useTriggerUpdate = () => {
  const [triggerUpdate, setTriggerUpdate] = useAtom(triggerUpdateAtom);

  return {
    triggerUpdate,
    setTriggerUpdate,
  };
};
