import React, { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent, TextStyle } from 'react-native';

import { PerpsProTextWidthProbe } from '../common/PerpsProTextWidthProbe';
import {
  resolvePerpsProPositionTpSlTabRowFit,
  type PerpsProPositionTpSlTabRowFit,
} from './perpsProPositionTpSlTabRowFit';

type LabelKey = 'tab0' | 'tab1' | 'action0' | 'action1';

/**
 * Measures the TP/SL tab row labels off-flow at their design sizes and
 * resolves one shared size for the row (see `resolvePerpsProPositionTpSlTabRowFit`).
 * Only measures while the actions are shown; the tabs alone always fit.
 */
export const usePerpsProPositionTpSlTabRowFit = ({
  actionLabels,
  actionTextStyle,
  chromeWidth,
  enabled,
  tabLabels,
  tabTextStyle,
}: {
  actionLabels: readonly [string, string];
  actionTextStyle: TextStyle;
  chromeWidth: number;
  enabled: boolean;
  tabLabels: readonly [string, string];
  tabTextStyle: TextStyle;
}): {
  fit: PerpsProPositionTpSlTabRowFit;
  onRowLayout: (event: LayoutChangeEvent) => void;
  probes: React.ReactNode;
} => {
  const [rowWidth, setRowWidth] = useState(0);
  const [labelWidths, setLabelWidths] = useState<
    Partial<Record<LabelKey, number>>
  >({});
  const onRowLayout = useCallback(
    (event: LayoutChangeEvent) => setRowWidth(event.nativeEvent.layout.width),
    [],
  );
  const recorders = useMemo(() => {
    const record = (key: LabelKey) => (width: number) =>
      setLabelWidths(previous =>
        previous[key] === width ? previous : { ...previous, [key]: width },
      );
    return {
      tab0: record('tab0'),
      tab1: record('tab1'),
      action0: record('action0'),
      action1: record('action1'),
    };
  }, []);

  const { tab0, tab1, action0, action1 } = labelWidths;
  const fit = useMemo(
    () =>
      resolvePerpsProPositionTpSlTabRowFit({
        chromeWidth,
        rowWidth: enabled ? rowWidth : 0,
        widths:
          tab0 && tab1 && action0 && action1
            ? { tabText: tab0 + tab1, actionText: action0 + action1 }
            : null,
      }),
    [action0, action1, chromeWidth, enabled, rowWidth, tab0, tab1],
  );

  const probes = enabled ? (
    <>
      <PerpsProTextWidthProbe
        onWidth={recorders.tab0}
        style={tabTextStyle}
        text={tabLabels[0]}
      />
      <PerpsProTextWidthProbe
        onWidth={recorders.tab1}
        style={tabTextStyle}
        text={tabLabels[1]}
      />
      <PerpsProTextWidthProbe
        onWidth={recorders.action0}
        style={actionTextStyle}
        text={actionLabels[0]}
      />
      <PerpsProTextWidthProbe
        onWidth={recorders.action1}
        style={actionTextStyle}
        text={actionLabels[1]}
      />
    </>
  ) : null;

  return { fit, onRowLayout, probes };
};
