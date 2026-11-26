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
  | { action: 'state.dump'; name?: string };

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

  return {
    matched: true,
    meta,
    error: {
      code: 'unsupported-command',
      message: `unsupported biz-mock command: ${command}`,
    },
  };
}
