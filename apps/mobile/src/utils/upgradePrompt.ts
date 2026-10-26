function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSectionFlag(
  section: unknown,
  version: string,
): boolean | undefined {
  if (
    !isRecord(section) ||
    !Object.prototype.hasOwnProperty.call(section, version)
  ) {
    return undefined;
  }

  const value = section[version];
  return typeof value === 'boolean' ? value : undefined;
}

// undefined means the file or this entry cannot be trusted.
// A valid file that simply omits this version is false.
// A non-boolean entry is ignored when a later section has a real boolean.
export function resolveUpgradePrompt(
  config: unknown,
  platform: 'ios' | 'android',
  version: string,
): boolean | undefined {
  if (!isRecord(config) || !version) {
    return undefined;
  }

  let hasInvalidEntry = false;
  for (const key of ['both', platform]) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      continue;
    }
    const section = config[key];
    if (
      isRecord(section) &&
      Object.prototype.hasOwnProperty.call(section, version) &&
      typeof section[version] !== 'boolean'
    ) {
      hasInvalidEntry = true;
    }
    const value = readSectionFlag(section, version);
    if (value !== undefined) {
      return value;
    }
  }
  return hasInvalidEntry ? undefined : false;
}

function bypassCachedUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}`;
}

async function readUpgradePromptDocument(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(bypassCachedUrl(url), {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok || typeof response.json !== 'function') {
      return undefined;
    }
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('text/html')) {
      return undefined;
    }
    const document = await response.json();
    return isRecord(document) ? document : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export type AutoUpgradePromptBlockReason =
  | 'not-higher'
  | 'already-handled'
  | 'config-off'
  | 'config-missing'
  | 'changelog-invalid';

export function getAutoUpgradePromptDecision(input: {
  couldUpgrade: boolean;
  alreadyPrompted: boolean;
  autoPrompt: boolean | undefined;
  changelogValid: boolean;
}):
  | { willShow: true }
  | { willShow: false; reason: AutoUpgradePromptBlockReason } {
  if (!input.couldUpgrade) {
    return { willShow: false, reason: 'not-higher' };
  }
  if (input.alreadyPrompted) {
    return { willShow: false, reason: 'already-handled' };
  }
  if (input.autoPrompt !== true) {
    return {
      willShow: false,
      reason: input.autoPrompt === false ? 'config-off' : 'config-missing',
    };
  }
  if (!input.changelogValid) {
    return { willShow: false, reason: 'changelog-invalid' };
  }
  return { willShow: true };
}

export async function fetchUpgradePrompt(
  url: string,
  platform: 'ios' | 'android',
  version: string,
): Promise<boolean | undefined> {
  if (!version) {
    return undefined;
  }

  const document = await readUpgradePromptDocument(url);
  if (!isRecord(document)) {
    return undefined;
  }
  return resolveUpgradePrompt(document, platform, version);
}
