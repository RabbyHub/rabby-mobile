export function RerenderDetector({ name }: { name?: string }) {
  console.debug(`[perf] RerenderDetector render once:: ${name}`);

  return null;
}

export function useRendererDetect({ name }: { name?: string }) {
  console.debug(`[perf] useRendererDetect run once:: ${name}`);
}
