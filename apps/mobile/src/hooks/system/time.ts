import { getTimeSpanByMs } from '@/utils/time';
import { useMemo, useState } from 'react';
import { useTheme2024 } from '../theme';
import { useInterval } from 'ahooks';

export function useRestCountDownLabel(pastTimeMs: number) {
  const [spinner, setSpinner] = useState(0);
  useInterval(() => {
    setSpinner(prev => (prev + 1 === 1000 ? 0 : prev + 1));
  }, 500);

  const { text: countDownText, secs: countDownSecs } = useMemo(() => {
    spinner;
    const diffMs = Math.max(Date.now() - pastTimeMs, 0);

    const timeSpans = getTimeSpanByMs(diffMs);

    return {
      secs: timeSpans.s,
      text: [
        timeSpans.d ? `${timeSpans.d}d` : '',
        timeSpans.h ? `${timeSpans.h}h` : '',
        timeSpans.m ? `${timeSpans.m}m` : '',
        timeSpans.s ? `${timeSpans.s}s` : '',
      ]
        .filter(Boolean)
        .join(' '),
    };
  }, [pastTimeMs, spinner]);

  return {
    countDownText,
    countDownSecs,
  };
}
