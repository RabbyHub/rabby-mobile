export function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withTimeoutFallback<T, F>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: F,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<F>(resolve => {
        timer = setTimeout(() => {
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
