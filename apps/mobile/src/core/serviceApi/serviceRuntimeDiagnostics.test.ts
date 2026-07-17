import {
  beginServiceContractCall,
  finishServiceContractCall,
  getServiceRuntimeDiagnosticsSnapshot,
  recordServiceLifecycleEvent,
  SERVICE_CALL_PENDING_WARN_MS,
  setServiceRuntimeDiagnosticsContextProvider,
} from './serviceRuntimeDiagnostics';

describe('service runtime diagnostics', () => {
  afterEach(() => {
    jest.useRealTimers();
    setServiceRuntimeDiagnosticsContextProvider(null);
  });

  it('records lifecycle state without requiring a mounted panel', () => {
    recordServiceLifecycleEvent('dappService', 'loading', {
      reason: 'test_load',
    });
    recordServiceLifecycleEvent('dappService', 'ready', {
      reason: 'test_ready',
      durationMs: 12,
    });

    const snapshot = getServiceRuntimeDiagnosticsSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.loadingServiceCount).toBe(0);
    expect(
      snapshot.serviceEvents.find(
        record =>
          record.serviceName === 'dappService' &&
          record.reason === 'test_ready',
      ),
    ).toMatchObject({
      status: 'ready',
      durationMs: 12,
    });
  });

  it('marks a pending contract call as slow and captures route context', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    setServiceRuntimeDiagnosticsContextProvider(() => ({
      route: 'TestRoute',
    }));

    const callId = beginServiceContractCall('dappService', 'getDapp');
    jest.advanceTimersByTime(SERVICE_CALL_PENDING_WARN_MS);

    let call = getServiceRuntimeDiagnosticsSnapshot().calls.find(
      record => record.id === callId,
    );
    expect(call).toMatchObject({
      serviceName: 'dappService',
      method: 'getDapp',
      semantic: 'query',
      status: 'pending',
      slow: true,
      route: 'TestRoute',
    });

    jest.advanceTimersByTime(25);
    finishServiceContractCall(callId, 'resolved');
    call = getServiceRuntimeDiagnosticsSnapshot().calls.find(
      record => record.id === callId,
    );
    expect(call).toMatchObject({
      status: 'resolved',
      durationMs: SERVICE_CALL_PENDING_WARN_MS + 25,
    });
  });

  it('records rejected calls without waiting for the slow threshold', () => {
    const callId = beginServiceContractCall('sessionService', 'broadcastEvent');
    finishServiceContractCall(callId, 'rejected', new Error('not ready'));

    const snapshot = getServiceRuntimeDiagnosticsSnapshot();
    expect(snapshot.calls.find(record => record.id === callId)).toMatchObject({
      status: 'rejected',
      error: 'not ready',
    });
    expect(snapshot.rejectedCallCount).toBeGreaterThan(0);
    expect(snapshot.errorCount).toBe(0);
  });
});
