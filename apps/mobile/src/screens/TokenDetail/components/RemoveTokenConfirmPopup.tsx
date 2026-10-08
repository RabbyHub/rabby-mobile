import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

import { AssetAvatar } from '@/components/AssetAvatar';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { toast } from '@/components2024/Toast';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_GAP,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import type { ITokenItem } from '@/store/tokens';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';

// This Figma confirmation variant uses 56px buttons and 19px extra bottom space.
const CONFIRM_BUTTON_HEIGHT = 56;

/** Confirms removal before updating the shared removed-token list. */
export function RemoveTokenConfirmPopup({
  token,
  onClose,
}: {
  token: ITokenItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const modalRef = useRef<AppBottomSheetModal>(null);
  const addRemovedToken = useRemovedTokens(state => state.addRemovedToken);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    modalRef.current?.present();
  }, []);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await addRemovedToken({ chainId: token.chain, tokenId: token.id });
      modalRef.current?.dismiss();
    } catch (error) {
      console.error('Remove token failed:', error);
      toast.error(t('page.singleHome.tokenActions.removeFailed'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <AppBottomSheetModal
      ref={modalRef}
      onDismiss={onClose}
      {...makeBottomSheetProps({ colors: colors2024 })}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundComponent={props => (
        <LinearGradient
          style={props.style}
          colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
          locations={[0.07453, 0.22418]}
        />
      )}
      enablePanDownToClose={!removing}
      enableDynamicSizing>
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>
          {t('page.tokenDetail.removed.confirmTitle')}
        </Text>
        <Text style={styles.description}>
          {t('page.tokenDetail.removed.confirmDescription')}
        </Text>
        <View style={styles.tokenCard}>
          <AssetAvatar
            logo={token.logo_url}
            chain={token.chain.toLowerCase()}
            size={40}
            chainSize={16}
            innerChainStyle={styles.chainIcon}
          />
          <Text style={styles.symbol} numberOfLines={1}>
            {getTokenSymbol(token)}
          </Text>
        </View>
        <View style={styles.buttons}>
          <Button
            type="ghost"
            title={t('global.Cancel')}
            height={CONFIRM_BUTTON_HEIGHT}
            titleStyle={styles.buttonTitle}
            containerStyle={styles.buttonContainer}
            buttonStyle={styles.cancelButton}
            disabled={removing}
            onPress={() => modalRef.current?.dismiss()}
          />
          <Button
            type="danger"
            title={t('page.singleHome.tokenActions.remove')}
            height={CONFIRM_BUTTON_HEIGHT}
            titleStyle={styles.buttonTitle}
            containerStyle={styles.buttonContainer}
            buttonStyle={styles.removeButton}
            loading={removing}
            disabled={removing}
            onPress={handleRemove}
          />
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const getStyle = createGetStyles2024(({ colors2024, safeAreaInsets }) => ({
  handle: { height: 36, paddingTop: 18, backgroundColor: 'transparent' },
  handleIndicator: {
    width: 50,
    height: 6,
    backgroundColor: colors2024['neutral-sheet-handle'],
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom) + 19,
  },
  title: {
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 24,
  },
  description: {
    marginTop: 17,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
  tokenCard: {
    marginTop: 24,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  chainIcon: { right: -1, bottom: -1 },
  symbol: {
    flex: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
  },
  buttons: {
    marginTop: 48,
    marginRight: 8,
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
  },
  buttonContainer: { flex: 1 },
  buttonTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 20,
  },
  cancelButton: { borderRadius: 12, backgroundColor: 'transparent' },
  removeButton: {
    borderRadius: 12,
    // Figma's r-red/default differs from the 2024 danger-button color.
    backgroundColor: '#E34935',
  },
}));
