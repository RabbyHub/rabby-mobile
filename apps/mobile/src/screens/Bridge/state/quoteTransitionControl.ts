import { makeMutable } from 'react-native-reanimated';

/**
 * Monotonic token bumped when the displayed best quote switches to a different
 * source (provider/bridge).
 *
 * It is the single trigger of the quote transition animations. Every consumer
 * reacts to it on the UI thread, so they all start on the same frame instead of
 * each element running its own React effect.
 */
export const quoteTransitionToken = makeMutable(0);

export function bumpQuoteTransition() {
  quoteTransitionToken.value += 1;
}
