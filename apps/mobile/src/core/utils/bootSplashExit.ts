import { perfEvents } from './perf';

let bootSplashExited = false;

export function hasBootSplashExited() {
  return bootSplashExited;
}

export function markBootSplashExited() {
  if (bootSplashExited) {
    return;
  }

  bootSplashExited = true;
  perfEvents.emit('BOOT_SPLASH_EXITED');
}
