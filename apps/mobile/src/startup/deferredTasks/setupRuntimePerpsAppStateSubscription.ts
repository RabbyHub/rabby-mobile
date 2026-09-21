import { startSubscribePerpsOnAppState } from '@/hooks/perps/usePerpsStore';

export function startSetupRuntimePerpsAppStateSubscription() {
  startSubscribePerpsOnAppState();
}
