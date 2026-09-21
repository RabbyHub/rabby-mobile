import StatsReport, { SITE } from '@debank/festats';
import { canTrackUserBehavior } from '@/utils/trackingOptOut';

export const stats = new StatsReport(SITE.rabbyMobile);

const _report = stats.report;

stats.report = (...args) => {
  if (!canTrackUserBehavior()) {
    return;
  }

  console.debug('[stats report]: ', ...args);
  return _report(...args);
};
