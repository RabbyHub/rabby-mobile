import { TabName, TabProps } from './types';
/**
 * Wrap your screens with `Tabs.Tab`. Basic usage looks like this:
 *
 * ```tsx
 * <Tabs.Container ...>
 *  <Tabs.Tab name="A" label="First Tab">
 *   <ScreenA />
 *  </Tabs.Tab>
 *  <Tabs.Tab name="B">
 *   <ScreenA />
 *  </Tabs.Tab>
 * </Tabs.Container>
 * ```
 */
export declare function Tab<T extends TabName>({ children }: TabProps<T>): JSX.Element;
