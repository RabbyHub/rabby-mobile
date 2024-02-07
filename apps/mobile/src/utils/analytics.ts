import firebaseAnalytics from '@react-native-firebase/analytics';

export const analytics = firebaseAnalytics();

// alias name for gaEvent
export const matomoRequestEvent = async (data: {
  category: string;
  action: string;
  label?: string;
  value?: number;
  transport?: any;
}) => {
  try {
    await analytics.logEvent(data.category, data);
  } catch (e) {
    console.error('gaEvent Error', e);
  }
};

export const gaEvent = matomoRequestEvent;
