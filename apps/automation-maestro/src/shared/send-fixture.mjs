import fs from 'node:fs';
import path from 'node:path';
import { resolveFromMaestro } from './paths.mjs';

function resolveFixturePath(filePath) {
  if (!filePath) {
    return null;
  }

  return path.isAbsolute(filePath) ? filePath : resolveFromMaestro(filePath);
}

function resolveCandidateFiles(config) {
  const candidatePaths = [];
  const pushCandidate = filePath => {
    const resolvedPath = resolveFixturePath(filePath?.trim());
    if (!resolvedPath || candidatePaths.includes(resolvedPath)) {
      return;
    }

    candidatePaths.push(resolvedPath);
  };

  pushCandidate(process.env.RABBY_SEND_FIXTURE_FILE);
  pushCandidate(process.env.RABBY_FLOW_FIXTURE_FILE);
  pushCandidate(config?.android?.sendSmoke?.fixtureFile);
  pushCandidate(config?.android?.sharedFixtureFile);
  pushCandidate('flows.fixture.local.json');
  pushCandidate('send.fixture.local.json');

  if (candidatePaths.length) {
    return candidatePaths;
  }

  return [
    resolveFromMaestro('flows.fixture.local.json'),
    resolveFromMaestro('send.fixture.local.json'),
  ];
}

function normalizeAddress(value, fieldName) {
  const nextValue = String(value || '').trim();
  if (!nextValue) {
    throw new Error(`[maestro:send-smoke] Missing required field: ${fieldName}`);
  }
  return nextValue;
}

export function normalizeSendFixture(rawFixture) {
  const send = rawFixture?.send ?? rawFixture;

  if (!send || typeof send !== 'object') {
    throw new Error(
      '[maestro:send-smoke] Send fixture must be an object or contain a top-level "send" object',
    );
  }

  const amountValue = send.amount;
  if (amountValue == null || String(amountValue).trim() === '') {
    throw new Error('[maestro:send-smoke] Missing required field: send.amount');
  }

  return {
    from: {
      address: normalizeAddress(send.from?.address, 'send.from.address'),
      type: send.from?.type ? String(send.from.type) : undefined,
      brandName: send.from?.brandName
        ? String(send.from.brandName)
        : undefined,
    },
    to: {
      address: normalizeAddress(send.to?.address, 'send.to.address'),
      brandName: send.to?.brandName ? String(send.to.brandName) : undefined,
    },
    token: {
      chain: normalizeAddress(send.token?.chain, 'send.token.chain'),
      tokenId: normalizeAddress(send.token?.tokenId, 'send.token.tokenId'),
      symbol: send.token?.symbol ? String(send.token.symbol) : undefined,
    },
    amount: String(amountValue),
  };
}

export function loadSendFixture(config) {
  for (const filePath of resolveCandidateFiles(config)) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const loaded = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      filePath,
      fixture: normalizeSendFixture(loaded),
    };
  }

  throw new Error(
    '[maestro:send-smoke] Send fixture not found. Create apps/automation-maestro/flows.fixture.local.json, use the checked-in flows.fixture.example.json as a template, or set RABBY_SEND_FIXTURE_FILE.',
  );
}
