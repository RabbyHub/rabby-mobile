// Read-only preflight: never change the host's global xcode-select setting.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyToolchain(
  version,
  {
    platform = process.platform,
    arch = process.arch,
    env = process.env,
    execute = execFileSync,
    requireBuildRuntime = false,
  } = {},
) {
  if (platform !== 'darwin' || arch !== 'arm64')
    throw new Error('Requires an Apple Silicon macOS runner');
  if (!['26.3', '27.1'].includes(version))
    throw new Error('Unsupported Xcode version');
  const read = (command, args, childEnv = env) =>
    execute(command, args, {
      env: childEnv,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }).trim();
  const developerDir =
    env.DEVELOPER_DIR || read('/usr/bin/xcode-select', ['-p']);
  if (!path.isAbsolute(developerDir) || /[\r\n]/.test(developerDir))
    throw new Error('Expected an absolute selected Xcode developer directory');
  const selectedEnv = { ...env, DEVELOPER_DIR: developerDir };
  const description = read('/usr/bin/xcodebuild', ['-version'], selectedEnv);
  const actual = /^Xcode (\d+\.\d+(?:\.\d+)?)/.exec(description)?.[1];
  if (actual !== version && !actual?.startsWith(version + '.'))
    throw new Error(
      `Selected Xcode is not ${version}; configure the runner explicitly`,
    );
  const sdkVersion = read(
    '/usr/bin/xcrun',
    ['--sdk', 'iphonesimulator', '--show-sdk-version'],
    selectedEnv,
  );
  let buildRuntime;
  if (requireBuildRuntime) {
    if (!/^\d+\.\d+(\.\d+)?$/.test(sdkVersion))
      throw new Error('Invalid Simulator SDK version');
    const inventory = JSON.parse(
      execute('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '--json'], {
        env: selectedEnv,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      }),
    );
    const sdkRelease = sdkVersion.split('.').slice(0, 2).join('.');
    buildRuntime = inventory.runtimes?.find(
      runtime =>
        runtime.isAvailable === true &&
        runtime.identifier?.startsWith(
          'com.apple.CoreSimulator.SimRuntime.iOS-',
        ) &&
        runtime.version?.split('.').slice(0, 2).join('.') === sdkRelease,
    );
    if (!buildRuntime)
      throw new Error(
        `iOS ${sdkRelease} platform runtime is unavailable for this compiler; provision the runner explicitly`,
      );
    buildRuntime = {
      version: buildRuntime.version,
      identifier: buildRuntime.identifier,
      build: buildRuntime.buildversion,
    };
  }
  return {
    developerDir,
    version: actual,
    description,
    sdkVersion,
    buildRuntime,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    if (process.argv.slice(3).some(argument => argument !== '--build'))
      throw new Error('Use toolchain.mjs <26.3|27.1> [--build]');
    const selected = verifyToolchain(process.argv[2], {
      requireBuildRuntime: process.argv.includes('--build'),
    });
    if (process.env.GITHUB_ENV)
      await fs.appendFile(
        process.env.GITHUB_ENV,
        `DEVELOPER_DIR=${selected.developerDir}\n`,
      );
    console.log(JSON.stringify(selected, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
