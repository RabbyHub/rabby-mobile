import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Refresh from '@/assets2024/icons/bridge/IconRefreshCC.svg';
import { useTheme2024 } from '@/hooks/theme';
import { PerpsChartLoadingGif } from '@/screens/PerpsShared/components/PerpsChartLoadingGif';
import { createGetStyles2024 } from '@/utils/styles';

/** Shared Perps loading GIF while busy, retry icon after a failure. */
export function PerpsSimpleChartLoading({
  busy,
  hasData,
  onRetry,
}: {
  busy: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [visible, setVisible] = useState(!hasData || !busy);
  useEffect(() => {
    setVisible(!hasData || !busy);
    if (!hasData || !busy) return;
    // Keep fast cached switches free of a one-frame spinner flash.
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [hasData, busy]);
  if (!visible) return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        style={styles.button}
        onPress={onRetry}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ busy, disabled: busy }}
        accessibilityLabel={t(
          `page.perps.pro.common.${busy ? 'loading' : 'retry'}`,
        )}>
        {busy ? (
          <PerpsChartLoadingGif />
        ) : (
          <Refresh
            width={24}
            height={24}
            color={colors2024['neutral-secondary']}
          />
        )}
      </Pressable>
    </View>
  );
}
const getStyle = createGetStyles2024(() => ({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 44px touch target for retry; no background behind the transparent GIF.
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
