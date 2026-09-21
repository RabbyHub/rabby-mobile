import { startSubscribeOnekeyDevices } from '@/core/apis/onekey';
import { startSubscribeTrezorConnectOnUrl } from '@/hooks/trezor/useTrezor';

export function startSetupRuntimeHardwareSubscriptions() {
  startSubscribeOnekeyDevices();
  startSubscribeTrezorConnectOnUrl();
}
