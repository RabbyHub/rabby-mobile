import { toast } from '@/components2024/Toast';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import Clipboard from '@react-native-clipboard/clipboard';
import i18next from 'i18next';
import { Dimensions } from 'react-native';
import { ToastOptions } from 'react-native-root-toast';

function clearClipboard() {
  Clipboard.setString('');
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
