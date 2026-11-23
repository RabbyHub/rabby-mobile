import { createInstance } from 'i18next';
import en from '@/assets/locales/en/messages.json';
import zhCN from '@/assets/locales/zh-CN/messages.json';
import { formatPerpsProTwapDurationMinutes } from './formatTwapDurationMinutes';

it.each([
  [
    'en',
    en,
    [
      '0 mins',
      '1 min',
      '5 mins',
      '1 hour',
      '1 hour 1 min',
      '2 hours 2 mins',
      '23 hours 59 mins',
    ],
  ],
  [
    'zh-CN',
    zhCN,
    [
      '0 分钟',
      '1 分钟',
      '5 分钟',
      '1 小时',
      '1 小时 1 分钟',
      '2 小时 2 分钟',
      '23 小时 59 分钟',
    ],
  ],
] as const)(
  'formats %s TWAP duration units and omits zero parts',
  async (lng, messages, expected) => {
    const i18n = createInstance();
    await i18n.init({ lng, resources: { [lng]: { translation: messages } } });
    expect(
      [0, 1, 5, 60, 61, 122, 1439].map(minutes =>
        formatPerpsProTwapDurationMinutes(minutes, i18n.t),
      ),
    ).toEqual(expected);
  },
);
