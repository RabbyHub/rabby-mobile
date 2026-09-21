import { E2E_ID } from '@/constant/e2e';
import { APP_RUNTIME_ENV } from '@/constant/env';

type NestedStringValues<T> = T extends string
  ? T
  : T extends Record<string, infer V>
  ? NestedStringValues<V>
  : never;

export type E2ETestID = NestedStringValues<typeof E2E_ID>;

type TestIDProps = {
  testID?: E2ETestID;
  accessibilityLabel?: E2ETestID;
};

export function makeTestIDProps(
  testID: E2ETestID | null,
  accessibilityLabel?: E2ETestID | null,
): TestIDProps {
  if (APP_RUNTIME_ENV === 'production' || !testID) {
    return {};
  }

  const resolvedAccessibilityLabel = accessibilityLabel ?? testID;

  return {
    testID,
    accessibilityLabel: resolvedAccessibilityLabel,
  };
}
