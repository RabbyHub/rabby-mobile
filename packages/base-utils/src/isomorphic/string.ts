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

export function isStringOrNumber(data: any) {
  return typeof data === 'string' || typeof data === 'number';
}
