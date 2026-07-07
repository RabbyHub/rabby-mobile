const globalScreenCapturableRef = { current: true };

export function getGlobalScreenCapturable() {
  return globalScreenCapturableRef.current;
}

export function setGlobalScreenCapturable(value: boolean) {
  globalScreenCapturableRef.current = value;
}
