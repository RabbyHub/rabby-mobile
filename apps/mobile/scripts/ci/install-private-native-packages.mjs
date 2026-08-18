#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@debank/rabby-native-openapi-signer';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '../..');
const monorepoRoot = path.resolve(mobileRoot, '../..');
const nativeOpenApiPackagePath = path.join(
  monorepoRoot,
  'packages/rabby-native-openapi/package.json',
);
const targetDir = path.join(monorepoRoot, 'node_modules', PACKAGE_NAME);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function expectedVersion() {
  const pkg = readJson(nativeOpenApiPackagePath);
  const version = pkg.peerDependencies?.[PACKAGE_NAME];
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Missing exact optional peer version for ${PACKAGE_NAME}`);
  }
  return version;
}

function installedVersion() {
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  const pkg = readJson(packageJsonPath);
  return pkg.name === PACKAGE_NAME ? pkg.version : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0) {
    const token = process.env.RABBY_MOBILE_PRIVATE_NPM_TOKEN;
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    const safeOutput = token ? output.split(token).join('[redacted]') : output;
    throw new Error(
      `${command} ${args[0]} failed with status ${
        result.status
      }\n${safeOutput.trim()}`,
    );
  }
  return result;
}

function install(version) {
  const workDir = mkdtempSync(
    path.join(tmpdir(), 'rabby-private-native-package-'),
  );
  const npmrcPath = path.join(workDir, '.npmrc');
  const extractDir = path.join(workDir, 'extract');
  const token = process.env.RABBY_MOBILE_PRIVATE_NPM_TOKEN;
  const childEnv = { ...process.env };

  try {
    if (token) {
      writeFileSync(
        npmrcPath,
        `registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=${token}\nalways-auth=true\n`,
        { mode: 0o600 },
      );
      chmodSync(npmrcPath, 0o600);
      childEnv.NPM_CONFIG_USERCONFIG = npmrcPath;
    }
    delete childEnv.RABBY_MOBILE_PRIVATE_NPM_TOKEN;

    run(
      process.env.npm_execpath &&
        process.env.npm_execpath.endsWith('npm-cli.js')
        ? process.execPath
        : 'npm',
      [
        ...(process.env.npm_execpath?.endsWith('npm-cli.js')
          ? [process.env.npm_execpath]
          : []),
        'pack',
        `${PACKAGE_NAME}@${version}`,
        '--pack-destination',
        workDir,
        '--ignore-scripts',
        '--json',
      ],
      { cwd: monorepoRoot, env: childEnv },
    );

    const archives = readdirSync(workDir).filter(name => name.endsWith('.tgz'));
    if (archives.length !== 1) {
      throw new Error(`Expected one package archive, found ${archives.length}`);
    }

    mkdirSync(extractDir);
    run('tar', ['-xzf', path.join(workDir, archives[0]), '-C', extractDir]);

    const extractedPackageDir = path.join(extractDir, 'package');
    const extractedPackage = readJson(
      path.join(extractedPackageDir, 'package.json'),
    );
    if (
      extractedPackage.name !== PACKAGE_NAME ||
      extractedPackage.version !== version
    ) {
      throw new Error(
        `Downloaded package does not match ${PACKAGE_NAME}@${version}`,
      );
    }

    const targetParent = path.dirname(targetDir);
    const stagedDir = path.join(
      targetParent,
      `.rabby-native-openapi-signer.stage-${process.pid}`,
    );
    const backupDir = path.join(
      targetParent,
      `.rabby-native-openapi-signer.backup-${process.pid}`,
    );
    mkdirSync(targetParent, { recursive: true });
    rmSync(stagedDir, { recursive: true, force: true });
    rmSync(backupDir, { recursive: true, force: true });
    cpSync(extractedPackageDir, stagedDir, { recursive: true });

    if (existsSync(targetDir)) {
      renameSync(targetDir, backupDir);
    }
    try {
      renameSync(stagedDir, targetDir);
      rmSync(backupDir, { recursive: true, force: true });
    } catch (error) {
      if (!existsSync(targetDir) && existsSync(backupDir)) {
        renameSync(backupDir, targetDir);
      }
      throw error;
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function main() {
  const version = expectedVersion();
  const currentVersion = installedVersion();
  const checkOnly = process.argv.includes('--check');
  const required = process.argv.includes('--required');

  if (currentVersion === version) {
    console.log(`[private-native] ${PACKAGE_NAME}@${version} is ready`);
    return;
  }

  if (checkOnly) {
    throw new Error(
      `${PACKAGE_NAME}@${version} is required, installed: ${
        currentVersion || 'none'
      }`,
    );
  }

  if (!required) {
    console.log(
      `[private-native] skip ${PACKAGE_NAME}@${version}; private install was not requested`,
    );
    return;
  }

  install(version);
  if (installedVersion() !== version) {
    throw new Error(`${PACKAGE_NAME}@${version} installation was not durable`);
  }
  console.log(`[private-native] installed ${PACKAGE_NAME}@${version}`);
}

main();
