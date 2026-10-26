import { traceAndroidInstant } from './core/utils/androidTrace';
import { getConvertDustBannerVisitedSnapshot } from './screens/Home/hooks/convertDustBannerStorage';

export function warmHomePreSplashLocalState() {
  const convertDustBannerVisited = getConvertDustBannerVisitedSnapshot();
  traceAndroidInstant('home_pre_splash.local_state_snapshot', {
    convertDustBannerVisited,
  });
}
