type Listener = (code: string) => void;

const listeners = new Set<Listener>();

export function onBrowserEval(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitBrowserEval(code: string) {
  listeners.forEach(listener => listener(code));
}
