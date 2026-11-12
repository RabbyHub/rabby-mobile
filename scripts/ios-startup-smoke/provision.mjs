#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const supportedRuntimes = [
  '16.4',
  '17.5',
  '18.3.1',
  '18.5',
  '26.2',
  '27.0',
];
export const installTimeoutMs = 25 * 60 * 1000;
const inventoryArgs = ['simctl', 'list', 'runtimes', '--json'];

export function installationArgs(version) {
  if (!supportedRuntimes.includes(version))
    throw new Error(
      `Choose an exact iOS runtime: ${supportedRuntimes.join(', ')}`,
    );
  const args = ['-downloadPlatform', 'iOS', '-buildVersion', version];
  // Older runtime downloads do not offer the arm64-only variant.
  if (Number(version.split('.')[0]) >= 26)
    args.push('-architectureVariant', 'arm64');
  return args;
}

export function findRuntime(inventory, version) {
  if (!Array.isArray(inventory?.runtimes))
    throw new Error('simctl returned an invalid runtime inventory');
  return inventory.runtimes.find(
    runtime =>
      runtime.version === version &&
      runtime.isAvailable === true &&
      runtime.identifier?.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-'),
  );
}

// No shell or stdin: downloading must never wait for an Apple ID or sudo prompt.
// Tee tool output into durable evidence without printing the runner environment.
export async function runCommand(
  executable,
  args,
  { env, logfile, timeoutMs = 30000, echo = false },
) {
  const log = createWriteStream(logfile, { flags: 'a' });
  await new Promise((resolve, reject) => {
    log.once('open', resolve);
    log.once('error', reject);
  });
  log.write(`\n$ ${executable} ${args.join(' ')}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    let stdout = '';
    let failure;
    let escalation;
    const stop = (message, code) => {
      failure ||= Object.assign(new Error(message), { code });
      if (!child.pid) return;
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
      escalation ||= setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }, 5000);
    };
    const onSignal = () =>
      stop('Runtime provisioning was cancelled', 'PROVISION_CANCELLED');
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    const timer = setTimeout(
      () =>
        stop(`${path.basename(executable)} timed out after ${timeoutMs} ms`),
      timeoutMs,
    );
    log.on('error', () => stop('Cannot write runtime provisioning log'));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      log.write(chunk);
      if (echo) process.stdout.write(chunk);
      if (stdout.length + chunk.length <= 8 * 1024 * 1024) stdout += chunk;
      else stop('Runtime provisioning command exceeded the output limit');
    });
    child.stderr.on('data', chunk => {
      log.write(chunk);
      if (echo) process.stderr.write(chunk);
    });
    child.once('error', error => {
      failure = new Error(
        `Could not start ${path.basename(executable)} (${
          error.code || 'error'
        })`,
      );
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      // The root may exit before a descendant that ignored SIGTERM. Do not
      // discard the escalation without stopping this command's owned group.
      if (failure && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
      }
      clearTimeout(escalation);
      process.removeListener('SIGINT', onSignal);
      process.removeListener('SIGTERM', onSignal);
      log.end(() => {
        if (failure) reject(failure);
        else if (code !== 0)
          reject(
            new Error(
              `${path.basename(executable)} failed (${
                signal || code
              }); see provision.log`,
            ),
          );
        else resolve(stdout.trim());
      });
    });
  });
}

async function writeJSON(file, value) {
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

export async function provisionRuntime(
  { runtime, output, checkOnly = false },
  {
    platform = process.platform,
    arch = process.arch,
    env = process.env,
    execute = runCommand,
  } = {},
) {
  const args = installationArgs(runtime);
  if (platform !== 'darwin' || arch !== 'arm64')
    throw new Error('Requires an Apple Silicon macOS runner');
  if (!env.DEVELOPER_DIR || !path.isAbsolute(env.DEVELOPER_DIR))
    throw new Error(
      'Set DEVELOPER_DIR to the selected Xcode before provisioning',
    );
  if (!output || !path.isAbsolute(output))
    throw new Error('Provide a fresh absolute --output directory');
  await fs.mkdir(output, { recursive: false });
  const logfile = path.join(output, 'provision.log');
  const metadataFile = path.join(output, 'metadata.json');
  const metadata = {
    schemaVersion: 1,
    requestedRuntime: runtime,
    status: 'running',
    stage: 'host-metadata',
    startedAt: new Date().toISOString(),
    host: { platform, arch },
    developerDir: env.DEVELOPER_DIR,
    installAttempted: false,
    checkOnly,
  };
  await writeJSON(metadataFile, metadata);
  const call = (command, commandArgs, options = {}) =>
    execute(command, commandArgs, { env, logfile, ...options });
  const inventory = async name => {
    // Fresh hosted CoreSimulator inventories can exceed the general 30s tool
    // budget, including immediately after installing a runtime. Keep this
    // separate from download and application startup deadlines.
    const result = JSON.parse(
      await call('/usr/bin/xcrun', inventoryArgs, { timeoutMs: 120000 }),
    );
    await writeJSON(path.join(output, `${name}.json`), result);
    // Validate even when no matching version is expected yet.
    findRuntime(result, runtime);
    return result;
  };
  try {
    metadata.host.description = await call('/usr/bin/sw_vers', []);
    metadata.xcode = await call('/usr/bin/xcodebuild', ['-version']);
    metadata.stage = 'inventory-before';
    const before = await inventory('before');
    const existing = findRuntime(before, runtime);
    let installError;
    if (!existing) {
      if (checkOnly)
        throw new Error(
          `iOS ${runtime} is missing or unavailable; provision the persistent runner explicitly`,
        );
      metadata.stage = 'install';
      metadata.installAttempted = true;
      metadata.installCommand = { executable: '/usr/bin/xcodebuild', args };
      await writeJSON(metadataFile, metadata);
      try {
        await call('/usr/bin/xcodebuild', args, {
          timeoutMs: installTimeoutMs,
          echo: true,
        });
      } catch (error) {
        if (error.code === 'PROVISION_CANCELLED') throw error;
        installError = error;
      }
    }
    // Record the real post-install state even after a failed download. A failed
    // command is never converted to success just because another runtime exists.
    metadata.stage = 'inventory-after';
    let after;
    try {
      after = await inventory('after');
    } catch (error) {
      if (!installError) throw error;
      metadata.inventoryAfterError = error.message;
    }
    if (installError) {
      metadata.stage = 'install';
      throw installError;
    }
    const selected = findRuntime(after, runtime);
    if (!selected)
      throw new Error(
        `iOS ${runtime} is still missing or unavailable after provisioning`,
      );
    metadata.runtime = {
      version: selected.version,
      identifier: selected.identifier,
      build: selected.buildversion,
      isAvailable: selected.isAvailable,
    };
    metadata.status = existing ? 'reused' : 'installed';
    metadata.stage = 'complete';
    return metadata;
  } catch (error) {
    metadata.status = 'failed';
    metadata.message = error.message;
    throw error;
  } finally {
    metadata.finishedAt = new Date().toISOString();
    await writeJSON(metadataFile, metadata);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: {
        runtime: { type: 'string' },
        output: { type: 'string' },
        'check-only': { type: 'boolean', default: false },
      },
      allowPositionals: false,
    });
    const result = await provisionRuntime({
      ...values,
      checkOnly: values['check-only'],
    });
    console.log(`iOS ${result.runtime.version}: ${result.status}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
