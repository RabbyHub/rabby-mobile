#!/usr/bin/env node

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../../..');

function git(args, options = {}) {
  return execFileSync('git', ['-C', workspaceRoot, ...args], {
    encoding: 'utf8',
    ...options,
  }).trim();
}

const buildChannel =
  process.env.buildchannel ||
  process.env.RABBY_MOBILE_BUILD_CHANNEL ||
  'selfhost-reg';
const commitHash = git(['log', '--format=%H', '-n1']);
const shouldMarkDirty =
  Boolean(process.env.LOCAL_PACK) &&
  !process.env.CI &&
  git(['status', '--porcelain']).length > 0;

const buildInfo = {
  BUILD_GIT_HASH: `${commitHash.slice(0, 8)}${shouldMarkDirty ? '-dirty' : ''}`,
  BUILD_GIT_HASH_TIME:
    process.platform === 'win32'
      ? ''
      : git(
          [
            'show',
            '--quiet',
            '--date=format-local:%Y-%m-%dT%H:%M:%S+00:00',
            '--format=%cd',
          ],
          { env: { ...process.env, TZ: 'UTC0' } },
        ),
  BUILD_TIME: process.env.ZERO_AR_DATE || new Date().toISOString(),
  BUILD_GIT_COMMITOR:
    buildChannel === 'selfhost-reg'
      ? git(['show', '--quiet', '--format=%cn'])
      : '',
};

process.stdout.write(JSON.stringify(buildInfo));
