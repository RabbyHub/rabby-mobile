import { Platform } from 'react-native';
import RNFS from '@rabby-wallet/react-native-fs';

import { isNonPublicProductionEnv } from '@/constant';
import { apisHomeTabIndex } from '@/hooks/navigation';
import { getFallbackAccountSnapshot } from '@/core/serviceApi/preference';
import { navigationRef } from '@/utils/navigation';
import { makeOpenHomeRootState } from '@/utils/universalLinkOpenHome';
import {
  notificationServiceApi,
  rejectAllNotificationApprovalsSync,
  unlockNotificationSync,
} from '@/core/serviceApi/notification';

import {
  clearInjectedStorePins,
  listInjectedStorePins,
  pinInjectedStore,
} from '../screenRegistry/storeInjection';
import { setAllowAnyApproval } from '../screenRegistry/requestCapture';
import { runTestAccountsImport } from '../testAccountsImport';
import { TEST_ACCOUNTS_FILENAME } from '../testAccountsPath';
import { listBizMockActions } from './actionRegistry';
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

function bizMockBaseDir() {
  return Platform.OS === 'android'
    ? RNFS.ExternalDirectoryPath
    : RNFS.DocumentDirectoryPath;
}

async function readMockFixture(file: string) {
  const name = safeName(file.replace(/\.json$/i, ''), 'fixture');
  const path = `${bizMockBaseDir()}/biz-mock-fixtures/${name}.json`;
  const raw = await RNFS.readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  const params = parsed?.params ?? parsed;
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error(`fixture "${file}" has no params object`);
  }
  return params as Record<string, unknown>;
}

async function importAccountsFromFile(file?: string): Promise<BizMockResult> {
  if (file && file !== TEST_ACCOUNTS_FILENAME) {
    return {
      ok: false,
      action: 'account.importFromFile',
      code: 'unsupported-file',
      message: `only ${TEST_ACCOUNTS_FILENAME} is supported`,
    };
  }

  const result = await runTestAccountsImport({ path: '' });
  if (!result.ok) {
    return {
      ok: false,
      action: 'account.importFromFile',
      code: result.code || 'import-failed',
      message: `imported=${result.imported} failed=${result.failed}`,
    };
  }

  return {
    ok: true,
    action: 'account.importFromFile',
    code: 'ok',
    data: {
      imported: result.imported,
      privateKeys: result.privateKeys,
      mnemonics: result.mnemonics,
      rejected: result.rejected,
      failed: result.failed,
      addresses: result.addresses,
    },
  };
}

async function selectAccount(address: string): Promise<BizMockResult> {
  const input = address.toLowerCase().trim();
  const [{ getAllAccountsToDisplay }, { setCurrentAccount }] =
    await Promise.all([
      import('@/core/apis/account'),
      import('@/core/serviceApi/preference'),
    ]);
  const accounts = await getAllAccountsToDisplay();
  const match = accounts.find(account => {
    const current = String(account.address || '').toLowerCase();
    if (current === input) {
      return true;
    }
    const [prefix, suffix] = input.split('...');
    return Boolean(
      prefix &&
        suffix &&
        current.startsWith(prefix) &&
        current.endsWith(suffix),
    );
  });
  if (!match) {
    return {
      ok: false,
      action: 'account.select',
      code: 'account-not-found',
      message: `account not found: ${address}`,
    };
  }

  await setCurrentAccount(match as any);
  return {
    ok: true,
    action: 'account.select',
    code: 'ok',
    data: { address: match.address, brandName: match.brandName },
  };
}

async function removeTestAccount(address: string): Promise<BizMockResult> {
  const input = address.toLowerCase().trim();
  const [{ getAllAccountsToDisplay }, { removeAddress }] = await Promise.all([
    import('@/core/apis/account'),
    import('@/core/apis/address'),
  ]);
  const accounts = await getAllAccountsToDisplay();
  if (accounts.length <= 1) {
    return {
      ok: false,
      action: 'account.remove',
      code: 'last-account',
      message: 'refusing to remove the only remaining account',
    };
  }
  const match = accounts.find(
    account => String(account.address || '').toLowerCase() === input,
  );
  if (!match) {
    return {
      ok: false,
      action: 'account.remove',
      code: 'account-not-found',
      message: `account not found: ${address}`,
    };
  }
  await removeAddress(match as any);
  return {
    ok: true,
    action: 'account.remove',
    code: 'ok',
    data: { address: match.address, type: match.type },
  };
}

async function createTestWallet(): Promise<BizMockResult> {
  const [
    { prepareWalletCreation, completeWalletCreation },
    { default: accountStore },
    { REGRESSION_DEFAULT_PASSWORD },
    { apisHomeTabIndex },
  ] = await Promise.all([
    import('@/hooks/address/useSetupWallet'),
    import('@/store/account'),
    import('@/devtools/regressionScenarios/credentials.nonprod'),
    import('@/hooks/navigation'),
  ]);
  const prepared = await prepareWalletCreation({ mode: 'create' });
  await completeWalletCreation(prepared, {
    password: REGRESSION_DEFAULT_PASSWORD,
    confirmPassword: REGRESSION_DEFAULT_PASSWORD,
    checked: true,
    enableBiometrics: false,
  } as any);
  await accountStore.fetchAccounts({ force: true });
  apisHomeTabIndex.setTabIndex(1, true);
  return {
    ok: true,
    action: 'account.create',
    code: 'ok',
    data: { address: prepared.address || null },
  };
}

async function injectApprovalFromFile(
  file: string,
  component = 'SignTx',
  origin?: string,
): Promise<BizMockResult> {
  const account = getFallbackAccountSnapshot();
  if (!account) {
    return {
      ok: false,
      action: 'approval.injectFromFile',
      code: 'account-not-ready',
      message: 'no current account',
    };
  }

  const params = await readMockFixture(file);
  // An injected approval has no live dapp tab to match. Mark the request as
  // an allowed non-production approval so the approval sheet does not collapse
  // into its "No approve found" dapp-disappeared state.
  setAllowAnyApproval(true);
  try {
    await notificationServiceApi.clear();
  } catch {
    // A stale modal handle should not block a new request.
  }
  unlockNotificationSync();

  let pending: Promise<unknown>;
  try {
    pending = notificationServiceApi.requestApproval({
      approvalComponent: component,
      params,
      account: account as any,
      origin: origin || 'https://opensea.io',
      approvalType: component,
    } as any);
  } catch (error) {
    return {
      ok: false,
      action: 'approval.injectFromFile',
      code: 'approval-request-failed',
      message: (error as Error)?.message || String(error),
    };
  }

  void Promise.resolve(pending)
    .then(() => unlockNotificationSync())
    .catch(error => {
      console.warn('[biz-mock] approval request failed', error);
      try {
        unlockNotificationSync();
      } catch {
        // ignore
      }
    });

  return {
    ok: true,
    action: 'approval.injectFromFile',
    code: 'ok',
    data: { component, origin: origin || 'https://opensea.io' },
  };
}

async function dumpApproval(name?: string): Promise<BizMockResult> {
  let approval: unknown = null;
  try {
    approval = await notificationServiceApi.getApproval();
  } catch {
    // Approval service may not be ready during early startup.
  }
  const summary = summarizeApproval(approval);
  const fileName = safeName(name, 'approval');
  const dir = `${bizMockBaseDir()}/${BIZ_MOCK_DUMP_DIRNAME}`;
  const path = `${dir}/${fileName}.json`;
  await RNFS.mkdir(dir);
  await RNFS.writeFile(
    path,
    JSON.stringify(
      { schemaVersion: 1, capturedAt: Date.now(), approval: summary },
      null,
      2,
    ),
    'utf8',
  );
  return {
    ok: true,
    action: 'approval.dump',
    code: 'ok',
    data: { name: fileName, approval: summary },
  };
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
  const baseDir = bizMockBaseDir();
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
    bizMockActions: listBizMockActions(),
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

    if (action.action === 'account.importFromFile') {
      return await importAccountsFromFile(action.file);
    }

    if (action.action === 'account.select') {
      return await selectAccount(action.address);
    }

    if (action.action === 'account.remove') {
      return await removeTestAccount(action.address);
    }

    if (action.action === 'account.create') {
      return await createTestWallet();
    }

    if (action.action === 'approval.injectFromFile') {
      return await injectApprovalFromFile(
        action.file,
        action.component,
        action.origin,
      );
    }

    if (action.action === 'approval.dump') {
      return await dumpApproval(action.name);
    }

    if (action.action === 'approval.rejectAll') {
      setAllowAnyApproval(false);
      rejectAllNotificationApprovalsSync();
      // `rejectAllApprovals` clears the queue but keeps the notification
      // window id, so the sheet stays on screen. `clear` removes that window.
      try {
        await notificationServiceApi.clear();
      } catch {
        // The service may already be empty.
      }
      try {
        const { closeApprovalPopup } = await import('@/hooks/useApprovalPopup');
        closeApprovalPopup();
      } catch {
        // The popup host may not be mounted (e.g. early startup).
      }
      return { ok: true, action: action.action, code: 'ok' };
    }

    if (action.action === 'action.invoke') {
      const { invokeBizMockAction } = await import('./actionRegistry');
      const invoked = await invokeBizMockAction({
        id: action.id,
        testID: action.testID,
        payload: action.payload as Record<string, unknown> | undefined,
        timeoutMs: action.timeoutMs,
      });
      if (!invoked.ok) {
        return {
          ok: false,
          action: action.action,
          code: invoked.code,
          message: invoked.message,
        };
      }
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: invoked.data,
      };
    }

    if (action.action === 'home.openSingleAddress') {
      const account = getFallbackAccountSnapshot();
      if (!account) {
        return {
          ok: false,
          action: action.action,
          code: 'account-not-ready',
          message: 'no current account',
        };
      }
      const { apisSingleHome } = await import(
        '@/screens/Home/hooks/singleHome'
      );
      apisSingleHome.navigateToSingleHome(account as any);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { address: account.address },
      };
    }

    if (action.action === 'store.pin') {
      await pinInjectedStore(action.store);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { pins: listInjectedStorePins() },
      };
    }

    if (action.action === 'store.clearPins') {
      clearInjectedStorePins();
      return { ok: true, action: action.action, code: 'ok' };
    }

    if (action.action === 'dapp.tabs') {
      const { browserApis, getBrowserTabsSnapshot } = await import(
        '@/hooks/browser/useBrowser'
      );
      if (action.op === 'closeAll' || action.op === 'close-all') {
        browserApis.closeAllTabs();
      } else if (action.op === 'activate') {
        const match = action.match || '';
        const tab = getBrowserTabsSnapshot().tabs.find(item =>
          String(item.initialUrl || item.url || '').includes(match),
        );
        if (!tab) {
          return {
            ok: false,
            action: action.action,
            code: 'tab-not-found',
            message: `no browser tab matching ${match}`,
          };
        }
        browserApis.switchToTab(tab.id);
      }

      const snapshot = getBrowserTabsSnapshot();
      const fileName = safeName(action.name, 'dapp-tabs');
      const dir = `${bizMockBaseDir()}/${BIZ_MOCK_DUMP_DIRNAME}`;
      const path = `${dir}/${fileName}.json`;
      const tabs = snapshot.tabs.map(tab => ({
        id: tab.id,
        url: tab.initialUrl || tab.url,
        isDapp: tab.isDapp,
      }));
      await RNFS.mkdir(dir);
      await RNFS.writeFile(
        path,
        JSON.stringify(
          {
            schemaVersion: 1,
            capturedAt: Date.now(),
            activeTabId: snapshot.activeTabId,
            tabs,
          },
          null,
          2,
        ),
        'utf8',
      );
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { name: fileName, activeTabId: snapshot.activeTabId, tabs },
      };
    }

    if (action.action === 'dapp.eval') {
      let code = action.code;
      if (!code && action.file) {
        const name = safeName(action.file.replace(/\.js$/i, ''), 'eval');
        code = await RNFS.readFile(
          `${bizMockBaseDir()}/biz-mock-fixtures/${name}.js`,
          'utf8',
        );
      }
      if (!code) {
        return {
          ok: false,
          action: action.action,
          code: 'missing-param',
          message: 'code or file is required',
        };
      }
      const { emitBrowserEval } = await import(
        '@/devtools/screenRegistry/browserEval'
      );
      emitBrowserEval(code);
      return { ok: true, action: action.action, code: 'ok' };
    }

    if (action.action === 'dapp.disconnect') {
      const { removeDapp } = await import('@/core/apis/dapp');
      await removeDapp(action.origin);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { origin: action.origin },
      };
    }

    if (action.action === 'history.openLocalDetail') {
      const account = getFallbackAccountSnapshot();
      const address = (action.address || account?.address || '')
        .toLowerCase()
        .trim();
      if (!address) {
        return {
          ok: false,
          action: action.action,
          code: 'account-not-ready',
          message: 'no address',
        };
      }
      const { getTransactionHistoryListSnapshot } = await import(
        '@/core/serviceApi/transactionHistory'
      );
      const list = getTransactionHistoryListSnapshot(address);
      const group = list.completeds[0] || list.pendings[0];
      if (!group) {
        return {
          ok: false,
          action: action.action,
          code: 'history-empty',
          message: `no local history for ${address}`,
        };
      }
      const actionData = (group as any).maxGasTx?.action?.actionData;
      const type = actionData?.swap
        ? 'swap'
        : actionData?.send
        ? 'send'
        : actionData?.approveToken
        ? 'approve'
        : actionData?.revokeToken
        ? 'revoke'
        : undefined;
      const [{ naviPush }, { RootNames }] = await Promise.all([
        import('@/utils/navigation'),
        import('@/constant/layout'),
      ]);
      naviPush(RootNames.StackTransaction, {
        screen: RootNames.HistoryLocalDetail,
        params: {
          data: group,
          type,
          isForMultipleAddress: false,
          account,
        },
      } as any);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: {
          address,
          type: type || null,
          txHash:
            (group as any).maxGasTx?.hash || (group as any).maxTx?.hash || null,
        },
      };
    }

    if (action.action === 'history.seedLocalTx') {
      const account = getFallbackAccountSnapshot();
      if (!account?.address) {
        return {
          ok: false,
          action: action.action,
          code: 'account-not-ready',
          message: 'no current account',
        };
      }
      const { default: BigNumber } = await import('bignumber.js');
      const [{ findChain }, { transactionHistoryServiceApi }] =
        await Promise.all([
          import('@/utils/chain'),
          import('@/core/serviceApi/transactionHistory'),
        ]);
      const chain = findChain({ id: 1 });
      const nativeTokenId = chain?.nativeTokenAddress || 'eth';
      const amount = new BigNumber(action.amount || '0.0001');
      const rawAmount = amount.times(1e18).toFixed(0);
      const to = '0x000000000000000000000000000000000000dEaD';
      const hash = `0x${Array.from({ length: 64 })
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join('')}`;
      const now = Math.floor(Date.now() / 1000);
      transactionHistoryServiceApi.addTx({
        id: `bizmock-${Date.now()}`,
        hash,
        address: account.address,
        from: account.address,
        to,
        value: rawAmount,
        chainId: 1,
        nonce: 0,
        gas: '0x5208',
        gasPrice: '0x1',
        status: 'success',
        isPending: false,
        isCompleted: true,
        isSubmitFailed: false,
        isSynced: false,
        time_at: now,
        rawTx: {
          from: account.address,
          to,
          value: rawAmount,
          chainId: 1,
          nonce: 0,
          gas: '0x5208',
          gasPrice: '0x1',
        },
        action: {
          actionData: {
            send: {
              to,
              token: {
                id: nativeTokenId,
                symbol: 'ETH',
                decimals: 18,
                raw_amount: rawAmount,
                price: 3000,
                logo_url: '',
              },
            },
          },
          requiredData: {},
        },
        explain: { balance_change: [], pre_exec_version: 'v0' },
        tokenDict: {},
        projectDict: {},
        cateDict: {},
      } as any);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { address: account.address, hash, amount: amount.toFixed() },
      };
    }

    if (action.action === 'env.setScreenE2E') {
      const { storeApiExpSettingData } = await import('@/hooks/appSettings');
      storeApiExpSettingData.setScreenE2EEnabled(action.enabled);
      return {
        ok: true,
        action: action.action,
        code: 'ok',
        data: { enabled: action.enabled },
      };
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
      try {
        const { closeApprovalPopup } = await import('@/hooks/useApprovalPopup');
        closeApprovalPopup();
      } catch {
        // The approval popup host may not be mounted.
      }
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
