import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import { isNil } from 'lodash';

dayjs.extend(utc);

export const formatSeconds = (secs: number) => {
  if (secs < 60) return `${secs} sec`;
  const min = Math.floor(secs / 60);
  const s = secs - min * 60;

  return `${min} min${s > 0 ? ` ${s} sec` : ''}`;
};

export const timeago = (a: number, b: number) => {
  const bigger = Math.max(a, b);
  const less = Math.min(a, b);
  let secs = (bigger - less) / 1000;
  const hour = Math.floor(secs / 3600);
  secs = secs - hour * 3600;
  const minute = Math.floor(secs / 60);
  secs = secs - minute * 60;
  const second = secs;

  return {
    hour,
    minute,
    second,
  };
};

export function getTimeSpan(times: number) {
  if (isNaN(+times)) {
    times = 0;
  }
  const int = Math.floor(times);
  const d = parseInt(int / 60 / 60 / 24 + '');
  const h = parseInt(((int / 60 / 60) % 24) + '');
  const m = parseInt(((int / 60) % 60) + '');
  const s = parseInt((int % 60) + '');
  return {
    d,
    h,
    m,
    s,
  };
}

export function getTimeSpanByMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);

  return {
    d,
    h: h % 24,
    m: m % 60,
    s: s % 60,
  };
}

export const formatTimeReadable = (timeElapse: number) => {
  let timeStr = '';
  const { d, h, m, s } = getTimeSpan(timeElapse);

  if (d) timeStr = `${d} day` + (d > 1 ? 's' : '');
  if (h && !timeStr) timeStr = `${h} hr` + (h > 1 ? 's' : '');
  if (m && !timeStr) timeStr = `${m} min` + (m > 1 ? 's' : '');
  if (!timeStr) timeStr = `${s} sec` + (s > 1 ? 's' : '');
  return timeStr;
};

export const getTimeFromNow = (create_at: number) =>
  formatTimeReadable(Date.now() / 1000 - create_at);

export function fromNow(time: number, currTime?: number) {
  let successTimeView = '';
  const successTime = getTimeSpan((currTime || Date.now() / 1000) - time);
  if (successTime.h <= 0 && successTime.m <= 0) successTime.m = 1; // At least 1 mins
  const { d, h, m } = successTime;
  let str = '';
  let flag = 0;
  if (d) {
    str += `${d}${`day${d > 1 ? 's' : ''}`} `;
    flag++;
  }
  if ((h || flag) && flag < 3) {
    str += `${flag > 0 ? ' ' : ''}${h} hour`;
    flag++;
  }
  if ((m || flag) && flag < 3) {
    str += `${flag > 0 ? ' ' : ''}${m} min`;
    flag++;
  }
  if (str) successTimeView = str;
  return successTimeView;
}

export function fromNowWithSecs(time: number, currTime?: number) {
  let successTimeView = '';
  const successTime = getTimeSpan((currTime || Date.now() / 1000) - time);
  const { d, h, m, s } = successTime;
  let str = '';
  let flag = 0;
  if (d) {
    str += `${d}${`day${d > 1 ? 's' : ''}`} `;
    flag++;
  }
  if ((h || flag) && flag < 3) {
    str += `${flag > 0 ? ' ' : ''}${h} hour`;
    flag++;
  }
  if ((m || flag) && flag < 3) {
    str += `${flag > 0 ? ' ' : ''}${m} min`;
    flag++;
  }
  if (!d && !h && !m) {
    str += `${s} sec`;
  }
  if (str) successTimeView = str;
  return successTimeView;
}

export const sinceTime = (time: number) => {
  return Date.now() / 1000 - time < 3600 * 24
    ? `${fromNow(time)} ago`
    : dayjs(time * 1000).format('YYYY/MM/DD HH:mm');
};

export const sinceTimeWithSecs = (time: number) => {
  return Date.now() / 1000 - time < 3600 * 24
    ? `${fromNowWithSecs(time)} ago`
    : dayjs(time * 1000).format('YYYY/MM/DD HH:mm');
};

export const calcGasEstimated = (seconds?: number) => {
  if (isNil(seconds)) {
    return undefined;
  }
  // < 1 minute: ~ time sec
  // > 1 minute: ~ time min
  // >= 30 minutes: > 30 min
  if (seconds < 60) {
    return `~${Math.round(seconds)} sec`;
  }
  const minutes = seconds / 60;
  if (minutes < 30) {
    return `~${Math.round(minutes)} min`;
  }
  return '>30 min';
};
