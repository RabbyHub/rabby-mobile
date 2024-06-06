import { globalSerivceEvents } from '@/core/apis/serviceEvent';
import { atom, useAtom } from 'jotai';
import { useEffect } from 'react';

export const appLockAtom = atom({
  appUnlocked: false,
});
// /**
//  * @description call this hooks on top of app
//  */
// export function useInitializeOnUnlocked() {
//   const [{ appUnlocked }, setAppLock] = useAtom(appLockAtom);

//   useEffect(() => {
//     const listener = (params) => {
//       console.log('[feat] useInitializeOnUnlocked:: params', params);
//       setAppLock({ appUnlocked: true });
//     }
//     globalSerivceEvents.on(`srvEvent:unlock`, listener);

//     return () => {
//       globalSerivceEvents.off(`srvEvent:unlock`, listener);
//     }
//   }, [setAppLock]);

//   return { appUnlocked }
// }

export function useAppUnlocked() {
  const [{ appUnlocked }] = useAtom(appLockAtom);
  return appUnlocked;
}
