import { atom, useAtom } from 'jotai';

const appLockAtom = atom({
  appUnlocked: false,
});
// /**
//  * @description call this hooks on top of app
//  */
// export function useInitializeOnUnlocked() {
//   const [{ appUnlocked }, setAppLock] = useAtom(appLockAtom);

//   useEffect(() => {
//     const listener = (params) => {
//       setAppLock({ appUnlocked: true });
//     }
//     globalSerivceEvents.on(`srvEvent:unlock`, listener);

//     return () => {
//       globalSerivceEvents.off(`srvEvent:unlock`, listener);
//     }
//   }, [setAppLock]);

//   return { appUnlocked }
// }

export function useIsAppUnlocked() {
  const [{ appUnlocked }] = useAtom(appLockAtom);
  return { isAppUnlocked: appUnlocked };
}

export function useAppUnlocked() {
  const [{ appUnlocked }, setAppLock] = useAtom(appLockAtom);

  return {
    appUnlocked,
    setAppLock,
  };
}
