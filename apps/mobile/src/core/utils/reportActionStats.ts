import { stats } from '@/utils/stats';
import { IS_IOS } from '../native/utils';
import { REPORT_TIMEOUT_ACTION_KEY } from '../services/type';

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
          stats.report('CreateNewAddr_to_SetPassword', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE:
          stats.report('ImportSeedPhrase_to_SetPassword', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;

        // have address program
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM:
          stats.report('ConfirmSeedPhrase_to_SetPassword', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
          stats.report('iCloudPasswordConfirm_to_SetPassword', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
          stats.report('CofirmPrivateKey_to_SetPassword', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_ICLOUD_BACKUP:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE) {
        stats.report('SetPassword_to_iCloudBackup', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_MANUAL_BACKUP:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SET_PASSWORD_DONE) {
        stats.report('SetPassword_to_ManualBackup', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.ADD_NEW_ADDRESS_DONE:
      switch (beforeKey) {
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_ICLOUD_BACKUP:
          stats.report('iCloudBackup_to_CreateNewAddrDone', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_MANUAL_BACKUP:
          stats.report('ManualBackup_to_CreateNewAddrDone', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
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
              stats.report('SetPassword_to_SeedPhraseDone', {
                value: timeGap,
                DeviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
            case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
              stats.report('SetPassword_to_iCloudSeedPhraseDone', {
                value: timeGap,
                DeviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
            case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
              stats.report('SetPassword_to_PrivateKeyDone', {
                value: timeGap,
                DeviceType: IS_IOS ? 'iOS' : 'Android',
              });
              break;
          }
          break;
        case REPORT_TIMEOUT_ACTION_KEY.CLICK_LEDGER_CONNECT:
          stats.report('ImportLedger_to_LedgerDone', {
            value: timeGap,
            DeviceType: IS_IOS ? 'iOS' : 'Android',
          });
          break;
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        stats.report('ImportAddr_to_ImportSeedPhrase', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        stats.report('ImportAddr_to_ImportPrivateKey', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_HAVE_ADDRESS) {
        stats.report('ImportAddr_to_ImportHardware', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE) {
        stats.report('ImportSeedPhrase_to_ConfirmSeedPhrase', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_SEED_PHRASE) {
        stats.report('ImportSeedPhrase_to_iCloudPasswordConfirm', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.IMPORT_PRIVATE_KEY_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_IMPORT_PRIVATE_KEY) {
        stats.report('ImportPrivateKey_to_CofirmPrivateKey', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_LEDGER_CONNECT:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_CONNECT_HARDWARE) {
        stats.report('ImportHardware_to_ImportLedger', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;

    // sync extension program
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION:
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_SHOW_PASSWORD:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SCAN_SYNC_EXTENSION) {
        stats.report('SyncExtension_to_ScanFinish', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_CONFIRM:
      if (
        beforeKey ===
        REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_SHOW_PASSWORD
      ) {
        stats.report('ScanFinish_to_ConfirmExtensionPassword', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_DONE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.SCAN_SYNC_EXTENSION_CONFIRM) {
        stats.report('ConfirmExtensionPassword_to_SyncExtensionDone', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
        });
      }
      break;

    // swap program
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE:
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE) {
        stats.report('SwapEnter_to_SwapCreate', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN) {
        stats.report('SwapCreate_to_SwapSign', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_SIGN) {
        stats.report('SwapSign_to_SwapConfirm', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
    case REPORT_TIMEOUT_ACTION_KEY.SWAP_ACTION_HAVE_DONE:
      if (beforeKey === REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM) {
        stats.report('SwapConfirm_to_SwapFinish', {
          value: timeGap,
          DeviceType: IS_IOS ? 'iOS' : 'Android',
          ...extra,
        });
      }
      break;
  }
};
