import {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummary,
  formatUserSummaryAndIncentives,
} from '@aave/math-utils';

import './_setup';
import { ThreadSelf, threadSelfEE } from './utils/ThreadSelf';
import { stringUtils } from '@rabby-wallet/base-utils';

// // send a message, strings only
// ThreadSelf.postMessage('hello');

function nowMs() {
  const performanceApi = (
    globalThis as typeof globalThis & {
      performance?: { now?: () => number };
    }
  ).performance;

  return typeof performanceApi?.now === 'function'
    ? performanceApi.now()
    : Date.now();
}

function roundMs(value: number) {
  return Math.round(value * 10) / 10;
}

function approximateUtf8ByteLength(input: string) {
  let bytes = 0;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }

  return bytes;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

function postWorkerLog(
  reqid: string | undefined,
  event: string,
  data: Record<string, unknown> = {},
) {
  ThreadSelf.postMessage({
    type: '@workerLog',
    reqid,
    time: Date.now(),
    event,
    data,
  });
}

async function handleFetchProbe(
  msgData: Extract<WorkerDuplexPost, { type: 'fetchProbe' }>,
) {
  const startedAt = nowMs();
  const timeoutMs = Math.max(1, msgData.timeoutMs || 10_000);
  const readBodyLimit = Math.max(
    0,
    Math.min(msgData.readBodyLimit ?? 256, 2048),
  );
  const abortController =
    typeof AbortController === 'function' ? new AbortController() : null;
  let timedOut = false;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    abortController?.abort();
  }, timeoutMs);

  postWorkerLog(msgData.reqid, 'fetch_probe_start', {
    url: msgData.url,
    method: msgData.method || 'GET',
    timeoutMs,
    readBody: msgData.readBody !== false,
  });

  try {
    const response = await fetch(msgData.url, {
      method: msgData.method || 'GET',
      headers: msgData.headers,
      ...(abortController ? { signal: abortController.signal } : {}),
    });
    const headerElapsedMs = nowMs() - startedAt;
    const contentType = response.headers?.get?.('content-type') || null;

    postWorkerLog(msgData.reqid, 'fetch_probe_headers', {
      status: response.status,
      ok: response.ok,
      elapsedMs: roundMs(headerElapsedMs),
      contentType,
    });

    let bodyChars = 0;
    let bodyBytes = 0;
    let bodyElapsedMs = 0;
    let preview = '';

    if (msgData.readBody !== false) {
      const bodyStartedAt = nowMs();
      const text = await response.text();
      bodyElapsedMs = nowMs() - bodyStartedAt;
      bodyChars = text.length;
      bodyBytes = approximateUtf8ByteLength(text);
      preview = readBodyLimit > 0 ? text.slice(0, readBodyLimit) : '';

      postWorkerLog(msgData.reqid, 'fetch_probe_body', {
        bodyChars,
        bodyBytes,
        elapsedMs: roundMs(bodyElapsedMs),
      });
    }

    ThreadSelf.postMessage({
      type: 'response:fetchProbe',
      reqid: msgData.reqid,
      data: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url || msgData.url,
        elapsedMs: roundMs(nowMs() - startedAt),
        headerElapsedMs: roundMs(headerElapsedMs),
        bodyElapsedMs: roundMs(bodyElapsedMs),
        bodyChars,
        bodyBytes,
        contentType,
        preview,
        timedOut,
      },
    });
  } catch (error) {
    const elapsedMs = roundMs(nowMs() - startedAt);
    const message = serializeError(error);

    postWorkerLog(msgData.reqid, 'fetch_probe_error', {
      elapsedMs,
      timedOut,
      error: message,
    });

    ThreadSelf.postMessage({
      type: 'response:fetchProbe',
      reqid: msgData.reqid,
      errorCode: timedOut ? 'Timeout' : 'FetchError',
      error: message,
      data: {
        ok: false,
        status: 0,
        statusText: '',
        url: msgData.url,
        elapsedMs,
        headerElapsedMs: 0,
        bodyElapsedMs: 0,
        bodyChars: 0,
        bodyBytes: 0,
        contentType: null,
        preview: '',
        timedOut,
        error: message,
      },
    });
  } finally {
    clearTimeout(timeoutTimer);
  }
}

threadSelfEE.addListener('msgToThread', message => {
  const msgData = stringUtils.safeParseJSON(message) as null | WorkerDuplexPost;

  switch (msgData?.type) {
    case 'fetchProbe': {
      void handleFetchProbe(msgData);
      break;
    }
    case 'formatReserves': {
      const result = formatReserves(msgData.data);

      ThreadSelf.postMessage({
        type: `response:formatReserves`,
        reqid: msgData.reqid,
        data: {
          result,
        },
      });
      break;
    }
    case 'formatUserSummary': {
      const result = formatUserSummary(msgData.data);

      ThreadSelf.postMessage({
        type: `response:formatUserSummary`,
        reqid: msgData.reqid,
        data: {
          result,
        },
      });
      break;
    }
    case 'formatReservesAndIncentives': {
      const result = formatReservesAndIncentives(msgData.data);

      ThreadSelf.postMessage({
        type: `response:formatReservesAndIncentives`,
        reqid: msgData.reqid,
        data: {
          result,
        },
      });
      break;
    }
    case 'formatUserSummaryAndIncentives': {
      const result = formatUserSummaryAndIncentives(msgData.data);

      ThreadSelf.postMessage({
        type: `response:formatUserSummaryAndIncentives`,
        reqid: msgData.reqid,
        data: {
          result,
        },
      });
      break;
    }
    default: {
      if (!msgData) {
        ThreadSelf.postMessage({
          type: '@errorReq',
          errorCode: 'InvalidMessageFormat',
          error: 'Invalid message format',
        });
      } /*  else if (msgData?.type) {
        ThreadSelf.postMessage({
          type: '@errorReq',
          reqid: msgData.reqid,
          errorCode: 'UnknownMessageType',
          error: `Unknown message type: ${msgData.type}`,
        });
      } */
      break;
    }
    case '@DevTest': {
      if (msgData.purpose === 'triggerError') {
        ThreadSelf.postMessage({
          type: 'response:@DevTest',
          reqid: msgData.reqid,
          data: {
            result: 'This will trigger an error',
          },
        });
        throw new Error('DevTest triggered error in Worker thread');
      } else if (msgData.purpose === 'triggerGC') {
        globalThis.gc?.();
        ThreadSelf.postMessage({
          type: 'response:@DevTest',
          reqid: msgData.reqid,
          data: {
            result: 'Garbage collection triggered',
          },
        });
        return;
      }
      ThreadSelf.postMessage({
        type: 'response:@DevTest',
        reqid: msgData.reqid,
        data: {
          result: 'DevTest response from Worker thread',
        },
      });
      break;
    }
    case 'plus': {
      const ret = msgData.leftValue + msgData.rightValue;

      ThreadSelf.postMessage({
        type: `response:plus`,
        reqid: msgData.reqid,
        data: ret,
      });
      break;
    }
  }
});
