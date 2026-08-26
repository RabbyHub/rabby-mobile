import {
  formatReserves,
  formatReservesAndIncentives,
  formatUserSummary,
  formatUserSummaryAndIncentives,
} from '@aave/math-utils';

import './_setup';
import {
  assertWorkerRuntimeCapabilities,
  getWorkerRuntimeCapabilitySnapshot,
} from './_polyfills';
import { configureWorkerLogging, finalizeWorkerLogArchive } from './_logging';
import { ThreadSelf, threadSelfEE } from './utils/ThreadSelf';
import { stringUtils } from '@rabby-wallet/base-utils';
import {
  acknowledgeAssetSyncPersistenceTask,
  cancelAssetSyncInWorker,
  syncTokenAssetsInWorker,
} from './asset-sync/runtime';

function summarizeAssetSyncReceipt(
  receipt: Awaited<ReturnType<typeof syncTokenAssetsInWorker>>,
) {
  return {
    outcome: receipt.outcome,
    addressCount: receipt.addresses.length,
    completeAddressCount: receipt.addresses.filter(
      address => address.outcome === 'complete',
    ).length,
    committedRowCount: receipt.addresses.reduce(
      (count, address) => count + address.committedRowCount,
      0,
    ),
    durationMs: receipt.finishedAt - receipt.startedAt,
  };
}

// // send a message, strings only
// ThreadSelf.postMessage('hello');

threadSelfEE.addListener('msgToThread', message => {
  const msgData = stringUtils.safeParseJSON(message) as null | WorkerDuplexPost;

  switch (msgData?.type) {
    case '@runtimeInfo': {
      ThreadSelf.postMessage({
        type: 'response:@runtimeInfo',
        reqid: msgData.reqid,
        data: getWorkerRuntimeCapabilitySnapshot(),
      });
      break;
    }
    case 'logging:configure': {
      void configureWorkerLogging({
        captureConsole: msgData.captureConsole,
        writeToFile: msgData.writeToFile,
      })
        .then(state => {
          ThreadSelf.postMessage({
            type: 'response:logging:configure',
            reqid: msgData.reqid,
            data: state,
          });
        })
        .catch(error => {
          ThreadSelf.postMessage({
            type: 'response:logging:configure',
            reqid: msgData.reqid,
            errorCode: 'worker_logging_configure_failed',
            error:
              error instanceof Error
                ? error.message
                : 'Worker logging configuration failed',
          });
        });
      break;
    }
    case 'logging:finalize': {
      void finalizeWorkerLogArchive()
        .then(archivePath => {
          ThreadSelf.postMessage({
            type: 'response:logging:finalize',
            reqid: msgData.reqid,
            data: { archivePath },
          });
        })
        .catch(error => {
          ThreadSelf.postMessage({
            type: 'response:logging:finalize',
            reqid: msgData.reqid,
            errorCode: 'worker_logging_finalize_failed',
            error:
              error instanceof Error
                ? error.message
                : 'Worker log finalization failed',
          });
        });
      break;
    }
    case 'assetSync:token': {
      void Promise.resolve()
        .then(() => {
          const capabilities = assertWorkerRuntimeCapabilities();
          console.info('[AssetSync] start', {
            addressCount: msgData.request.addresses.length,
            force: msgData.request.force,
            host: msgData.request.bootstrap.host,
            runtime: capabilities.runtime,
            missingCapabilities: capabilities.missing,
          });
        })
        .then(() => syncTokenAssetsInWorker(msgData.request))
        .then(receipt => {
          console.info(
            '[AssetSync] complete',
            summarizeAssetSyncReceipt(receipt),
          );
          ThreadSelf.postMessage({
            type: 'response:assetSync:token',
            reqid: msgData.reqid,
            data: receipt,
          });
        })
        .catch(error => {
          console.warn('[AssetSync] failed', {
            message:
              error instanceof Error
                ? error.message
                : 'Worker asset sync failed',
          });
          ThreadSelf.postMessage({
            type: 'response:assetSync:token',
            reqid: msgData.reqid,
            errorCode: 'asset_sync_worker_failed',
            error:
              error instanceof Error
                ? error.message
                : 'Worker asset sync failed',
          });
        });
      break;
    }
    case 'assetSync:cancel': {
      ThreadSelf.postMessage({
        type: 'response:assetSync:cancel',
        reqid: msgData.reqid,
        data: {
          cancelled: cancelAssetSyncInWorker(msgData.requestId),
        },
      });
      break;
    }
    case 'assetSync:persistence-ack': {
      try {
        const accepted = acknowledgeAssetSyncPersistenceTask(msgData.ack);
        ThreadSelf.postMessage({
          type: 'response:assetSync:persistence-ack',
          reqid: msgData.reqid,
          data: { accepted },
        });
      } catch (error) {
        ThreadSelf.postMessage({
          type: 'response:assetSync:persistence-ack',
          reqid: msgData.reqid,
          errorCode: 'asset_sync_persistence_ack_invalid',
          error:
            error instanceof Error
              ? error.message
              : 'Asset sync persistence acknowledgement is invalid',
        });
      }
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
