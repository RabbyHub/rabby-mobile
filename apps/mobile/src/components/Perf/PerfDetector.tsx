export function RerenderDetector({ name }: { name?: string }) {
  __DEV__ && console.debug(`[perf] RerenderDetector render once:: ${name}`);

  return null;
}

export function useRendererDetect({ name }: { name?: string }) {
  __DEV__ && console.debug(`[perf] useRendererDetect run once:: ${name}`);
}
