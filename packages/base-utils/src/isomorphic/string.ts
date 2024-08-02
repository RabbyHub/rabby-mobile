export function ucfirst<T extends string>(str: T): Capitalize<T> {
  return (str.charAt(0).toUpperCase() + str.slice(1)) as Capitalize<T>;
}

export function ensurePrefix(str = '', prefix = '/') {
  return str.startsWith(prefix) ? str : prefix + str;
}

export function ensureSuffix(str = '', suffix = '/') {
  return str.endsWith(suffix) ? str : str + suffix;
}

export function unPrefix(str = '', prefix = '/') {
  return str.startsWith(prefix) ? str.slice(prefix.length) : str;
}

export function unSuffix(str = '', suffix = '/') {
  return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

export function randString(length = 10) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0, rnum: number; i < length; ++i) {
    rnum = Math.floor(Math.random() * chars.length);
    result += chars.charAt(rnum);
  }
  return result;
}

export function isStringOrNumber(data: any) {
  return typeof data === 'string' || typeof data === 'number';
}

export function safeParseJSON<T = any>(json: string, options?: { defaultValue?: any }): T | null {
  try {
    return JSON.parse(json);
  } catch (error) {
    return options?.defaultValue ?? null;
  }
}
