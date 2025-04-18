import { stats } from '@/utils/stats';
import { IS_IOS } from '../native/utils';
import { REPORT_TIMEOUT_ACTION_KEY } from '../services/type';

const reportFunc = async (
  type: Parameters<typeof stats.report>[0],
  params: Parameters<typeof stats.report>[1],
) => {
  stats.report('processDuration', {
    type: type,
    ...params,
  });
};

export const reportActionStats = async (
  preferenceService: any,
  currentKey: REPORT_TIMEOUT_ACTION_KEY,
  beforeKey: REPORT_TIMEOUT_ACTION_KEY,
  extra?: Record<string, string>,
) => {
  const timeGap = preferenceService.getReportActionTimeout(
    beforeKey,
    currentKey,
  );
  if (!timeGap || beforeKey === REPORT_TIMEOUT_ACTION_KEY.NONE) {
    return;
  }

  if (timeGap > 1000 * 60 * 60) {
    // 1 hour expired, not report stats
    return;
  }

  switch (currentKey) {
    case REPORT_TIMEOUT_ACTION_KEY.NONE:
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_CREATE_NEW_ADDRESS:
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS:
      break;

    // new user program
    case REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE:
      switch (beforeKey) {
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_CREATE_NEW_ADDRESS:
          reportFunc('CreateNewAddr_to_SetPassword', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE:
          reportFunc('ImportSeedPhrase_to_SetPassword', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;

        // have address program
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM:
          reportFunc('ConfirmSeedPhrase_to_SetPassword', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
          reportFunc('iCloudPasswordConfirm_to_SetPassword', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
          reportFunc('CofirmPrivateKey_to_SetPassword', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_ICLOUD_BACKUP:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE) {
        reportFunc('SetPassword_to_iCloudBackup', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_MANUAL_BACKUP:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE) {
        reportFunc('SetPassword_to_ManualBackup', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE:
      switch (beforeKey) {
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_ICLOUD_BACKUP:
          reportFunc('iCloudBackup_to_CreateNewAddrDone', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_MANUAL_BACKUP:
          reportFunc('ManualBackup_to_CreateNewAddrDone', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;

        // have address program
        case REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE:
          const includeKey = [
            REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM,
            REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM,
            REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM,
          ];
          const recentlyTimeArr = includeKey.map(key =>
            preferenceService.getReportActionTs(key),
          );
          const maxTime = Math.max(...recentlyTimeArr);
          const index = recentlyTimeArr.indexOf(maxTime);
          const recentlyKey = includeKey[index];
          switch (recentlyKey) {
            case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM:
              reportFunc('SetPassword_to_SeedPhraseDone', {
                value: timeGap,
                deviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
            case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
              reportFunc('SetPassword_to_iCloudSeedPhraseDone', {
                value: timeGap,
                deviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
            case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
              reportFunc('SetPassword_to_PrivateKeyDone', {
                value: timeGap,
                deviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
          }
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_LEDGER_CONNECT:
          reportFunc('ImportLedger_to_LedgerDone', {
            value: timeGap,
            deviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        reportFunc('ImportAddr_to_ImportSeedPhrase', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        reportFunc('ImportAddr_to_ImportPrivateKey', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        reportFunc('ImportAddr_to_ImportHardware', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE) {
        reportFunc('ImportSeedPhrase_to_ConfirmSeedPhrase', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE) {
        reportFunc('ImportSeedPhrase_to_iCloudPasswordConfirm', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY) {
        reportFunc('ImportPrivateKey_to_CofirmPrivateKey', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_LEDGER_CONNECT:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE) {
        reportFunc('ImportHardware_to_ImportLedger', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;

    // sync extension program
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION:
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_SHOW_PASSWORD:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION) {
        reportFunc('SyncExtension_to_ScanFinish', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_CONFIRM:
      if (
        beforeKey ===
        REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_SHOW_PASSWORD
      ) {
        reportFunc('ScanFinish_to_ConfirmExtensionPassword', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_DONE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_CONFIRM) {
        reportFunc('ConfirmExtensionPassword_to_SyncExtensionDone', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;

    // swap program
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE:
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE) {
        reportFunc('SwapEnter_to_SwapCreate', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN) {
        reportFunc('SwapCreate_to_SwapSign', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN) {
        reportFunc('SwapSign_to_SwapConfirm', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SWAP_ACTION_HAVE_DONE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM) {
        reportFunc('SwapConfirm_to_SwapFinish', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN) {
        // Handle case where swap progresses directly from 'sign' to 'finish' without intermediate steps
        reportFunc('SwapSign_to_SwapFinish', {
          value: timeGap,
          deviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
  }
};
