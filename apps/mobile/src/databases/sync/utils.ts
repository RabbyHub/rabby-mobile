import { RefLikeObject } from '@/utils/type';
import { BalanceEntity } from '../entities/balance';
import { NFTItemEntity } from '../entities/nftItem';
import { ProtocolItemEntity } from '../entities/portocolItem';

const TX_COMPLETED_BALANCE_EXPIRE_DELAY = 20 * 1000;

export const updateExpiredTime = async (_address: string, offest?: number) => {
  const address = _address.toLowerCase();
  try {
    await Promise.all([
      // TokenItemEntity.willExpired(address, offest),
      // 交易后balance不会立即刷新，故设置20s过期
      BalanceEntity.willExpired(
        address,
        (offest || 0) + TX_COMPLETED_BALANCE_EXPIRE_DELAY,
      ),
      NFTItemEntity.willExpired(address, offest),
      ProtocolItemEntity.willExpired(address, offest),
    ]);
  } catch (error) {
    console.log('update expired', error);
  }
};

const labelCounter: Record<string, number> = {};
function incByLabel(label: string) {
  labelCounter[label] = (labelCounter[label] || 0) + 1;
  return labelCounter[label];
}
const abortControllersByLabel: Record<string, AbortController | null> = {};
export function wrapAbortableFn({
  fn,
  label: labelOrList,
  externalControllerRef,
  onFinally,
}: {
  fn: (signal: AbortSignal) => Promise<void>;
  label: string | string[];
  externalControllerRef?: RefLikeObject<AbortController | null>;
  onFinally?: (signal: AbortSignal) => void;
}) {
  const label = Array.isArray(labelOrList)
    ? labelOrList.join('-')
    : labelOrList;
  const logPrefix = [
    '[abortableFn]',
    label ? `[${label}::${incByLabel(label)}] ` : '',
  ].join('');

  const run = async () => {
    const onExternalAborted = () => {
      console.debug(
        `${logPrefix}Request was aborted due to external controller`,
      );
      abortControllersByLabel[label]?.abort();
      externalControllerRef?.current?.signal.removeEventListener(
        'abort',
        onExternalAborted,
      );
    };
    externalControllerRef?.current?.signal.addEventListener(
      'abort',
      onExternalAborted,
    );
    // abort previous
    if (abortControllersByLabel[label]) abortControllersByLabel[label].abort();
    abortControllersByLabel[label] = new AbortController();

    const { signal } = abortControllersByLabel[label];

    const p = signal.aborted
      ? Promise.resolve()
      : fn(signal)
          .then(res => {
            console.log(`${logPrefix}Request succeeded:`, res);
            return res;
          })
          .catch(error => {
            console.error(`${logPrefix}Request failed:`, error);
          });

    return p.finally(() => {
      onFinally?.(signal);
      if (signal.aborted) {
        console.debug(`${logPrefix}Request was aborted`);
      }
    });
  };

  const abort = () => {
    abortControllersByLabel[label]?.abort();
  };

  const getAbortController = () => {
    return abortControllersByLabel[label];
  };

  return { run, abort, getAbortController };
}
