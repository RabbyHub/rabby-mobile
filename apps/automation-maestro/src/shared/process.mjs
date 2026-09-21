import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function normalizeOutput(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value).trim();
}

function buildError(command, args, result) {
  const rendered = [command, ...args].join(' ');
  const stdout = normalizeOutput(result.stdout);
  const stderr = normalizeOutput(result.stderr);
  const details = [stdout, stderr].filter(Boolean).join('\n');
  const suffix = details ? `\n${details}` : '';
  return new Error(`Command failed: ${rendered}${suffix}`);
}

export function log(scope, message) {
  console.log(`[${scope}] ${message}`);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw buildError(command, args, result);
  }

  return result;
}

export function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw buildError(command, args, result);
  }

  return result.stdout.trim();
}

export function resolveBinary({
  envVarName,
  commandName,
  fallbackPath,
  errorMessage,
}) {
  const explicit = process.env[envVarName]?.trim();
  if (explicit) {
    if (!fs.existsSync(explicit)) {
      throw new Error(`${envVarName} points to a missing binary: ${explicit}`);
    }
    return explicit;
  }

  const resolved = spawnSync('bash', ['-lc', `command -v ${commandName}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const commandPath = resolved.stdout?.trim();
  if (resolved.status === 0 && commandPath) {
    return commandPath;
  }

  if (fallbackPath && fs.existsSync(fallbackPath)) {
    return fallbackPath;
  }

  throw new Error(errorMessage);
}

export function defaultMaestroBinary() {
  return path.join(os.homedir(), '.maestro', 'bin', 'maestro');
}
