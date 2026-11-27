import { urlUtils } from '@rabby-wallet/base-utils';

import { isNonPublicProductionEnv } from '@/constant';

const BIZ_MOCK_HOST = 'go.rabby.io';
const BIZ_MOCK_PATH_PREFIX = '/mobile-mock/';
const MAX_INLINE_JSON_BYTES = 16 * 1024;

type JsonObject = Record<string, unknown>;

export type BizMockAction =
  | {
      action: 'screen.open';
      screen: string;
      params?: JsonObject;
      paramsFile?: string;
      props?: JsonObject;
      store?: JsonObject;
      storePin?: JsonObject;
      storePinClear?: boolean;
      push?: boolean;
    }
  | { action: 'screen.resetToHome' }
  | { action: 'modal.close' }
  | { action: 'state.dump'; name?: string }
  | { action: 'account.importFromFile'; file?: string }
  | { action: 'account.select'; address: string }
  | { action: 'account.remove'; address: string }
  | { action: 'account.create' }
  | {
      action: 'approval.injectFromFile';
      file: string;
      component?: string;
      origin?: string;
    }
  | { action: 'approval.dump'; name?: string }
  | { action: 'approval.rejectAll' }
  | {
      action: 'action.invoke';
      id?: string;
      testID?: string;
      payload?: JsonObject;
      timeoutMs?: number;
    }
  | { action: 'home.openSingleAddress' }
  | { action: 'store.pin'; store: JsonObject }
  | { action: 'store.clearPins' }
  | { action: 'dapp.tabs'; op?: string; match?: string; name?: string }
  | { action: 'dapp.eval'; code?: string; file?: string }
  | { action: 'dapp.disconnect'; origin: string }
  | { action: 'history.openLocalDetail'; address?: string }
  | { action: 'env.setScreenE2E'; enabled: boolean };

export type BizMockMeta = {
  runId?: string;
  suiteId?: string;
  step?: string;
};

export type BizMockParseResult =
  | {
      matched: true;
      action?: BizMockAction;
      meta: BizMockMeta;
      error?: { code: string; message: string };
    }
  | { matched: false };

type BizMockProtocolConfig = {
  protocol: string;
  hostname: string;
  pathPrefix: string;
};

function getCurrentProtocolConfig(): BizMockProtocolConfig | null {
  if (!isNonPublicProductionEnv) {
    return null;
  }

  return {
    protocol: __DEV__ ? 'rabbymock-debug:' : 'rabbymock-regression:',
    hostname: BIZ_MOCK_HOST,
    pathPrefix: BIZ_MOCK_PATH_PREFIX,
  };
}

function readString(value: string | null, maxLength = 256): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, maxLength);
}

function readBoolean(value: string | null) {
  return ['1', 'true', 'yes'].includes((value || '').toLowerCase());
}

function parseJsonObject(
  raw: string | null,
  key: string,
): { value?: JsonObject; error?: { code: string; message: string } } {
  if (!raw) {
    return {};
  }
  if (raw.length > MAX_INLINE_JSON_BYTES) {
    return {
      error: {
        code: 'payload-too-large',
        message: `${key} exceeds inline JSON limit`,
      },
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        error: {
          code: 'invalid-json',
          message: `${key} must be a JSON object`,
        },
      };
    }
    return { value: parsed as JsonObject };
  } catch {
    return {
      error: {
        code: 'invalid-json',
        message: `${key} is not valid JSON`,
      },
    };
  }
}

function readMeta(
  urlInfo: NonNullable<ReturnType<typeof urlUtils.safeParseURL>>,
) {
  return {
    runId: readString(urlInfo.searchParams.get('runId'), 128),
    suiteId: readString(urlInfo.searchParams.get('suiteId'), 128),
    step: readString(urlInfo.searchParams.get('step'), 32),
  };
}

export function parseBizMockAction(
  appLink: string,
  config: BizMockProtocolConfig | null = getCurrentProtocolConfig(),
): BizMockParseResult {
  if (!config) {
    return { matched: false };
  }

  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return { matched: false };
  }

  if (
    urlInfo.protocol !== config.protocol ||
    urlInfo.hostname !== config.hostname ||
    !urlInfo.pathname.startsWith(config.pathPrefix)
  ) {
    return { matched: false };
  }

  const meta = readMeta(urlInfo);
  const command = readString(urlInfo.searchParams.get('_cmd'), 64);

  if (!command) {
    return {
      matched: true,
      meta,
      error: {
        code: 'missing-command',
        message: '_cmd is required',
      },
    };
  }

  if (command === 'screen.open') {
    const screen = readString(urlInfo.searchParams.get('screen'), 128);
    if (!screen) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'screen is required for screen.open',
        },
      };
    }

    const params = parseJsonObject(
      urlInfo.searchParams.get('params'),
      'params',
    );
    if (params.error) {
      return { matched: true, meta, error: params.error };
    }
    const props = parseJsonObject(urlInfo.searchParams.get('props'), 'props');
    if (props.error) {
      return { matched: true, meta, error: props.error };
    }
    const store = parseJsonObject(urlInfo.searchParams.get('store'), 'store');
    if (store.error) {
      return { matched: true, meta, error: store.error };
    }
    const storePin = parseJsonObject(
      urlInfo.searchParams.get('storePin'),
      'storePin',
    );
    if (storePin.error) {
      return { matched: true, meta, error: storePin.error };
    }

    return {
      matched: true,
      meta,
      action: {
        action: 'screen.open',
        screen,
        params: params.value,
        paramsFile: readString(urlInfo.searchParams.get('paramsFile'), 128),
        props: props.value,
        store: store.value,
        storePin: storePin.value,
        storePinClear: readBoolean(urlInfo.searchParams.get('storePinClear')),
        push: readBoolean(urlInfo.searchParams.get('push')),
      },
    };
  }

  if (command === 'screen.resetToHome') {
    return { matched: true, meta, action: { action: 'screen.resetToHome' } };
  }

  if (command === 'modal.close') {
    return { matched: true, meta, action: { action: 'modal.close' } };
  }

  if (command === 'state.dump') {
    return {
      matched: true,
      meta,
      action: {
        action: 'state.dump',
        name: readString(urlInfo.searchParams.get('name'), 80),
      },
    };
  }

  if (command === 'account.importFromFile') {
    return {
      matched: true,
      meta,
      action: {
        action: 'account.importFromFile',
        file: readString(urlInfo.searchParams.get('file'), 128),
      },
    };
  }

  if (command === 'account.select') {
    const address = readString(urlInfo.searchParams.get('address'), 128);
    if (!address) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'address is required for account.select',
        },
      };
    }
    return {
      matched: true,
      meta,
      action: { action: 'account.select', address },
    };
  }

  if (command === 'account.remove') {
    const address = readString(urlInfo.searchParams.get('address'), 128);
    if (!address) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'address is required for account.remove',
        },
      };
    }
    return {
      matched: true,
      meta,
      action: { action: 'account.remove', address },
    };
  }

  if (command === 'account.create') {
    return { matched: true, meta, action: { action: 'account.create' } };
  }

  if (command === 'approval.injectFromFile') {
    const file = readString(urlInfo.searchParams.get('file'), 128);
    if (!file) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'file is required for approval.injectFromFile',
        },
      };
    }
    return {
      matched: true,
      meta,
      action: {
        action: 'approval.injectFromFile',
        file,
        component: readString(urlInfo.searchParams.get('component'), 64),
        origin: readString(urlInfo.searchParams.get('origin'), 512),
      },
    };
  }

  if (command === 'approval.dump') {
    return {
      matched: true,
      meta,
      action: {
        action: 'approval.dump',
        name: readString(urlInfo.searchParams.get('name'), 80),
      },
    };
  }

  if (command === 'approval.rejectAll') {
    return { matched: true, meta, action: { action: 'approval.rejectAll' } };
  }

  if (command === 'action.invoke') {
    const id = readString(urlInfo.searchParams.get('id'), 128);
    const testID = readString(urlInfo.searchParams.get('testID'), 128);
    if (!id && !testID) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'id or testID is required for action.invoke',
        },
      };
    }
    const payload = parseJsonObject(
      urlInfo.searchParams.get('payload'),
      'payload',
    );
    if (payload.error) {
      return { matched: true, meta, error: payload.error };
    }
    const rawTimeout = readString(urlInfo.searchParams.get('timeoutMs'), 16);
    const parsedTimeout = rawTimeout ? Number(rawTimeout) : undefined;
    return {
      matched: true,
      meta,
      action: {
        action: 'action.invoke',
        id,
        testID,
        payload: payload.value,
        timeoutMs:
          parsedTimeout !== undefined && Number.isFinite(parsedTimeout)
            ? parsedTimeout
            : undefined,
      },
    };
  }

  if (command === 'home.openSingleAddress') {
    return {
      matched: true,
      meta,
      action: { action: 'home.openSingleAddress' },
    };
  }

  if (command === 'store.pin') {
    const store = parseJsonObject(urlInfo.searchParams.get('store'), 'store');
    if (store.error) {
      return { matched: true, meta, error: store.error };
    }
    if (!store.value || !Object.keys(store.value).length) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'store is required for store.pin',
        },
      };
    }
    return {
      matched: true,
      meta,
      action: { action: 'store.pin', store: store.value },
    };
  }

  if (command === 'store.clearPins') {
    return { matched: true, meta, action: { action: 'store.clearPins' } };
  }

  if (command === 'dapp.tabs') {
    return {
      matched: true,
      meta,
      action: {
        action: 'dapp.tabs',
        op: readString(urlInfo.searchParams.get('op'), 32),
        match: readString(urlInfo.searchParams.get('match'), 512),
        name: readString(urlInfo.searchParams.get('name'), 80),
      },
    };
  }

  if (command === 'dapp.eval') {
    const code = readString(urlInfo.searchParams.get('code'), 4096);
    const file = readString(urlInfo.searchParams.get('file'), 128);
    if (!code && !file) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'code or file is required for dapp.eval',
        },
      };
    }
    return { matched: true, meta, action: { action: 'dapp.eval', code, file } };
  }

  if (command === 'dapp.disconnect') {
    const origin = readString(urlInfo.searchParams.get('origin'), 512);
    if (!origin) {
      return {
        matched: true,
        meta,
        error: {
          code: 'missing-param',
          message: 'origin is required for dapp.disconnect',
        },
      };
    }
    return {
      matched: true,
      meta,
      action: { action: 'dapp.disconnect', origin },
    };
  }

  if (command === 'history.openLocalDetail') {
    return {
      matched: true,
      meta,
      action: {
        action: 'history.openLocalDetail',
        address: readString(urlInfo.searchParams.get('address'), 128),
      },
    };
  }

  if (command === 'env.setScreenE2E') {
    return {
      matched: true,
      meta,
      action: {
        action: 'env.setScreenE2E',
        enabled: readBoolean(urlInfo.searchParams.get('enabled')),
      },
    };
  }

  return {
    matched: true,
    meta,
    error: {
      code: 'unsupported-command',
      message: `unsupported biz-mock command: ${command}`,
    },
  };
}
