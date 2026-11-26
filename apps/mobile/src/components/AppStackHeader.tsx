import React from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

import {
  AutoFitCenterHeader,
  type AutoFitCenterHeaderProps,
} from '@/components/AutoFitCenterHeader';

export type AppStackHeaderProps = AutoFitCenterHeaderProps & {
  /**
   * Defaults to `true`. Route-level callers should pass
   * `navigation.canGoBack()` so the leading slot is filled only when there is
   * somewhere to go back to; the slot itself is kept either way so the title
   * stays centred.
   */
  back?: boolean;
  /** Optional trailing action rendered inside the fixed trailing slot. */
  right?: React.ReactNode;
};

/**
 * The route-level JS header for stack screens.
 *
 * Register it on the route (`header: renderAppStackHeader(...)`) instead of
 * installing a header from an effect after mount: swapping the header type mid
 * transition is what made iOS animate the previous native header out as a
 * duplicated copy ("header flies up", QA 2467).
 *
 * It shares the centred row implementation with `AutoFitCenterHeader`:
 * equal leading/trailing slots, the long-title typography ladder, the foldable
 * content-column inset, and the custom header top inset.
 */
export const AppStackHeader = ({ right, ...rest }: AppStackHeaderProps) => (
  <AutoFitCenterHeader {...rest} rightSlot={right} />
);

type AppStackHeaderOptions =
  | AppStackHeaderProps
  | ((headerProps: NativeStackHeaderProps) => AppStackHeaderProps);

/**
 * Builds a `header` option for a route.
 *
 * ```tsx
 * options={({ route }) =>
 *   mergeScreenOptions({
 *     header: renderAppStackHeader(() => ({ title: t('page.x.title') })),
 *   })
 * }
 * ```
 */
export const renderAppStackHeader =
  (options: AppStackHeaderOptions) => (headerProps: NativeStackHeaderProps) => {
    const props =
      typeof options === 'function' ? options(headerProps) : options;

    return (
      <AppStackHeader
        {...props}
        back={props.back ?? headerProps.navigation.canGoBack()}
      />
    );
  };
