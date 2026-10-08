import React, { useRef, useState } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcMore from '@/assets2024/icons/common/removed-token-more.svg';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { TokenMoreSheet, type TokenMoreAction } from './TokenMoreSheet';
import { toast } from '@/components2024/Toast';
import {
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function RemovedTokenNotice() {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>
        {t('page.setting.removedToken.description')}
      </Text>
    </View>
  );
}

export function RestoreRemovedTokenActions({
  token,
  moreMenuActions,
}: {
  token: { chain: string; id: string };
  moreMenuActions: TokenMoreAction[];
}) {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const removeRemovedToken = useRemovedTokens(
    state => state.removeRemovedToken,
  );
  const [restoring, setRestoring] = useState(false);
  const moreSheetModalRef = useRef<BottomSheetModal>(null);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await removeRemovedToken({ chainId: token.chain, tokenId: token.id });
    } catch (error) {
      console.error('Restore removed token failed:', error);
      toast.error(t('page.tokenDetail.removed.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <View style={styles.footer}>
        <Button
          type="primary"
          title={t('page.tokenDetail.removed.restore')}
          height={BOTTOM_BUTTON_SINGLE_HEIGHT}
          titleStyle={BOTTOM_BUTTON_TITLE_STYLE}
          containerStyle={styles.restoreContainer}
          buttonStyle={styles.restoreButton}
          loading={restoring}
          disabled={restoring}
          onPress={handleRestore}
        />
        <Pressable
          style={styles.more}
          accessibilityRole="button"
          accessibilityLabel={t('page.tokenDetail.removed.more')}
          onPress={() => moreSheetModalRef.current?.present()}>
          <RcMore />
        </Pressable>
      </View>
      <TokenMoreSheet modalRef={moreSheetModalRef} items={moreMenuActions} />
    </>
  );
}

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  notice: {
    backgroundColor: colors2024['orange-light-1'],
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  noticeText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['orange-default'],
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors2024['neutral-bg-1'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: BOTTOM_BUTTON_GAP,
    paddingHorizontal: 16,
    // This Figma footer variant uses 17px above the 52px buttons.
    paddingTop: 17,
    paddingBottom:
      getBottomButtonBottomOffset(safeAreaInsets.bottom) + BOTTOM_BUTTON_GAP,
  },
  restoreContainer: { flex: 1 },
  restoreButton: { borderRadius: 10 },
  more: {
    width: BOTTOM_BUTTON_SINGLE_HEIGHT,
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
