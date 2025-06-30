export const domReadyCall = (callback: () => void) => {
  if (document.readyState === 'loading') {
    const domContentLoadedHandler = () => {
      callback();
      document.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
    };
    document.addEventListener('DOMContentLoaded', domContentLoadedHandler);
  } else {
    callback();
  }
};

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate: boolean = false,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    const context = this;

    const later = () => {
      timeoutId = null;
      if (!immediate) {
        func.apply(context, args);
      }
    };

    const callNow = immediate && !timeoutId;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(later, wait);

    if (callNow) {
      func.apply(context, args);
    }
  };
}

export function compareVersions(v1: string, v2: string): number {
  const versionRegex = /^\d+(\.\d+)*$/;

  if (!versionRegex.test(v1)) {
    throw new Error(`Invalid version format: ${v1}`);
  }

  if (!versionRegex.test(v2)) {
    throw new Error(`Invalid version format: ${v2}`);
  }

  // 分割版本号并转换为数字
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  // 确定最大长度
  const maxLength = Math.max(parts1.length, parts2.length);

  // 逐项比较
  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}
