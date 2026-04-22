import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { rnrToast } from '@/components/RNRToast';
import { apiMnemonic, apisLock } from '@/core/apis';
import { keyringService } from '@/core/services';
import { KeyringAccountWithAlias, storeApiAccounts } from '@/hooks/account';
import { DELETE_FINISH_DURATION_MS } from '@/hooks/useDeletingOpacity';
import { promptEnterPassphrase } from '@/hooks/useEnterPassphraseModal';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { trigger } from 'react-native-haptic-feedback';
import { t } from 'i18next';

type DeleteTrace = {
  id: string;
  startedAt: number;
  accountLabel: string;
};

type DeleteToastSource = 'expected' | 'fallback';
const DELETE_SUCCESS_TOAST_FALLBACK_DELAY_MS = DELETE_FINISH_DURATION_MS + 96;

const createDeleteTrace = (account: KeyringAccountWithAlias): DeleteTrace => {
  return {
    id: `del_${Date.now().toString(36)}_${account.address
      .slice(-4)
      .toLowerCase()}`,
    startedAt: Date.now(),
    accountLabel: `${account.type}:${account.address.toLowerCase()}`,
  };
};

const logDeleteTrace = (
  trace: DeleteTrace,
  stage: string,
  extra?: Record<string, unknown>,
) => {
  console.log(
    '[delete-trace]',
    JSON.stringify({
      id: trace.id,
      account: trace.accountLabel,
      stage,
      dt: Date.now() - trace.startedAt,
      ...extra,
    }),
  );
};

export function showDeleteSuccessToast(
  message: string,
  trace?: DeleteTrace,
  source: DeleteToastSource = 'expected',
) {
  if (trace) {
    logDeleteTrace(trace, 'toast_show_requested');
  }

  rnrToast.success(buildDeleteToastMessage(message, source), {
    onShown: () => {
      if (trace) {
        logDeleteTrace(trace, 'toast_shown');
      }
    },
  });
}

function buildDeleteToastMessage(
  message: string,
  source: DeleteToastSource = 'expected',
) {
  const debugSuffix = __DEV__
    ? source === 'fallback'
      ? ' [fallback]'
      : ' [expected]'
    : '';

  return `${message}${debugSuffix}`;
}

function showDeleteLoadingToast(message: string, trace?: DeleteTrace) {
  if (trace) {
    logDeleteTrace(trace, 'deleting_toast_show_requested');
  }

  return rnrToast.loading(message, {
    onShown: () => {
      if (trace) {
        logDeleteTrace(trace, 'deleting_toast_shown');
      }
    },
  });
}

const waitForMs = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

async function handleShouldGoStartPage() {
  const hasAccountsInKeyring =
    (await keyringService.getCountOfAccountsInKeyring()) > 0;
  if (!hasAccountsInKeyring) {
    redirectToAddAddressEntry({
      action: 'resetTo',
    });
  }
}

export async function showDeleteAccountModal({
  account,
  onFinished,
  successMessage = t('global.Deleted'),
}: {
  account: KeyringAccountWithAlias;
  onFinished?: (ctx: { trace: DeleteTrace }) => void | Promise<void>;
  successMessage?: string;
}) {
  const trace = createDeleteTrace(account);

  trigger('impactLight', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });
  logDeleteTrace(trace, 'open_delete_modal');
  const count =
    account.type === KEYRING_TYPE.HdKeyring
      ? (() => {
          try {
            return apiMnemonic.getCachedKeyringAccountCountByAddress(
              account.address,
            );
          } catch {
            return 1;
          }
        })()
      : 1;
  const title =
    account.type === KEYRING_TYPE.SimpleKeyring
      ? t('page.manageAddress.delete-private-key-title')
      : account.type === KEYRING_TYPE.HdKeyring && count <= 1
      ? t('page.manageAddress.delete-seed-phrase-title')
      : t('page.manageAddress.delete-title');
  const needAuth =
    account.type === KEYRING_TYPE.SimpleKeyring ||
    (account.type === KEYRING_TYPE.HdKeyring && count <= 1);

  await AuthenticationModal.show({
    confirmText: t('page.manageAddress.confirm'),
    cancelText: t('page.manageAddress.cancel'),
    title,
    description: needAuth
      ? t('page.addressDetail.delete-desc-needpassword')
      : t('page.addressDetail.delete-desc'),
    checklist: needAuth
      ? [
          t('page.manageAddress.delete-checklist-1'),
          t('page.manageAddress.delete-checklist-2'),
        ]
      : undefined,
    ...(!needAuth
      ? { authType: ['none'] }
      : { authType: ['biometrics', 'password'] }),
    onFinished: async () => {
      logDeleteTrace(trace, 'delete_modal_confirmed');
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setTimeout(() => {
        logDeleteTrace(trace, 'delete_task_scheduled');
        const loadingToast = showDeleteLoadingToast(
          t('global.Deleting', {
            defaultValue: 'Deleting',
          }),
          trace,
        );
        const expectedSuccessMessage = buildDeleteToastMessage(
          successMessage,
          'expected',
        );
        const fallbackSuccessMessage = buildDeleteToastMessage(
          successMessage,
          'fallback',
        );
        storeApiAccounts.registerRemovingToastBridge(account, {
          successMessage: expectedSuccessMessage,
          toastId: loadingToast.id,
        });
        const runDeleteFlow = async () => {
          let successFallbackTimer: ReturnType<typeof setTimeout> | null = null;

          const clearSuccessFallbackTimer = () => {
            if (successFallbackTimer) {
              clearTimeout(successFallbackTimer);
              successFallbackTimer = null;
            }
          };

          const transitionDeleteToastToError = () => {
            storeApiAccounts.clearRemovingToastBridge(account);
            loadingToast.update('Delete account failed', {
              duration: 2400,
              kind: 'error',
              position: 'top',
            });
          };

          try {
            await storeApiAccounts.removeAccount(account, {
              trace,
            });
            logDeleteTrace(trace, 'remove_account_resolved');
          } catch (error) {
            clearSuccessFallbackTimer();
            logDeleteTrace(trace, 'delete_failed', {
              error:
                error instanceof Error ? error.message : String(error || ''),
            });
            console.error('delete account failed', error);
            transitionDeleteToastToError();
            return;
          }

          successFallbackTimer = setTimeout(() => {
            const toastBridge =
              storeApiAccounts.getRemovingToastBridge(account);

            if (!toastBridge || toastBridge.toastId !== loadingToast.id) {
              storeApiAccounts.clearRemovingToastBridge(account);
              return;
            }

            if (toastBridge.transitioned) {
              storeApiAccounts.clearRemovingToastBridge(account);
              return;
            }

            logDeleteTrace(trace, 'toast_success_fallback_requested');
            loadingToast.update(fallbackSuccessMessage, {
              duration: 2000,
              kind: 'success',
              position: 'top',
            });
            storeApiAccounts.markRemovingToastTransitioned(account);
            storeApiAccounts.clearRemovingToastBridge(account);
          }, DELETE_SUCCESS_TOAST_FALLBACK_DELAY_MS);

          await waitForMs(DELETE_FINISH_DURATION_MS);

          try {
            await onFinished?.({
              trace,
            });
          } catch (error) {
            logDeleteTrace(trace, 'delete_on_finished_failed', {
              error:
                error instanceof Error ? error.message : String(error || ''),
            });
            console.error('delete account onFinished failed', error);
          }

          try {
            await handleShouldGoStartPage();
          } catch (error) {
            logDeleteTrace(trace, 'delete_start_page_redirect_failed', {
              error:
                error instanceof Error ? error.message : String(error || ''),
            });
            console.error('delete account start page redirect failed', error);
          }
        };

        runDeleteFlow().catch(error => {
          storeApiAccounts.clearRemovingToastBridge(account);
          logDeleteTrace(trace, 'delete_task_failed_unexpected', {
            error: error instanceof Error ? error.message : String(error || ''),
          });
          console.error('delete account task failed unexpectedly', error);
          loadingToast.update('Delete account failed', {
            duration: 2400,
            kind: 'error',
            position: 'top',
          });
        });
      }, 0);
    },
    validationHandler: async (password: string) => {
      await apisLock.throwErrorIfInvalidPwd(password);

      if (account.type === KEYRING_TYPE.HdKeyring) {
        logDeleteTrace(trace, 'passphrase_validation_start');
        await promptEnterPassphrase('address', account.address);
        logDeleteTrace(trace, 'passphrase_validation_done');
      }
    },
  });
}

export const useDeleteAccountModal = () => showDeleteAccountModal;
