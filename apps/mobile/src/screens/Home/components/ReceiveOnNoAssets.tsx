import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { trigger } from 'react-native-haptic-feedback';
import { useTranslation } from 'react-i18next';

import type { Account } from '@/types/account';
import type { CHAINS_ENUM } from '@/constant/chains';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { ReceiveAddressCard } from '@/components2024/ReceiveAddressCard';
import { toast } from '@/components2024/Toast';

export function ReceiveOnNoAssets({ account }: { account?: Account | null }) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [selectedChain, setSelectedChain] = useState<CHAINS_ENUM | null>(null);

  const handleCopy = useCallback(() => {
    if (!account?.address) {
      return;
    }

    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    toast.success(t('global.copiedSuccessfully'));
    Clipboard.setString(account.address);
  }, [account?.address, t]);

  if (!account?.address) {
    return null;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}>
      <ReceiveAddressCard
        account={account}
        selectedChain={selectedChain}
        onSelectChainChange={setSelectedChain}
        onCopy={handleCopy}
      />
    </ScrollView>
  );
}

const getStyle = createGetStyles2024(({ safeAreaInsets }) => ({
  container: {
    flex: 1,
    width: '100%',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom:
      BOTTOM_BUTTON_TOP_OFFSET +
      BOTTOM_BUTTON_DOUBLE_HEIGHT +
      getBottomButtonBottomOffset(safeAreaInsets.bottom),
  },
  copyButton: {
    marginTop: BOTTOM_BUTTON_TOP_OFFSET,
  },
}));
