import { Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';

import { isNonPublicProductionEnv } from '@/constant';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { navigationRef } from '@/utils/navigation';
import { makeOpenHomeRootState } from '@/utils/universalLinkOpenHome';
import { notificationServiceApi } from '@/core/serviceApi/notification';

import { listInjectedStorePins } from '../screenRegistry/storeInjection';
import type { BizMockAction } from './protocol';

const BIZ_MOCK_DUMP_DIRNAME = 'biz-mock';

export type BizMockResult =
  | { ok: true; action: string; code: 'ok'; data?: unknown }
  | { ok: false; action: string; code: string; message: string };

function safeName(value: string | undefined, fallback: string) {
  const normalized = (value || '')
    .replace(/[^\w.-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
  return normalized || fallback;
}

function summarizeApproval(approval: unknown) {
  const data = (approval as any)?.data;
  if (!data) {
    return null;
  }

  const params = data.params;
  const tx = Array.isArray(params?.data) ? params.data[0] : undefined;
  return {
    component: data.approvalComponent ?? data.component ?? null,
    approvalType: data.approvalType ?? null,
    origin:
      data.origin ??
      params?.session?.origin ??
      params?.requestContext?.origin ??
      null,
    method: params?.method ?? null,
    from: tx?.from ?? params?.requestContext?.accountAddress ?? null,
    to: tx?.to ?? null,
    value: tx?.value ?? null,
    chainId: tx?.chainId ?? params?.requestContext?.chainId ?? null,
    dataPrefix: typeof tx?.data === 'string' ? tx.data.slice(0, 10) : null,
  };
}

async function waitForNavigationReady(timeoutMs = 5_000) {
  if (navigationRef.isReady()) {
    return true;
  }

  return new Promise<boolean>(resolve => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (navigationRef.isReady()) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

async function dumpState(name?: string): Promise<BizMockResult> {
  await waitForNavigationReady();

  const route = navigationRef.getCurrentRoute();
  const account = getFallbackAccountSnapshot();
  let approval: unknown = null;
  try {
    approval = await notificationServiceApi.getApproval();
  } catch {
    // Approval service may not be ready during early startup.
  }

  const routeParams =
    route?.params && typeof route.params === 'object'
      ? Object.keys(route.params).sort()
      : [];
  const fileName = safeName(name, 'state');
  const baseDir =
    Platform.OS === 'android'
      ? RNFS.ExternalDirectoryPath
      : RNFS.DocumentDirectoryPath;
  const dir = `${baseDir}/${BIZ_MOCK_DUMP_DIRNAME}`;
  const path = `${dir}/${fileName}.json`;
  const dump = {
    schemaVersion: 1,
    capturedAt: Date.now(),
    platform: Platform.OS,
    env: __DEV__ ? 'debug' : 'regression',
    route: route
      ? {
          name: route.name,
          key: route.key,
          paramKeys: routeParams,
        }
      : null,
    account: account
      ? {
          address: account.address,
          type: account.type,
          brandName: account.brandName,
        }
      : null,
    approval: summarizeApproval(approval),
    storePins: listInjectedStorePins(),
  };

  await RNFS.mkdir(dir);
  await RNFS.writeFile(path, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`[biz-mock] state-dump name=${fileName}`);

  return {
    ok: true,
    action: 'state.dump',
    code: 'ok',
    data: { name: fileName },
  };
}

export async function runBizMockAction(
  action: BizMockAction,
): Promise<BizMockResult> {
  if (!isNonPublicProductionEnv) {
    return {
      ok: false,
      action: action.action,
      code: 'nonprod-required',
      message: 'biz-mock is only available in non-production builds',
    };
  }

  try {
    if (action.action === 'state.dump') {
      return await dumpState(action.name);
    }

    if (action.action === 'screen.resetToHome') {
      if (!navigationRef.isReady()) {
        return {
          ok: false,
          action: action.action,
          code: 'navigation-not-ready',
          message: 'navigation is not ready',
        };
      }
      navigationRef.resetRoot(makeOpenHomeRootState());
      apisHomeTabIndex.setTabIndex(0);
      return { ok: true, action: action.action, code: 'ok' };
    }

    if (action.action === 'screen.open') {
      const { openScreenForDebug } = await import('@/devtools/screenRegistry');
      const opened = await openScreenForDebug({
        screen: action.screen,
        params: action.params,
        paramsFile: action.paramsFile,
        props: action.props,
        store: action.store,
        storePin: action.storePin,
        storePinClear: action.storePinClear,
        push: action.push,
      });
      if (!opened) {
        return {
          ok: false,
          action: action.action,
          code: 'screen-not-opened',
          message: `screen "${action.screen}" was not opened`,
        };
      }
      return { ok: true, action: action.action, code: 'ok' };
    }

    if (action.action === 'modal.close') {
      const { removeAllGlobalBottomSheetModals2024 } = await import(
        '@/components2024/GlobalBottomSheetModal'
      );
      removeAllGlobalBottomSheetModals2024();
      return { ok: true, action: action.action, code: 'ok' };
    }

    return {
      ok: false,
      action: (action as { action: string }).action,
      code: 'unsupported-command',
      message: 'unsupported biz-mock action',
    };
  } catch (error) {
    return {
      ok: false,
      action: action.action,
      code: 'action-failed',
      message: (error as Error)?.message || String(error),
    };
  }
}
