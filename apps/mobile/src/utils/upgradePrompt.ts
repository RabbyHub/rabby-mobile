function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// undefined means unavailable, invalid, or unconfigured; only true opts in.
export function resolveUpgradePrompt(
  config: unknown,
  platform: 'ios' | 'android',
  version: string,
): boolean | undefined {
  if (!isRecord(config)) {
    return undefined;
  }

  for (const key of ['both', 'ios', 'android']) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      continue;
    }
    const section = config[key];
    if (
      !isRecord(section) ||
      Object.values(section).some(value => typeof value !== 'boolean')
    ) {
      return undefined;
    }
  }

  for (const key of ['both', platform]) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) {
      continue;
    }
    const section = config[key];
    if (
      isRecord(section) &&
      Object.prototype.hasOwnProperty.call(section, version)
    ) {
      return section[version] as boolean;
    }
  }
  return undefined;
}

export async function fetchUpgradePrompt(
  url: string,
  platform: 'ios' | 'android',
  version: string,
): Promise<boolean | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return undefined;
    }
    return resolveUpgradePrompt(await response.json(), platform, version);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
