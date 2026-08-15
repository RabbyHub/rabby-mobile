import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type PerpsRealtimeStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'stale'
  | 'error';

export type PerpsRealtimePublicationSnapshot = {
  error: Error | null;
  identity: string;
  receivedAt: number | null;
  revision: number;
  status: PerpsRealtimeStatus;
};

const isFresh = (receivedAt: number | null, ttlMs: number, now: number) =>
  receivedAt != null && now - receivedAt < ttlMs;

/**
 * React-facing publication gate shared by realtime feeds. The SDK owner stays
 * outside this hook, so pausing publication never tears down logical replay
 * registration. A foreground transition remains stale until a frame received
 * at or after that transition advances the visible revision.
 */
export const usePerpsRealtimePublication = <
  TSnapshot extends PerpsRealtimePublicationSnapshot,
>({
  clearValue,
  createDisabledSnapshot,
  createLoadingSnapshot,
  displayCacheMs,
  hasValue,
  identity,
  publicationEnabled,
  readSnapshot,
  subscribe,
}: {
  clearValue: (snapshot: TSnapshot) => TSnapshot;
  createDisabledSnapshot: () => TSnapshot;
  createLoadingSnapshot: (identity: string) => TSnapshot;
  displayCacheMs: number;
  hasValue: (snapshot: TSnapshot) => boolean;
  identity: string;
  publicationEnabled: boolean;
  readSnapshot: () => TSnapshot;
  subscribe: ((listener: (snapshot: TSnapshot) => void) => () => void) | null;
}) => {
  const [snapshot, setSnapshot] = useState<TSnapshot>(() =>
    identity === 'disabled' ? createDisabledSnapshot() : readSnapshot(),
  );
  const [expirationClock, setExpirationClock] = useState(0);
  const publicationEnabledRef = useRef(publicationEnabled);
  const wasPublicationEnabled = publicationEnabledRef.current;
  publicationEnabledRef.current = publicationEnabled;
  const minimumLiveRevisionRef = useRef<number | null>(null);
  const resumeStartedAtRef = useRef<number | null>(null);
  const resumePendingRef = useRef(false);

  const forceStale = useCallback(
    (incoming: TSnapshot): TSnapshot =>
      incoming.status === 'error'
        ? incoming
        : {
            ...incoming,
            error: null,
            status: hasValue(incoming) ? 'stale' : 'loading',
          },
    [hasValue],
  );
  const snapshotHasValue = hasValue(snapshot);

  if (publicationEnabled && !wasPublicationEnabled) {
    minimumLiveRevisionRef.current =
      (snapshot.identity === identity ? snapshot.revision : 0) + 1;
    resumeStartedAtRef.current = Date.now();
    resumePendingRef.current = true;
  }

  useEffect(() => {
    minimumLiveRevisionRef.current = null;
    setExpirationClock(0);
    if (identity === 'disabled' || !subscribe) {
      setSnapshot(createDisabledSnapshot());
      return;
    }
    return subscribe(incoming => {
      if (!publicationEnabledRef.current) {
        return;
      }
      const minimumRevision = minimumLiveRevisionRef.current;
      if (
        minimumRevision != null &&
        incoming.status === 'ready' &&
        incoming.revision >= minimumRevision &&
        incoming.receivedAt != null &&
        incoming.receivedAt >= (resumeStartedAtRef.current ?? 0)
      ) {
        minimumLiveRevisionRef.current = null;
        setSnapshot(incoming);
        return;
      }
      setSnapshot(minimumRevision == null ? incoming : forceStale(incoming));
    });
  }, [createDisabledSnapshot, forceStale, identity, subscribe]);

  useEffect(() => {
    if (
      !publicationEnabled ||
      !resumePendingRef.current ||
      identity === 'disabled' ||
      !subscribe
    ) {
      return;
    }
    resumePendingRef.current = false;
    const current = readSnapshot();
    const minimumLiveRevision = minimumLiveRevisionRef.current;
    setExpirationClock(0);
    if (
      minimumLiveRevision != null &&
      current.status === 'ready' &&
      current.revision >= minimumLiveRevision &&
      current.receivedAt != null &&
      current.receivedAt >= (resumeStartedAtRef.current ?? 0)
    ) {
      minimumLiveRevisionRef.current = null;
      setSnapshot(current);
      return;
    }
    setSnapshot(forceStale(current));
  }, [forceStale, identity, publicationEnabled, readSnapshot, subscribe]);

  useEffect(() => {
    if (
      !publicationEnabled ||
      !snapshotHasValue ||
      snapshot.status === 'ready' ||
      snapshot.receivedAt == null
    ) {
      return;
    }
    const remaining = snapshot.receivedAt + displayCacheMs - Date.now();
    if (remaining <= 0) {
      setExpirationClock(Date.now());
      return;
    }
    const timer = setTimeout(() => setExpirationClock(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [
    displayCacheMs,
    publicationEnabled,
    snapshot.receivedAt,
    snapshot.status,
    snapshotHasValue,
  ]);

  // Paused and resuming both expose only non-live data, but they remain
  // distinct so the foreground render re-evaluates wall-clock freshness before
  // React can commit the retained background snapshot.
  const presentationPhase = !publicationEnabled
    ? 'paused'
    : minimumLiveRevisionRef.current != null
    ? 'resuming'
    : 'live';
  const presentationSnapshot = useMemo(
    () =>
      presentationPhase !== 'live' &&
      identity !== 'disabled' &&
      snapshot.identity === identity
        ? forceStale(snapshot)
        : snapshot,
    [forceStale, identity, presentationPhase, snapshot],
  );

  return useMemo(() => {
    if (presentationSnapshot.identity !== identity) {
      return identity === 'disabled'
        ? createDisabledSnapshot()
        : createLoadingSnapshot(identity);
    }
    if (
      hasValue(presentationSnapshot) &&
      presentationSnapshot.status !== 'ready' &&
      !isFresh(
        presentationSnapshot.receivedAt,
        displayCacheMs,
        expirationClock || Date.now(),
      )
    ) {
      return clearValue(presentationSnapshot);
    }
    return presentationSnapshot;
  }, [
    clearValue,
    createDisabledSnapshot,
    createLoadingSnapshot,
    displayCacheMs,
    expirationClock,
    hasValue,
    identity,
    presentationSnapshot,
  ]);
};
