import firebaseAnalytics from '@react-native-firebase/analytics';
import { canTrackUserBehavior } from '@/utils/trackingOptOut';

const firebaseAnalyticsClient = firebaseAnalytics();

export const syncFirebaseAnalyticsCollectionWithOptOut = async () => {
  try {
    await firebaseAnalyticsClient.setAnalyticsCollectionEnabled(
      canTrackUserBehavior(),
    );
  } catch (error) {
    console.error('setAnalyticsCollectionEnabled Error', error);
  }
};

void syncFirebaseAnalyticsCollectionWithOptOut();

/**
 * GA only keeps page views (screen_view); UV comes from GA's automatic
 * session/user metrics. Custom events are intentionally not reported.
 */
export const analytics = {
  logScreenView: async (
    ...args: Parameters<typeof firebaseAnalyticsClient.logScreenView>
  ) => {
    if (!canTrackUserBehavior()) {
      return;
    }
    return firebaseAnalyticsClient.logScreenView(...args);
  },
};
