import { subscribeUserVisibleJsWork } from '@/core/utils/userVisibleJsWork';

import { setSyncSchedulerCriticalMode } from './scheduler';

const USER_VISIBLE_WORK_CRITICAL_REASON = 'user_visible_js_work';

export function startUserVisibleWorkSyncSchedulerBridge() {
  let isCritical = false;

  const unsubscribe = subscribeUserVisibleJsWork(snapshot => {
    const nextIsCritical = snapshot.activeCount > 0;
    if (nextIsCritical === isCritical) {
      return;
    }

    isCritical = nextIsCritical;
    setSyncSchedulerCriticalMode(
      nextIsCritical,
      USER_VISIBLE_WORK_CRITICAL_REASON,
    );
  });

  return () => {
    unsubscribe();
    if (isCritical) {
      isCritical = false;
      setSyncSchedulerCriticalMode(false, USER_VISIBLE_WORK_CRITICAL_REASON);
    }
  };
}
