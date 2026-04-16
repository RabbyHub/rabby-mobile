import { toast } from '@/components2024/Toast';
import { isNonPublicProductionEnv } from '@/constant';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import Clipboard from '@react-native-clipboard/clipboard';
import i18next from 'i18next';
import { Dimensions } from 'react-native';
import { ToastOptions } from 'react-native-root-toast';

const setTimerForClearClipboardRef = {
  timeRef: 0,
};

function setNextTask(timeMs: number) {
  setTimerForClearClipboardRef.timeRef = timeMs;
}

function clearClipboard() {
  Clipboard.setString('');
}

export function startCheckClearAction() {
  if (
    storeApiExpSettingData.getTimeTipAboutSeedPhraseAndPrivateKey() !== 'copy'
  )
    return;
  setInterval(() => {
    if (
      storeApiExpSettingData.getTimeTipAboutSeedPhraseAndPrivateKey() !== 'copy'
    )
      return;
    if (setTimerForClearClipboardRef.timeRef > 0) {
      clearClipboard();
      setTimerForClearClipboardRef.timeRef = 0;
    }
  }, 30 * 1e3);
}

export function onCopiedSensitiveData({
  type,
  toastOptions,
}: {
  type: 'seedPhrase' | 'privateKey';
  toastOptions?: Partial<ToastOptions>;
}) {
  const winLayout = Dimensions.get('window');
  switch (type) {
    case 'seedPhrase': {
      if (
        storeApiExpSettingData.getTimeTipAboutSeedPhraseAndPrivateKey() !==
        'copy'
      )
        return;
      toast.success(i18next.t('global.toast.clipboard.copiedSeedPhrase'), {
        position: winLayout.height * 0.5,
      });
      setNextTask(Date.now() + 1 * 60 * 1e3); // 1 minutes
      break;
    }
    case 'privateKey': {
      if (
        storeApiExpSettingData.getTimeTipAboutSeedPhraseAndPrivateKey() !==
        'copy'
      )
        return;

      toast.success(i18next.t('global.toast.clipboard.copiedPrivateKey'), {
        position: winLayout.height * 0.5,
        ...toastOptions,
      });
      setNextTask(Date.now() + 1 * 60 * 1e3); // 1 minutes
      break;
    }
  }
}

export function onPastedSensitiveData({
  type,
  toastOptions,
}: {
  type: 'seedPhrase' | 'privateKey';
  toastOptions?: Partial<ToastOptions>;
}) {
  if (
    storeApiExpSettingData.getTimeTipAboutSeedPhraseAndPrivateKey() !== 'pasted'
  )
    return;

  const winLayout = Dimensions.get('window');
  switch (type) {
    case 'seedPhrase':
    case 'privateKey': {
      clearClipboard();
      toast.success(i18next.t('global.toast.clipboard.pasted_and_cleared'), {
        position: winLayout.height * 0.5,
        ...toastOptions,
      });
      break;
    }
  }
}

export async function isNewlyInputTextSameWithContentFromClipboard(
  text: string,
) {
  return Clipboard.getString().then(clipboardContent => {
    return clipboardContent === text;
  });
}
