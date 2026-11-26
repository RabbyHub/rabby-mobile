import i18next from 'i18next';
import en from '../assets/locales/en/messages.json';
import zh from '../assets/locales/zh-CN/messages.json';
import ko from '../assets/locales/ko-KR/messages.json';
import { formatDurationMinutes } from './formatDurationMinutes';

it.each([
  ['en', en, ['59 min', '1 h', '1 h 1 min', '23 h 59 min']],
  ['zh-CN', zh, ['59 分钟', '1 小时', '1 小时 1 分钟', '23 小时 59 分钟']],
  ['ko-KR', ko, ['59 분', '1시간', '1시간 1분', '23시간 59분']],
] as const)(
  'uses the %s catalog for whole and mixed durations',
  async (lng, translation, expected) => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng, resources: { [lng]: { translation } } });
    expect(
      [59, 60, 61, 1439].map(n => formatDurationMinutes(n, i18n.t)),
    ).toEqual(expected);
  },
);
