import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { capture, resolveBinary, run } from './process.mjs';

function formatCommandError(command, args, result) {
  const rendered = [command, ...args].join(' ');
  const stdout = result.stdout?.trim?.() || '';
  const stderr = result.stderr?.trim?.() || '';
  const details = [stdout, stderr].filter(Boolean).join('\n');

  return new Error(
    details
      ? `Command failed: ${rendered}\n${details}`
      : `Command failed: ${rendered}`,
  );
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw formatCommandError(command, args, result);
  }

  return result.stdout?.trim?.() || '';
}

export function resolveXcrunBinary() {
  return resolveBinary({
    envVarName: 'XCRUN_BIN',
    commandName: 'xcrun',
    errorMessage: '[maestro:ios] xcrun is required but not found in PATH',
  });
}

export function resolveBootedIOSSimulator(xcrunBinary) {
  const raw = capture(xcrunBinary, ['simctl', 'list', 'devices', 'booted', '--json']);
  const parsed = JSON.parse(raw || '{}');

  for (const devices of Object.values(parsed.devices ?? {})) {
    const simulator = devices.find(
      device => device?.state === 'Booted' && device?.isAvailable !== false,
    );

    if (simulator) {
      return simulator;
    }
  }

  throw new Error(
    '[maestro:ios] no booted iOS simulator found. Boot one or set IOS_SIMULATOR_UDID.',
  );
}

export function resolveIOSSimulatorUDID(xcrunBinary) {
  return (
    process.env.IOS_SIMULATOR_UDID?.trim() ||
    process.env.RABBY_IOS_SIMULATOR_UDID?.trim() ||
    resolveBootedIOSSimulator(xcrunBinary).udid
  );
}

export function clearIOSAppData(xcrunBinary, deviceId, bundleId) {
  const appDataDir = capture(xcrunBinary, [
    'simctl',
    'get_app_container',
    deviceId,
    bundleId,
    'data',
  ]);

  for (const entryName of fs.readdirSync(appDataDir)) {
    if (entryName === '.com.apple.mobile_container_manager.metadata.plist') {
      continue;
    }

    fs.rmSync(path.join(appDataDir, entryName), {
      recursive: true,
      force: true,
    });
  }
}

export function resetIOSKeychain(xcrunBinary, deviceId) {
  run(xcrunBinary, ['simctl', 'keychain', deviceId, 'reset'], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

export function writeIOSPasteboard(xcrunBinary, deviceId, value) {
  const args = ['simctl', 'pbcopy', deviceId];
  const result = spawnSync(xcrunBinary, args, {
    input: value,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw formatCommandError(xcrunBinary, args, result);
  }
}

export function terminateIOSApp(xcrunBinary, deviceId, bundleId) {
  spawnSync(xcrunBinary, ['simctl', 'terminate', deviceId, bundleId], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function launchIOSApp(xcrunBinary, deviceId, bundleId) {
  runCapture(xcrunBinary, ['simctl', 'launch', deviceId, bundleId]);
}
