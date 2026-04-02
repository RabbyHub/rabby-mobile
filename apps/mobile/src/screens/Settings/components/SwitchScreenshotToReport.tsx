import React from 'react';

import { AppSwitch2024 } from '@/components/customized/Switch2024';
import { SwitchToggleType } from '@/components';
import { useScreenshotToReportEnabled } from '@/components/Screenshot/hooks';
import useInterval from 'react-use/lib/useInterval';
import { NEED_DEVSETTINGBLOCKS } from '@/constant';
import { useTheme2024 } from '@/hooks/theme';
import { getTimeSpanByMs } from '@/utils/time';
import { Text } from '@/components/Typography';

export const SwitchScreenshotToReport = React.forwardRef<
  SwitchToggleType,
  React.ComponentProps<typeof AppSwitch2024> & {
    onToggleSuccess?: (enabled: boolean) => void | Promise<void>;
  }
>(({ onToggleSuccess, ...props }, ref) => {
  const { isShowFeedbackOnScreenshot, toggleScreenshotToReport } =
    useScreenshotToReportEnabled();

  React.useImperativeHandle(ref, () => ({
    toggle: (enabled?: boolean) => {
      const nextEnabled = toggleScreenshotToReport(enabled);
      onToggleSuccess?.(nextEnabled);
    },
  }));

  return (
    <AppSwitch2024
      {...props}
      circleSize={20}
      value={!!isShowFeedbackOnScreenshot}
      changeValueImmediately={false}
      onValueChange={enabled => {
        const nextEnabled = toggleScreenshotToReport(enabled);
        onToggleSuccess?.(nextEnabled);
      }}
    />
  );
});

export function LabelScreenshotToReport() {
  const { disableScreenshotToReportUntil } = useScreenshotToReportEnabled();
  const { colors } = useTheme2024();

  const [spinner, setSpinner] = React.useState(false);
  useInterval(() => {
    if (NEED_DEVSETTINGBLOCKS) {
      // trigger countDown re-calculated
      setSpinner(prev => !prev);
    }
  }, 500);

  const { text: timeOffset, mins } = React.useMemo(() => {
    spinner;
    const diffMs = Math.max(disableScreenshotToReportUntil - Date.now(), 0);
    if (!diffMs || disableScreenshotToReportUntil === Infinity) {
      return { text: '∞', mins: 0 };
    }

    const timeSpans = getTimeSpanByMs(diffMs);

    return {
      mins: timeSpans.m,
      text: [
        timeSpans.d ? `${timeSpans.d}d` : '',
        timeSpans.h ? `${timeSpans.h}h` : '',
        timeSpans.m ? `${timeSpans.m}m` : '',
        timeSpans.s ? `${timeSpans.s}s` : '',
      ].join(' '),
    };
  }, [disableScreenshotToReportUntil, spinner]);

  return (
    <Text
      style={{
        color:
          mins < 5
            ? colors['green-default']
            : mins < 8
            ? colors['orange-default']
            : colors['red-default'],
      }}>
      {timeOffset}
    </Text>
  );
}
