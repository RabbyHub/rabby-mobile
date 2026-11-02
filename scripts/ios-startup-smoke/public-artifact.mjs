import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyArchive } from './hosted.mjs';

// This is the trusted build recipe's publication policy, not a sandbox,
// secret scanner or proof against malicious code running as the same OS user.
// Historical artifacts must be rebuilt with public inputs, never relabelled.
export function assertPublicArtifactProfile(metadata) {
  if (metadata?.buildInputProfile !== 'simulator-smoke-v1')
    throw new Error(
      'Artifact is not eligible for public Simulator distribution',
    );
  return metadata;
}

export async function verifyPublicArtifact(directory, commit, options = {}) {
  const metadata = await verifyArchive(directory, commit, {
    ...options,
    probe: true,
  });
  return assertPublicArtifactProfile(metadata);
}

function positiveInteger(value) {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]*$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    String(Number(value)) === value
  );
}

export async function main(args, env = process.env) {
  const [directory, commit] = args;
  if (
    args.length !== 2 ||
    !directory ||
    typeof commit !== 'string' ||
    commit.length !== 40 ||
    !/^[a-f0-9]{40}$/.test(commit) ||
    env.GITHUB_REPOSITORY !== 'RabbyHub/rabby-mobile' ||
    !positiveInteger(env.GITHUB_RUN_ID) ||
    !positiveInteger(env.GITHUB_RUN_ATTEMPT)
  )
    throw new Error('Invalid public Simulator artifact verification context');

  await verifyPublicArtifact(directory, commit, {
    producer: {
      repository: env.GITHUB_REPOSITORY,
      runId: env.GITHUB_RUN_ID,
      runAttempt: env.GITHUB_RUN_ATTEMPT,
    },
  });
  if (env.GITHUB_OUTPUT)
    await fs.appendFile(env.GITHUB_OUTPUT, 'allowed=true\n');
  console.log('Public Simulator artifact profile verified');
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main(process.argv.slice(2)).catch(() => {
    // Do not emit filesystem paths, malformed receipt contents or build secrets.
    console.error('Public Simulator artifact verification failed');
    process.exitCode = 1;
  });
}
