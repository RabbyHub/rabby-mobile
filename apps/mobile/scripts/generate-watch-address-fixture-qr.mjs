#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import QRCode from 'qrcode';

const BASE45_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const PAYLOAD_PREFIX = 'RABBY-WATCH-V1:';
const MAX_ADDRESS_COUNT = 120;
const PRIVATE_KEY_PATTERN = /(?:0x)?[a-fA-F0-9]{64}/g;
const EVM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/g;

function readArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}`);
    }
    result[argument.slice(2)] = value;
    index += 1;
  }
  return result;
}

function readJsonAddresses(value) {
  const rankedFixtures = Array.isArray(value?.fixtures)
    ? value.fixtures
    : undefined;
  const addresses =
    value?.addresses ??
    value?.watchAddresses ??
    rankedFixtures?.map(item => item?.address);
  return Array.isArray(addresses) ? addresses : [];
}

function parseAddresses(contents) {
  if (PRIVATE_KEY_PATTERN.test(contents)) {
    throw new Error('Watch-address fixture must not contain private keys');
  }
  PRIVATE_KEY_PATTERN.lastIndex = 0;

  const trimmed = contents.trim();
  const candidates = trimmed.startsWith('{')
    ? readJsonAddresses(JSON.parse(trimmed))
    : trimmed.match(EVM_ADDRESS_PATTERN) || [];
  if (candidates.some(address => typeof address !== 'string')) {
    throw new Error('Watch-address fixture addresses must be strings');
  }

  const addresses = [
    ...new Set(candidates.map(address => address.trim().toLowerCase())),
  ];
  if (!addresses.length) {
    throw new Error('Watch-address fixture contains no EVM addresses');
  }
  if (addresses.some(address => !/^0x[a-f0-9]{40}$/.test(address))) {
    throw new Error('Watch-address fixture contains an invalid EVM address');
  }
  return addresses;
}

function encodeBase45(bytes) {
  let result = '';
  for (let index = 0; index < bytes.length; index += 2) {
    if (index + 1 < bytes.length) {
      let value = bytes[index] * 256 + bytes[index + 1];
      result += BASE45_ALPHABET[value % 45];
      value = Math.floor(value / 45);
      result += BASE45_ALPHABET[value % 45];
      result += BASE45_ALPHABET[Math.floor(value / 45)];
    } else {
      const value = bytes[index];
      result += BASE45_ALPHABET[value % 45];
      result += BASE45_ALPHABET[Math.floor(value / 45)];
    }
  }
  return result;
}

function encodePayload(addresses) {
  const bytes = addresses.flatMap(address => {
    const hex = address.slice(2);
    return Array.from({ length: 20 }, (_, index) =>
      Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
    );
  });
  return PAYLOAD_PREFIX + encodeBase45(bytes);
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    throw new Error(
      'Usage: generate-watch-address-fixture-qr.mjs --input <fixture> --output <png> [--count 100]',
    );
  }

  const requestedCount = Number(args.count || MAX_ADDRESS_COUNT);
  if (
    !Number.isInteger(requestedCount) ||
    requestedCount < 1 ||
    requestedCount > MAX_ADDRESS_COUNT
  ) {
    throw new Error(
      `--count must be an integer from 1 to ${MAX_ADDRESS_COUNT}`,
    );
  }

  const contents = await fs.readFile(path.resolve(args.input), 'utf8');
  const addresses = parseAddresses(contents).slice(0, requestedCount);
  if (addresses.length !== requestedCount) {
    throw new Error(
      `Fixture has ${addresses.length} addresses; ${requestedCount} requested`,
    );
  }

  const outputPath = path.resolve(args.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await QRCode.toFile(outputPath, encodePayload(addresses), {
    // A 120-address payload needs QR alphanumeric capacity above level M.
    errorCorrectionLevel: 'L',
    margin: 2,
    width: 1400,
  });
  process.stdout.write(
    `${JSON.stringify({
      success: true,
      addressCount: addresses.length,
      outputPath,
    })}\n`,
  );
}

main().catch(error => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'QR generation failed'}\n`,
  );
  process.exitCode = 1;
});
