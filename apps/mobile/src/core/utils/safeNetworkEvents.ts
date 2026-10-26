type GnosisNetworksListener = (networkIds: string[]) => void;

const listeners = new Map<string, Set<GnosisNetworksListener>>();

export function subscribeGnosisNetworks(
  address: string,
  listener: GnosisNetworksListener,
) {
  const key = address.toLowerCase();
  const addressListeners = listeners.get(key) || new Set();
  addressListeners.add(listener);
  listeners.set(key, addressListeners);
  return () => {
    addressListeners.delete(listener);
    if (!addressListeners.size) {
      listeners.delete(key);
    }
  };
}

export function publishGnosisNetworks(address: string, networkIds: string[]) {
  listeners.get(address.toLowerCase())?.forEach(listener => {
    try {
      listener([...networkIds]);
    } catch (error) {
      console.error('Failed to publish Safe networks', error);
    }
  });
}
