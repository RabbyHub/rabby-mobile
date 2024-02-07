import firebaseAnalytics from '@react-native-firebase/analytics';

export const analytics = firebaseAnalytics();

// alias name for gaEvent
export const matomoRequestEvent = (data: {
  category: string;
  action: string;
  label?: string;
  value?: number;
  transport?: any;
}) => {
  analytics.logEvent(data.category, data);
};

export const gaEvent = matomoRequestEvent;
