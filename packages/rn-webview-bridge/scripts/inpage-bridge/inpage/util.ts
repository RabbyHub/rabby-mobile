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
