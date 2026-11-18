import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { securePreferences } from '@/core/storage/securePreferences';
import { APP_STORE_NAMES } from '@/core/storage/storeConstant';

const labels = {
  [APP_STORE_NAMES.whitelist]: 'page.securePreferences.whitelist',
  [APP_STORE_NAMES.contactBook]: 'page.securePreferences.contactBook',
  [APP_STORE_NAMES.securityEngine]: 'page.securePreferences.securityEngine',
  [APP_STORE_NAMES.rpc]: 'page.securePreferences.rpc',
} as const;

export function SecurePreferenceNotice() {
  const { t } = useTranslation();

  useEffect(() => {
    let frame: number | undefined;
    let showing = false;
    let disposed = false;
    const acknowledged = new Set<string>();

    const scheduleNotice = () => {
      if (disposed || showing || frame !== undefined) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (AppState.currentState !== 'active') {
          return;
        }

        const issues = securePreferences
          .getIssues()
          .filter(issue => !acknowledged.has(`${issue.kind}:${issue.name}`));
        if (!issues.length) {
          return;
        }
        const kind = issues.some(issue => issue.kind === 'damaged')
          ? 'damaged'
          : 'unavailable';
        const batch = issues.filter(issue => issue.kind === kind);
        const settings = batch.map(issue => t(labels[issue.name])).join('\n');
        const damaged = kind === 'damaged';
        showing = true;
        Alert.alert(
          t(
            damaged
              ? 'page.securePreferences.damagedTitle'
              : 'page.securePreferences.unavailableTitle',
          ),
          `${t(
            damaged
              ? 'page.securePreferences.damagedDescription'
              : 'page.securePreferences.unavailableDescription',
          )}\n\n${settings}`,
          [
            {
              text: t(damaged ? 'page.securePreferences.reset' : 'global.ok'),
              onPress: async () => {
                batch.forEach(issue =>
                  acknowledged.add(`${issue.kind}:${issue.name}`),
                );
                if (damaged) {
                  await securePreferences.reset(batch.map(issue => issue.name));
                }
                showing = false;
                scheduleNotice();
              },
            },
          ],
          { cancelable: false },
        );
      });
    };

    const unsubscribe = securePreferences.subscribe(scheduleNotice);
    const appState = AppState.addEventListener('change', scheduleNotice);
    scheduleNotice();
    return () => {
      disposed = true;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      unsubscribe();
      appState.remove();
    };
  }, [t]);

  return null;
}
