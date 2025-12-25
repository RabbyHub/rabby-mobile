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

threadSelfEE.addListener('msgToThread', message => {
  const msgData = stringUtils.safeParseJSON(message) as null | WorkerDuplexPost;

  switch (msgData?.type) {
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
