import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import {
  runOnJS,
  runOnUI,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

type Sample = {
  session: number;
  revision: number;
  initial: number;
  value: number;
  ended: boolean;
};

/** Opt-in publication for a controlled slider whose artwork is owned by the UI. */
export function useLatestSliderValue({
  enabled,
  configuration,
  position,
  value,
  onSlidingStart,
  onValueChange,
  onSlidingComplete,
}: {
  enabled: boolean;
  configuration: object;
  position: SharedValue<number>;
  value: number;
  onSlidingStart?: (value: number) => void;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
}) {
  const serial = useRef(0);
  const { id: owner } = useMemo(
    () => ({ id: ++serial.current, configuration, enabled }),
    [configuration, enabled],
  );
  const generation = useSharedValue(0);
  const mailbox = useSharedValue<Sample | null>(null);
  const ticket = useSharedValue(0);
  const pending = useSharedValue(false);
  const frame = useRef<number | null>(null);
  const delivered = useRef<Sample | null>(null);
  const acknowledged = useRef(0);
  const requestedTicket = useRef(0);
  const started = useRef<Sample | null>(null);
  const receiver = useRef<{
    owner: number;
    deliver: (sample: Sample, readTicket: number) => void;
  }>({ owner: -1, deliver: () => {} });
  const current = useRef({
    owner,
    value,
    onSlidingStart,
    onValueChange,
    onSlidingComplete,
  });

  useLayoutEffect(() => {
    current.current = {
      owner,
      value,
      onSlidingStart,
      onValueChange,
      onSlidingComplete,
    };
  });

  const syncControlled = useCallback(
    (next: number) => {
      const sample = delivered.current;
      // Stamp the command before scheduling it. An old echo must not become an
      // external edit merely because a newer final commit arrives on the UI first.
      const external = !!sample && acknowledged.current === sample.revision;
      if (sample?.ended && next === sample.value) {
        acknowledged.current = sample.revision;
      }
      runOnUI((revision: number, allowExternal: boolean) => {
        'worklet';
        if (generation.value !== owner) {
          return;
        }
        const latest = mailbox.value;
        if (!latest) {
          position.value = next;
        } else if (
          latest.ended &&
          latest.revision === revision &&
          (next === latest.value || allowExternal)
        ) {
          position.value = next;
        }
      })(sample?.revision ?? 0, external);
    },
    [generation, mailbox, owner, position],
  );

  // These two functions form an asynchronous handshake. There is at most one
  // outstanding read, regardless of how many native move events arrive.
  const receive = useCallback(
    (sample: Sample, readTicket: number, readOwner: number) => {
      if (receiver.current.owner === readOwner) {
        receiver.current.deliver(sample, readTicket);
      }
    },
    [],
  );
  const queueRead = useCallback(
    (readTicket: number) => {
      if (current.current.owner !== owner) {
        return;
      }
      if (readTicket <= requestedTicket.current) {
        return;
      }
      requestedTicket.current = readTicket;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        runOnUI(() => {
          'worklet';
          if (generation.value !== owner || ticket.value !== readTicket) {
            return;
          }
          const latest = mailbox.value;
          if (latest) {
            runOnJS(receive)(latest, readTicket, owner);
          }
        })();
      });
    },
    [generation, mailbox, owner, receive, ticket],
  );

  const deliver = useCallback(
    (sample: Sample, readTicket: number) => {
      if (current.current.owner !== owner) {
        return;
      }
      if (readTicket < requestedTicket.current) {
        return;
      }
      if (sample.revision <= (delivered.current?.revision ?? 0)) {
        return;
      }
      requestedTicket.current = Math.max(requestedTicket.current, readTicket);
      const previous = started.current;
      delivered.current = sample;
      if (sample.ended && frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      if (previous?.session !== sample.session) {
        if (previous) {
          current.current.onSlidingComplete?.(previous.value);
        }
        current.current.onSlidingStart?.(sample.initial);
      }
      started.current = sample.ended ? null : sample;
      current.current.onValueChange?.(sample.value);
      if (sample.ended) {
        current.current.onSlidingComplete?.(sample.value);
        // Also acknowledge a final value which was already rendered: React may
        // correctly bail out of setState and never produce another layout effect.
        syncControlled(current.current.value);
      }
      runOnUI(() => {
        'worklet';
        if (generation.value !== owner || ticket.value !== readTicket) {
          return;
        }
        const latest = mailbox.value;
        if (latest && !latest.ended && latest.revision > sample.revision) {
          ticket.value += 1;
          runOnJS(queueRead)(ticket.value);
        } else {
          pending.value = false;
        }
      })();
    },
    [generation, mailbox, owner, pending, queueRead, syncControlled, ticket],
  );

  useLayoutEffect(() => {
    receiver.current = { owner, deliver };
  }, [deliver, owner]);

  const publish = useCallback(
    (session: number, initial: number, next: number, ended: boolean) => {
      'worklet';
      if (generation.value !== owner) {
        return;
      }
      const sample: Sample = {
        session,
        initial,
        value: next,
        ended,
        revision: (mailbox.value?.revision ?? 0) + 1,
      };
      mailbox.value = sample;
      if (ended) {
        // Final delivery bypasses the frame sampler and invalidates its pending
        // read/ack. It carries the UI value, never the last value JS happened to see.
        ticket.value += 1;
        pending.value = false;
        runOnJS(deliver)(sample, ticket.value);
      } else if (!pending.value) {
        pending.value = true;
        ticket.value += 1;
        runOnJS(queueRead)(ticket.value);
      }
    },
    [deliver, generation, mailbox, owner, pending, queueRead, ticket],
  );

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    delivered.current = null;
    acknowledged.current = 0;
    requestedTicket.current = 0;
    runOnUI(() => {
      'worklet';
      generation.value = owner;
      mailbox.value = null;
      pending.value = false;
      ticket.value += 1;
    })();
    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
      frame.current = null;
      const previous = started.current;
      started.current = null;
      if (previous) {
        current.current.onSlidingComplete?.(previous.value);
      }
      if (current.current.owner === owner) {
        current.current = { ...current.current, owner: -1 };
      }
      runOnUI(() => {
        'worklet';
        if (generation.value === owner) {
          generation.value = -1;
        }
      })();
    };
  }, [enabled, generation, mailbox, owner, pending, ticket]);

  useLayoutEffect(() => {
    if (enabled) {
      syncControlled(value);
    }
  }, [enabled, owner, syncControlled, value]);

  return publish;
}
