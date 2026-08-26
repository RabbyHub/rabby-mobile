export const BACKEND_API_HOST_DEBUG_COMMAND = 'debug-backend-api-host';

export type BackendApiHostDebugCommand = {
  action: 'set' | 'reset';
  host: string;
};

export type BackendApiHostDebugCommandParseResult =
  | {
      command: BackendApiHostDebugCommand;
      error?: never;
    }
  | {
      command?: never;
      error: string;
    };

export function normalizeBackendApiHost(input: string | null | undefined) {
  const value = input?.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${pathname}`;
  } catch {
    return null;
  }
}

export function parseBackendApiHostDebugCommand(
  params: URLSearchParams,
  defaultHost: string,
): BackendApiHostDebugCommandParseResult {
  const action = (params.get('action') || 'set').trim().toLowerCase();
  if (action === 'reset') {
    return {
      command: {
        action: 'reset',
        host: defaultHost,
      },
    };
  }

  if (action !== 'set') {
    return {
      error: 'Backend API host action must be set or reset',
    };
  }

  const host = normalizeBackendApiHost(params.get('host'));
  if (!host) {
    return {
      error: 'Backend API host must be a valid HTTP(S) URL',
    };
  }

  return {
    command: {
      action: 'set',
      host,
    },
  };
}
