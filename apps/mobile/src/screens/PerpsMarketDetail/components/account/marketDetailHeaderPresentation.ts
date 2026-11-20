import {
  createAccountHeaderPresentation,
  EMPTY_ACCOUNT_QUOTE,
  sameAccountHeader,
  type AccountHeaderSnapshot,
} from './model';

const emptySnapshot: AccountHeaderSnapshot = {
  compact: false,
  quote: EMPTY_ACCOUNT_QUOTE,
};
type Listener = (snapshot: AccountHeaderSnapshot) => void;
type Channel = {
  owner: object | null;
  snapshot: AccountHeaderSnapshot;
  listeners: Set<Listener>;
};

// The screen and its declarative navigator header are siblings. Scope their
// small display channel to the route instance, never the globally active coin.
const channels = new Map<string, Channel>();
const channelKey = (routeKey: string, market: string) =>
  JSON.stringify([routeKey, market]);
const getChannel = (key: string) => {
  let channel = channels.get(key);
  if (!channel) {
    channel = { owner: null, snapshot: emptySnapshot, listeners: new Set() };
    channels.set(key, channel);
  }
  return channel;
};
const publish = (channel: Channel, snapshot: AccountHeaderSnapshot) => {
  if (sameAccountHeader(channel.snapshot, snapshot)) {
    return;
  }
  channel.snapshot = snapshot;
  channel.listeners.forEach(listener => listener(snapshot));
};
const releaseUnusedChannel = (key: string, channel: Channel) => {
  if (
    !channel.owner &&
    !channel.listeners.size &&
    channels.get(key) === channel
  ) {
    channels.delete(key);
  }
};

export function subscribePerpsMarketDetailHeader(
  routeKey: string,
  market: string,
  listener: Listener,
) {
  const key = channelKey(routeKey, market);
  const channel = getChannel(key);
  channel.listeners.add(listener);
  listener(channel.snapshot);
  return () => {
    channel.listeners.delete(listener);
    releaseUnusedChannel(key, channel);
  };
}

/** Creating a render-local source allocates no shared state until activation. */
export function createPerpsMarketDetailHeaderSource(
  routeKey: string,
  market: string,
) {
  const key = channelKey(routeKey, market);
  let binding: { channel: Channel; owner: object } | null = null;
  const presentation = createAccountHeaderPresentation(snapshot => {
    if (binding && binding.channel.owner === binding.owner) {
      publish(binding.channel, snapshot);
    }
  });
  return {
    presentation,
    activate: () => {
      const channel = getChannel(key);
      const owner = {};
      const activeBinding = { channel, owner };
      binding = activeBinding;
      channel.owner = owner;
      publish(channel, presentation.snapshot.current);
      return () => {
        if (binding === activeBinding) {
          binding = null;
        }
        if (channel.owner !== owner) {
          return;
        }
        channel.owner = null;
        publish(channel, emptySnapshot);
        releaseUnusedChannel(key, channel);
      };
    },
  };
}
