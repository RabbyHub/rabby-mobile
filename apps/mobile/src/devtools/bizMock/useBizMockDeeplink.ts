import { useEffect } from 'react';
import { Linking } from 'react-native';

import { isNonPublicProductionEnv } from '@/constant';

import { parseBizMockAction } from './protocol';

async function handleBizMockLink(appLink: string) {
  const parsed = parseBizMockAction(appLink);
  if (!parsed.matched) {
    return;
  }

  const meta = [
    parsed.meta.runId ? `runId=${parsed.meta.runId}` : '',
    parsed.meta.suiteId ? `suite=${parsed.meta.suiteId}` : '',
    parsed.meta.step ? `step=${parsed.meta.step}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  console.log(`[biz-mock] command-received ${meta}`.trim());

  if (parsed.error || !parsed.action) {
    console.warn(
      `[biz-mock] command-failed ${meta} code=${
        parsed.error?.code || 'invalid-command'
      }`,
    );
    return;
  }

  const { runBizMockAction } = await import('./actions');
  const result = await runBizMockAction(parsed.action);
  if (result.ok) {
    console.log(`[biz-mock] ready ${meta} action=${result.action}`.trim());
    return;
  }

  console.warn(
    `[biz-mock] command-failed ${meta} action=${result.action} code=${result.code}`.trim(),
  );
}

/**
 * Independent `rabbymock-*` protocol listener.
 *
 * This deliberately does not share parsing with `rabbygo-*`: the mock protocol
 * only carries atomic test actions and is never registered in production.
 */
export function useBizMockDeeplink() {
  useEffect(() => {
    if (!isNonPublicProductionEnv) {
      return;
    }

    let disposed = false;
    void Linking.getInitialURL().then(url => {
      if (!disposed && url) {
        void handleBizMockLink(url);
      }
    });

    const subscription = Linking.addEventListener('url', event => {
      void handleBizMockLink(event.url);
    });

    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
}
