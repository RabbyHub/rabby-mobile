import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { uploadFile } from './publish.mjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-only-proxy-test-'));
const keyPath = path.join(tmpDir, 'key.pem');
const certPath = path.join(tmpDir, 'cert.pem');

let hasOpenSsl = true;
try {
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ],
    { stdio: 'ignore' },
  );
} catch {
  hasOpenSsl = false;
}

let targetServer;
let proxyServer;
let targetPort;
let proxyPort;
let proxyConnects = 0;
let receivedBytes = 0;

before(async () => {
  if (!hasOpenSsl) return;

  targetServer = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    (request, response) => {
      request.on('data', chunk => {
        receivedBytes += chunk.length;
      });
      request.on('end', () => {
        response.writeHead(200);
        response.end('ok');
      });
    },
  );
  await new Promise(resolve => targetServer.listen(0, '127.0.0.1', resolve));
  targetPort = targetServer.address().port;

  proxyServer = net.createServer(socket => {
    socket.on('error', () => {});
    socket.once('data', chunk => {
      const header = chunk.toString('latin1');
      const requestLine = header.split('\r\n')[0];
      const match = requestLine.match(/^CONNECT\s+([^:]+):(\d+)/);
      if (!match) {
        socket.destroy();
        return;
      }
      proxyConnects += 1;
      const upstream = net.connect(Number(match[2]), match[1], () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on('error', () => socket.destroy());
    });
  });
  await new Promise(resolve => proxyServer.listen(0, '127.0.0.1', resolve));
  proxyPort = proxyServer.address().port;
});

after(async () => {
  if (targetServer) {
    await new Promise(resolve => targetServer.close(resolve));
  }
  if (proxyServer) {
    await new Promise(resolve => proxyServer.close(resolve));
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('uploadFile sends the PUT through the CONNECT proxy', async t => {
  if (!hasOpenSsl) {
    t.skip('openssl is not available');
    return;
  }

  const payload = Buffer.alloc(64 * 1024, 0x61);
  const filePath = path.join(tmpDir, 'payload.apk');
  fs.writeFileSync(filePath, payload);

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    await uploadFile(
      `https://localhost:${targetPort}/upload`,
      filePath,
      { 'Content-Type': 'application/vnd.android.package-archive' },
      payload.length,
      `http://127.0.0.1:${proxyPort}`,
    );
  } finally {
    delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  }

  assert.ok(proxyConnects > 0, 'proxy must receive a CONNECT request');
  assert.equal(receivedBytes, payload.length, 'payload must reach the target');
});
