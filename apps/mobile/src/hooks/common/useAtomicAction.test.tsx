import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { atom, Provider } from 'jotai';

import { useAtomicRequest } from './useAtomicAction';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

describe('useAtomicRequest', () => {
  beforeEach(() => {
    jest.spyOn(console, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the request once and toggles the requesting atom around the call', async () => {
    const isRequestingAtom = atom(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    );
    const doRequest = jest.fn((value: number) => value * 2);

    const { result } = renderHook(
      () =>
        useAtomicRequest({
          isRequestingAtom,
          doRequest,
        }),
      { wrapper },
    );

    let output: number | undefined;
    await act(async () => {
      output = await result.current.fetchAction(2);
    });

    expect(output).toBe(4);
    expect(doRequest).toHaveBeenCalledTimes(1);
    expect(doRequest).toHaveBeenCalledWith(2);
  });

  it('does not start a second request while the atom already says it is requesting', async () => {
    const isRequestingAtom = atom(true);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    );
    const doRequest = jest.fn();

    const { result } = renderHook(
      () =>
        useAtomicRequest({
          isRequestingAtom,
          doRequest,
        }),
      { wrapper },
    );

    let output: unknown;
    await act(async () => {
      output = await result.current.fetchAction('ignored');
    });

    expect(output).toBeUndefined();
    expect(doRequest).not.toHaveBeenCalled();
  });

  it('captures synchronous request errors and clears the atom immediately', async () => {
    const isRequestingAtom = atom(false);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider>{children}</Provider>
    );
    const error = new Error('boom');
    const doRequest = jest.fn(() => {
      throw error;
    });
    const { captureException } =
      require('@sentry/react-native') as typeof import('@sentry/react-native');

    const { result } = renderHook(
      () =>
        useAtomicRequest({
          isRequestingAtom,
          doRequest,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.fetchAction();
    });

    expect(captureException).toHaveBeenCalledWith(error);

    let nextCall: unknown;
    await act(async () => {
      nextCall = await result.current.fetchAction();
    });

    expect(nextCall).toBeUndefined();
    expect(doRequest).toHaveBeenCalledTimes(2);
  });
});
