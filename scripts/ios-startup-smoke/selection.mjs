import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { requiredMajors } from './run.mjs';

function branchFromRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('refs/heads/'))
    throw new Error('Expected a branch ref for Simulator selection');
  const branch = ref.slice('refs/heads/'.length);
  if (
    !branch ||
    /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) ||
    branch.includes('..') ||
    branch.includes('@{') ||
    branch.endsWith('.') ||
    branch
      .split('/')
      .some(part => !part || part.startsWith('.') || part.endsWith('.lock'))
  )
    throw new Error('Expected a valid branch ref for Simulator selection');
  return branch;
}

function booleanInput(inputs, key, fallback) {
  if (!Object.hasOwn(inputs, key)) return fallback;
  const value = inputs[key];
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error('Simulator selection inputs must be booleans');
}

export function resolveSelection({ eventName, ref, inputs = {} } = {}) {
  if (!['push', 'workflow_dispatch'].includes(eventName))
    throw new Error('Unsupported Simulator selection event');
  const branch = branchFromRef(ref);

  // Publish checks cannot be narrowed or turned into build-only runs by inputs.
  if (branch.startsWith('publish/'))
    return { requested_majors: requiredMajors.join(','), build_only: false };
  if (eventName !== 'workflow_dispatch')
    throw new Error('Non-publish Simulator selection requires manual dispatch');
  if (
    !inputs ||
    typeof inputs !== 'object' ||
    Array.isArray(inputs) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(inputs))
  )
    throw new Error('Expected Simulator selection inputs');

  const selected = requiredMajors.filter(major =>
    booleanInput(inputs, `ios_${major}`, major === 27),
  );
  const buildOnly = booleanInput(inputs, 'build_only', false);
  if (!selected.length)
    throw new Error('Select at least one supported iOS version');
  return { requested_majors: selected.join(','), build_only: buildOnly };
}

export async function main(args = [], env = process.env) {
  if (args.length) throw new Error('Simulator selection takes no arguments');
  const selected = resolveSelection({
    eventName: env.GITHUB_EVENT_NAME,
    ref: env.GITHUB_REF,
    inputs:
      env.SIMULATOR_INPUTS === undefined
        ? {}
        : JSON.parse(env.SIMULATOR_INPUTS),
  });
  if (env.GITHUB_OUTPUT)
    await fs.appendFile(
      env.GITHUB_OUTPUT,
      `requested_majors=${selected.requested_majors}\nbuild_only=${selected.build_only}\n`,
    );
  console.log(
    `Selected iOS majors: ${selected.requested_majors}; build only: ${selected.build_only}`,
  );
  return selected;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(() => {
    console.error('Simulator selection failed');
    process.exitCode = 1;
  });
}
