import http from 'node:http';

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function httpGetText(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      if (response.statusCode && response.statusCode >= 400) {
        response.resume();
        reject(
          new Error(
            `[maestro:devtools] HTTP ${response.statusCode} while requesting ${url}`,
          ),
        );
        return;
      }

      response.setEncoding('utf8');
      let body = '';
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        resolve(body);
      });
    });

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(
        new Error(`[maestro:devtools] Timed out while requesting ${url}`),
      );
    });
  });
}

export async function listMetroTargets({
  host = '127.0.0.1',
  port = 8081,
  timeoutMs = 5000,
} = {}) {
  const raw = await httpGetText(`http://${host}:${port}/json/list`, timeoutMs);
  return JSON.parse(raw);
}

export async function resolveMetroInspectorTarget({
  appId,
  host = '127.0.0.1',
  port = 8081,
  timeoutMs = 5000,
} = {}) {
  const targets = await listMetroTargets({ host, port, timeoutMs });
  const candidates = targets.filter(target => {
    return target.appId === appId && target.webSocketDebuggerUrl;
  });

  const preferredTarget =
    candidates.find(target =>
      String(target.description || '').includes('React Native Bridge'),
    ) ||
    candidates.find(target =>
      String(target.webSocketDebuggerUrl || '').includes('page=1'),
    ) ||
    candidates[0];

  if (!preferredTarget) {
    throw new Error(
      `[maestro:devtools] No Metro inspector target found for app ${appId}. Make sure Metro is running and the debug package is connected.`,
    );
  }

  return preferredTarget;
}

function renderRemoteException(exceptionDetails) {
  return (
    exceptionDetails?.exception?.description ||
    exceptionDetails?.text ||
    'Unknown DevTools runtime exception'
  );
}

export async function evaluateInspectorExpression({
  webSocketDebuggerUrl,
  expression,
  timeoutMs = 10000,
} = {}) {
  return await new Promise((resolve, reject) => {
    const websocket = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map();
    let sequence = 0;
    let settled = false;

    const settle = (handler, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(overallTimer);
      for (const item of pending.values()) {
        clearTimeout(item.timer);
      }
      pending.clear();
      try {
        websocket.close();
      } catch {
        // ignore close errors during teardown
      }
      handler(value);
    };

    const overallTimer = setTimeout(() => {
      settle(
        reject,
        new Error(
          `[maestro:devtools] Timed out while evaluating DevTools expression`,
        ),
      );
    }, timeoutMs);

    const send = (method, params = {}) => {
      const id = ++sequence;
      websocket.send(JSON.stringify({ id, method, params }));

      return new Promise((resolveMessage, rejectMessage) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectMessage(
            new Error(`[maestro:devtools] Timed out waiting for ${method}`),
          );
        }, timeoutMs);

        pending.set(id, {
          resolve: resolveMessage,
          reject: rejectMessage,
          timer,
        });
      });
    };

    websocket.addEventListener('message', event => {
      const message = JSON.parse(event.data.toString());
      if (!message.id || !pending.has(message.id)) {
        return;
      }

      const entry = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(entry.timer);

      if (message.error) {
        entry.reject(
          new Error(
            `[maestro:devtools] ${message.error.message || 'Inspector error'}`,
          ),
        );
        return;
      }

      entry.resolve(message);
    });

    websocket.addEventListener('open', async () => {
      try {
        await send('Runtime.enable');
        const evaluation = await send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        const exceptionDetails = evaluation?.result?.exceptionDetails;

        if (exceptionDetails) {
          throw new Error(renderRemoteException(exceptionDetails));
        }

        settle(resolve, evaluation?.result?.result?.value);
      } catch (error) {
        settle(reject, error);
      }
    });

    websocket.addEventListener('error', event => {
      settle(
        reject,
        new Error(
          `[maestro:devtools] WebSocket error: ${
            event?.message || 'Unable to connect to Metro inspector'
          }`,
        ),
      );
    });

    websocket.addEventListener('close', event => {
      if (!settled) {
        settle(
          reject,
          new Error(
            `[maestro:devtools] Inspector socket closed before evaluation completed (code ${event.code})`,
          ),
        );
      }
    });
  });
}

export async function callRabbyDevtoolsBridgeMethod({
  appId,
  method,
  args = [],
  host = '127.0.0.1',
  port = 8081,
  timeoutMs = 10000,
} = {}) {
  const target = await resolveMetroInspectorTarget({
    appId,
    host,
    port,
    timeoutMs,
  });
  const expression = `(() => {
    const bridge = globalThis.__RABBY_DEVTOOLS_BRIDGE__;
    if (!bridge) {
      throw new Error('Rabby DevTools bridge is not installed. Restart Metro and relaunch the debug app.');
    }
    const targetMethod = bridge[${JSON.stringify(method)}];
    if (typeof targetMethod !== 'function') {
      throw new Error('Rabby DevTools bridge method ${method} is not available.');
    }
    return {
      method: ${JSON.stringify(method)},
      value: targetMethod(...${JSON.stringify(args)}),
    };
  })()`;
  const raw = await evaluateInspectorExpression({
    webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    expression,
    timeoutMs,
  });

  return {
    target,
    result: raw,
  };
}

export async function waitForRabbyDevtoolsBridgeMethod({
  appId,
  method,
  args = [],
  accept = value => Boolean(value),
  timeoutMs = 30000,
  intervalMs = 1000,
  host = '127.0.0.1',
  port = 8081,
} = {}) {
  const startedAt = Date.now();
  let lastResult = null;
  let lastError = null;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastResult = await callRabbyDevtoolsBridgeMethod({
        appId,
        method,
        args,
        host,
        port,
        timeoutMs: Math.min(timeoutMs, 10000),
      });

      if (accept(lastResult.result?.value, lastResult)) {
        return lastResult;
      }

      lastError = null;
    } catch (error) {
      lastError = error;
    }

    await sleep(intervalMs);
  }

  if (lastResult) {
    return lastResult;
  }

  throw (
    lastError ||
    new Error(
      `[maestro:devtools] Timed out waiting for bridge method ${method}`,
    )
  );
}
