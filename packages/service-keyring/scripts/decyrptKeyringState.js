const fs = require('fs');
const path = require('path');

const browserPassword = require('../dist/utils/browser-password');

const SCRIPT_DIR = path.join(__dirname, './keyring-states');

const EXT = '.keyring.json';
const files = fs.readdirSync(SCRIPT_DIR);
const keyringStateFiles = [...new Set([
  ...files,
  ...!files.length ? [fs.readdirSync(__dirname)] : [],
  // uncomment it if you want to test v1.sample.keyring.json
  // ...fs.readdirSync(__dirname),
])]
  .filter(f => {
    if (fs.existsSync(getParsedFileName(f))) {
      fs.rmSync(getParsedFileName(f), { force: true })
    }
    return f.endsWith(EXT)
  });

const DEFAULT_PWD = "11111111";

function getParsedFileName (f) {
  return path.join(SCRIPT_DIR, `${path.basename(f, EXT)}.parsed.json`);
}

function formatPayload (input) {
  const obj = typeof input === 'string' ? JSON.parse(input) : input;

  const payload = {
    data: obj.cipher,
    iv: Buffer.from(obj.iv, 'hex').toString('base64'),
    keyMetadata: {
      ivFormat: 'base64',
      derivedKeyFormat: 'AES-CBC',
      algorithm: 'PBKDF2',
      params: {
        iterations: 5_000,
      }
    },
    salt: obj.salt,
  };

  return {
    payload,
    payloadText: JSON.stringify(payload),
  }
}

keyringStateFiles.reduce(async (prev, f, idx) => {
  await prev;
  const isFirst = idx === 0

  if (!isFirst) {
    console.log();
    console.log('------------------------------');
  }
  console.log(`Decrypting ${f}...`);

  const fullpath = path.join(SCRIPT_DIR, f);

  const keyringState = JSON.parse(fs.readFileSync(fullpath, 'utf8'));

  const password = keyringState.password || DEFAULT_PWD;

  const opts = {
    algorithm: 'PBKDF2',
    iterations: 5000,
  };

  const booted = await browserPassword.decrypt(password, formatPayload(keyringState.booted).payloadText);
  // console.log(`Booted: ${JSON.stringify(booted, null, 2)}`);

  const vault = await browserPassword.decrypt(password, formatPayload(keyringState.vault).payloadText);
  // console.log(`Vault: ${JSON.stringify(vault, null, 2)}`);

  const parseFile = getParsedFileName(f);

  console.log(`Decrypting ${f}... success, written to ${parseFile}`);

  fs.writeFileSync(parseFile, JSON.stringify({
    booted,
    vault,
  }, null, 2));


  return ;
}, Promise.resolve());
