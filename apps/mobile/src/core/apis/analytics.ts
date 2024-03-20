import { matomoRequestEvent } from '@/utils/analytics';
import { KEYRING_CATEGORY_MAP } from '@rabby-wallet/keyring-utils';
import dayjs from 'dayjs';
import groupBy from 'lodash/groupBy';
import { keyringService, preferenceService } from '../services/shared';

export const sendUserAddressEvent = async () => {
  const time = preferenceService.getSendLogTime();
  if (dayjs(time).utc().isSame(dayjs().utc(), 'day')) {
    return;
  }

  const accounts = await keyringService.getAllVisibleAccountsArray();
  const list = accounts.map(account => {
    const category = KEYRING_CATEGORY_MAP[account.type];
    const action = account.brandName;
    const isEmpty =
      (preferenceService.getAddressBalance(account.address)?.total_usd_value ||
        0) <= 0;
    return {
      category,
      action,
      label: isEmpty ? 'empty' : 'notEmpty',
    };
  });
  const groups = groupBy(list, item => {
    return `${item.category}_${item.action}_${item.label}`;
  });
  Object.values(groups).forEach(group => {
    matomoRequestEvent({
      category: 'UserAddress',
      action: group[0].category,
      label: [group[0].action, group[0].label, group.length].join('|'),
      value: group.length,
    });
  });
  preferenceService.updateSendLogTime(Date.now());
};
