'use strict';

const fs = require('fs');
const http = require('http');

const portFile = process.argv[2];
if (!portFile) {
  throw new Error('port file is required');
}

const server = http.createServer((request, response) => {
  if (request.url === '/ok') {
    response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    response.end(Buffer.from('native-ok'));
    return;
  }
  if (request.url === '/echo') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      response.writeHead(201, { 'Content-Type': 'application/octet-stream' });
      response.end(Buffer.concat(chunks));
    });
    return;
  }
  if (request.url === '/redirect') {
    response.writeHead(302, { Location: '/ok' });
    response.end();
    return;
  }
  if (request.url === '/large') {
    const body = Buffer.alloc(1024, 7);
    response.writeHead(200, {
      'Content-Length': String(body.length),
      'Content-Type': 'application/octet-stream',
    });
    response.end(body);
    return;
  }
  if (request.url === '/slow') {
    const timer = setTimeout(() => {
      if (!response.destroyed) {
        response.writeHead(200);
        response.end('slow');
      }
    }, 500);
    request.on('close', () => clearTimeout(timer));
    return;
  }
  response.writeHead(404);
  response.end('missing');
});

server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  fs.writeFileSync(portFile, String(address.port), { mode: 0o600 });
});

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
