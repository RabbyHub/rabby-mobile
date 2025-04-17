import StatsReport, { SITE } from '@debank/festats';

export const stats = new StatsReport(SITE.rabbyMobile);

const _report = stats.report;

stats.report = (...args) => {
  console.debug('[stats report]: ', ...args);
  return _report(...args);
};
