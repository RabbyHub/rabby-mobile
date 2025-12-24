import { Thread } from '@/core/native/RNThread';

import { RefLikeObject } from '@/utils/type';

const threadRef: RefLikeObject<Thread | null> = { current: null };
// relative path from the app bundle root
threadRef.current = new Thread('worker-src/worker.thread.js');

export const workerThread = threadRef.current!;

export function startComputationThread() {
  const thread = threadRef.current!;
  thread.start();
}
