type SingletonCreateOptions = {
  name: string;
  allowMultipleInstances?: boolean;
  singletonKey?: string;
};

export function makeGlobalBottomSheetSingletonRegistry<
  ModalId extends string,
>() {
  const activeIdsBySingletonKey = new Map<string, ModalId>();

  const getSingletonKey = (options: SingletonCreateOptions) => {
    if (options.allowMultipleInstances) {
      return null;
    }

    return `${options.name}:${options.singletonKey || 'default'}`;
  };

  const getActiveId = (options: SingletonCreateOptions) => {
    const singletonKey = getSingletonKey(options);
    return singletonKey ? activeIdsBySingletonKey.get(singletonKey) : undefined;
  };

  const bindActiveId = (id: ModalId, options: SingletonCreateOptions) => {
    const singletonKey = getSingletonKey(options);
    if (singletonKey) {
      activeIdsBySingletonKey.set(singletonKey, id);
    }
  };

  const releaseId = (id: ModalId) => {
    activeIdsBySingletonKey.forEach((activeId, singletonKey) => {
      if (activeId === id) {
        activeIdsBySingletonKey.delete(singletonKey);
      }
    });
  };

  return {
    getActiveId,
    bindActiveId,
    releaseId,
    clear: () => activeIdsBySingletonKey.clear(),
  };
}
