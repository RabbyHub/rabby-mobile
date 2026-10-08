import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import RcMore from '@/assets/icons/home/more-cc.svg';
import RcFavorite from '@/assets2024/icons/browser/favorite-cc.svg';
import RcRemoveArrow from '@/assets2024/icons/common/token-header-remove-arrow.svg';
import { Tip } from '@/components/Tip';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import {
  toggleUserTokenPinned,
  useIsUserTokenPinned,
} from '@/hooks/useTokenSettings';
import type { ITokenItem } from '@/store/tokens';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { RemoveTokenConfirmPopup } from './RemoveTokenConfirmPopup';

/** Token header actions with a confirmation before removal. */
export const RightMore: React.FC<{
  token: ITokenItem;
  isMultiAddress?: boolean;
  triggerUpdate: () => void;
  refreshTags: () => void;
  unHold?: boolean;
}> = ({ token, refreshTags }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isPinned = useIsUserTokenPinned(token);
  const [visible, setVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleFavorite = () => {
    setVisible(false);
    toggleUserTokenPinned(token);
    setTimeout(refreshTags, 0);
  };

  return (
    <>
      <Tip
        hideArrow
        noPressable
        placement="bottom"
        isVisible={visible}
        modalGateId={MODAL_GATE_IDS.tokenDetailHeaderMenu}
        onClose={() => setVisible(false)}
        closeOnContentInteraction={false}
        displayInsets={{ top: 12, bottom: 12, left: 12, right: 12 }}
        contentStyle={styles.popup}
        tooltipStyle={styles.popupShadow}
        content={
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={handleFavorite}>
              <Text style={styles.favoriteText}>
                {t(
                  isPinned
                    ? 'page.tokenDetail.action.unfavorite'
                    : 'page.tokenDetail.action.favorite',
                )}
              </Text>
              <RcFavorite
                width={20}
                height={20}
                color={colors2024['orange-default']}
                fill={isPinned ? 'none' : 'currentColor'}
                stroke={isPinned ? colors2024['orange-default'] : 'none'}
                strokeWidth={1.5}
              />
            </Pressable>
            <Pressable
              style={styles.menuItem}
              accessibilityRole="button"
              onPress={() => {
                setVisible(false);
                setConfirmVisible(true);
              }}>
              {({ pressed }) => (
                <>
                  <Text
                    style={[styles.removeText, pressed && styles.pressedText]}>
                    {t('page.singleHome.tokenActions.remove')}
                  </Text>
                  <RcRemoveArrow
                    color={
                      colors2024[pressed ? 'brand-default' : 'neutral-foot']
                    }
                  />
                </>
              )}
            </Pressable>
          </View>
        }>
        <Pressable
          style={styles.trigger}
          accessibilityRole="button"
          accessibilityLabel={t('page.tokenDetail.removed.more')}
          hitSlop={10}
          onPress={() => setVisible(true)}>
          <RcMore color={colors2024['neutral-body']} />
        </Pressable>
      </Tip>
      {confirmVisible && (
        <RemoveTokenConfirmPopup
          token={token}
          onClose={() => setConfirmVisible(false)}
        />
      )}
    </>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  trigger: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popup: {
    width: 200,
    padding: 4,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  popupShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  menu: { width: 192 },
  menuItem: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  favoriteText: {
    color: isLight
      ? colors2024['neutral-black']
      : colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  removeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  pressedText: { color: colors2024['brand-default'] },
}));
