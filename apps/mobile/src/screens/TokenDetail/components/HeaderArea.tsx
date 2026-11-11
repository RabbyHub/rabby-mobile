import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Dimensions,
  StyleProp,
  TextStyle,
  View,
  ViewStyle,
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
} from 'react-native';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IS_IOS } from '@/core/native/utils';

import { useTheme2024 } from '@/hooks/theme';
import { HeaderBackPressable } from '@/hooks/navigation';
import { createGetStyles2024 } from '@/utils/styles';

import { AssetAvatar } from '@/components';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { getTokenSymbol } from '@/utils/token';
import { useAssetsRefreshing } from '@/screens/Search/useAssets';
import LoadingCircle from '@/components2024/RotateLoadingCircle';
import RcIconCopyCC from '@/assets2024/singleHome/copy-cc.svg';
import { trigger } from 'react-native-haptic-feedback';
import { toastCopyAddressSuccess } from '@/components/AddressViewer/CopyAddress';
import { findChain } from '@/utils/chain';
import { ITokenItem } from '@/store/tokens';
import { useRemovedTokens } from '@/hooks/useRemovedTokens';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { RightMore } from './RightMore';
import { isLpToken } from '@/utils/lpToken';
import LpTokenIcon from '@/screens/Home/components/LpTokenIcon';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';
import Clipboard from '@react-native-clipboard/clipboard';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Button } from '@/components2024/Button';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import { BOTTOM_BUTTON_DOUBLE_HEIGHT } from '@/constant/layout';

const SCREEN_WIDTH = Dimensions.get('window').width;
// iOS reserves ~65pt for the native back item (44pt item + bar inset/spacing),
// so the title row is sized to the remaining width and its content flows from
// the left, right after the back button.
const HEADER_ROW_WIDTH: ViewStyle['width'] = IS_IOS
  ? SCREEN_WIDTH - 65
  : '100%';

// Fixed width for the header-right slot so hiding the menu never re-flows the row.
const RIGHT_SLOT_STYLE = {
  width: 24,
  height: 24,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

interface Props {
  token: ITokenItem;
  style?: StyleProp<ViewStyle>;
  tokenSize?: number;
  chainSize?: number;
  borderChain?: boolean;
  title?: string;
  titleStyle?: StyleProp<TextStyle>;
  rootStyle?: StyleProp<ViewStyle>;
  disableRefresh?: boolean;
  showCopyIcon?: boolean;
  inlineBack?: boolean;
  /** Render as a plain full-width row (used inside the custom header). */
  embedded?: boolean;
}
export const TokenDetailHeaderArea: React.FC<Props> = ({
  token,
  style,
  tokenSize = 35,
  chainSize = 16,
  borderChain = false,
  title,
  titleStyle,
  rootStyle,
  disableRefresh = false,
  showCopyIcon = false,
  inlineBack = false,
  embedded = false,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { refreshing } = useAssetsRefreshing();
  const { t } = useTranslation();
  const [copyConfirmVisible, setCopyConfirmVisible] = useState(false);
  const closeCopyConfirm = useCallback(() => setCopyConfirmVisible(false), []);

  // This presentation component is also rendered in the account-switcher
  // portal, outside the screen's navigation context.
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    const unsubscribe = navigation?.addListener('blur', closeCopyConfirm);
    return () => {
      unsubscribe?.();
      closeCopyConfirm();
    };
  }, [navigation, closeCopyConfirm]);

  const isNativeToken = useMemo(() => {
    const chain = findChain({ serverId: token?.chain });
    return token?.id === chain?.nativeTokenAddress;
  }, [token?.id, token?.chain]);

  const handleCopyAddress = useCallback(
    (evt?: GestureResponderEvent) => {
      evt?.stopPropagation?.();
      if (!token?.id || isNativeToken) {
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      Clipboard.setString(token.id);
      setCopyConfirmVisible(true);
      toastCopyAddressSuccess({
        title: t('page.tokenDetail.copyCA'),
      });
    },
    [isNativeToken, t, token.id],
  );

  const displayCopy = useMemo(
    () => showCopyIcon && !isNativeToken,
    [isNativeToken, showCopyIcon],
  );

  return (
    <View style={[styles.root, embedded && styles.rootEmbedded, rootStyle]}>
      <View style={[styles.container, style]}>
        <View style={styles.token}>
          {inlineBack ? (
            <HeaderBackPressable
              style={styles.inlineBack}
              tintColor={colors2024['neutral-title-1']}
            />
          ) : null}
          <AssetAvatar
            logo={token?.logo_url}
            // style={mediaStyle}
            size={tokenSize}
            chain={token?.chain}
            chainSize={chainSize}
            innerChainStyle={borderChain ? styles.chainLogo : undefined}
          />
          <View style={styles.middleContainer}>
            <View style={styles.titleContainer}>
              <Text
                style={[
                  displayCopy ? styles.showCopySymbol : styles.tokenSymbol,
                  titleStyle,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail">
                {title || getTokenSymbol(token)}
              </Text>
              {isLpToken(token) && (
                <View style={styles.lpTokenIconContainer}>
                  <LpTokenIcon protocolId={token.protocol_id || ''} />
                </View>
              )}
            </View>
            {displayCopy && (
              <CustomTouchableOpacity
                as="RNGHTouchableOpacity"
                style={styles.touchBox}
                onPress={handleCopyAddress}>
                <Text style={styles.contractAddress}>
                  {ellipsisAddress(token.id)}
                </Text>
                <RcIconCopyCC style={styles.copy} />
              </CustomTouchableOpacity>
            )}
          </View>
          {!disableRefresh && refreshing && <LoadingCircle />}
        </View>
      </View>
      {displayCopy && (
        <CopyConfirmModal
          modalId={MODAL_GATE_IDS.tokenContractCopyConfirm}
          visible={copyConfirmVisible}
          transparent
          animationType="fade"
          statusBarTranslucent
          onClose={closeCopyConfirm}>
          <View style={styles.copyConfirmOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeCopyConfirm}
              accessible={false}
            />
            <View style={styles.copyConfirmDialog} accessibilityViewIsModal>
              <Text style={styles.copyConfirmTitle}>
                {t('page.tokenDetail.copyCAWarning')}
              </Text>
              <Button
                title={t('global.confirm')}
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                titleStyle={styles.copyConfirmButtonTitle}
                onPress={closeCopyConfirm}
              />
            </View>
          </View>
        </CopyConfirmModal>
      )}
    </View>
  );
};

/**
 * Header title shared by the token detail and token market detail routes.
 *
 * The two routes are the same page as far as the user is concerned, so the
 * back chevron, avatar and symbol must be laid out at exactly the same place in
 * both. Pushing from one to the other then reads as a normal page transition
 * instead of the header jumping (QA 1343). Pass the token through `options` so
 * the row also exists on the first frame of the push.
 */
export const TokenDetailHeaderTitle = ({ token }: { token?: ITokenItem }) => (
  <TokenDetailHeaderArea
    inlineBack
    tokenSize={33}
    chainSize={15}
    borderChain
    token={token as ITokenItem}
    showCopyIcon
  />
);

/**
 * Header right slot shared by the token detail and token market detail routes.
 *
 * The slot keeps the same width even when the menu is hidden, so the title row
 * (and with it the back chevron and avatar) never shifts when the "..." action
 * appears. It is mounted from the navigator options, so the slot already exists
 * on the first frame of the push (QA 1343).
 */
export const TokenDetailHeaderRight = ({
  token,
  isCustomTestnetToken = false,
}: {
  token?: ITokenItem;
  isCustomTestnetToken?: boolean;
}) => {
  const { tokenRefresh, singleTokenRefresh } = useTriggerTagAssets();
  const isTestnet = useMemo(() => {
    if (!token?.chain) return false;
    return !!findChain({ serverId: token.chain })?.isTestnet;
  }, [token?.chain]);
  const isRemoved = useRemovedTokens(state =>
    token?.chain && token?.id
      ? !isCustomTestnetToken &&
        !isTestnet &&
        state.isTokenRemoved({ chainId: token.chain, tokenId: token.id })
      : false,
  );
  const refreshTags = useCallback(() => {
    singleTokenRefresh();
    tokenRefresh();
  }, [singleTokenRefresh, tokenRefresh]);
  const showMore = !!token && !isCustomTestnetToken && !isTestnet && !isRemoved;

  return (
    <View style={RIGHT_SLOT_STYLE}>
      {showMore ? (
        <RightMore token={token as ITokenItem} refreshTags={refreshTags} />
      ) : null}
    </View>
  );
};

function CopyConfirmModal({
  onClose,
  ...props
}: React.ComponentProps<typeof TrackedModal> & {
  onClose: () => void;
}) {
  useFocusEffect(useCallback(() => onClose, [onClose]));

  return <TrackedModal {...props} onRequestClose={onClose} />;
}

// Fixed insets for the custom header row; the content row begins at the page
// content's left edge, so the back glyph and the logo land at the same place on
// every device instead of inheriting the native title-slot origin (QA 1343).
const TOKEN_HEADER_HORIZONTAL_INSET = 14;
const TOKEN_HEADER_CONTENT_HEIGHT = 48;

/**
 * Fully custom header for the token detail and token market detail routes.
 *
 * The navigator owns it from the first descriptor. Leading/middle/trailing
 * areas are laid out by us with fixed widths, so changing the centre content
 * (loading, account switch, more-menu visibility) never moves the back button.
 */
export const TokenDetailHeader = ({
  token,
  isCustomTestnetToken = false,
}: {
  token?: ITokenItem;
  isCustomTestnetToken?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getHeaderStyles });
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerOuter, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerBackSlot}>
          <HeaderBackPressable tintColor={colors2024['neutral-title-1']} />
        </View>
        <View style={styles.headerContent}>
          <TokenDetailHeaderArea
            embedded
            token={token as ITokenItem}
            tokenSize={33}
            chainSize={15}
            borderChain
            showCopyIcon
          />
        </View>
        <View style={styles.headerRightSlot}>
          <TokenDetailHeaderRight
            token={token}
            isCustomTestnetToken={isCustomTestnetToken}
          />
        </View>
      </View>
    </View>
  );
};

const getHeaderStyles = createGetStyles2024(() => ({
  headerOuter: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    height: TOKEN_HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TOKEN_HEADER_HORIZONTAL_INSET,
  },
  headerBackSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
  },
  headerRightSlot: {
    width: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
}));

const getStyles = createGetStyles2024(({ isLight, colors2024 }) => ({
  copyConfirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  copyConfirmDialog: {
    width: 352,
    maxWidth: '100%',
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    backgroundColor: colors2024['neutral-bg-1'],
  },
  copyConfirmTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    color: colors2024['neutral-title-1'],
  },
  copyConfirmButtonTitle: {
    fontSize: 20,
  },
  // The header title row fills the native title container. iOS lays the title
  // view out in the space left over by the bar items, so an explicitly sized
  // row (screen minus the leading back-item slot) starts right after the back
  // button and lets the content flow from the left.
  root: {
    width: HEADER_ROW_WIDTH,
  },
  rootEmbedded: {
    width: '100%',
  },
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  token: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    // Production keeps the avatar ~4pt from the symbol; the back button cancels
    // the same gap with a negative margin so the glyph keeps its ~7pt gap.
    gap: 8,
  },
  inlineBack: {
    // QA 1343: the glyph's left ink has to line up with the page content's left
    // edge (~20pt), and the logo follows ~7pt after the glyph like production.
    marginLeft: 0,
    marginRight: -6,
    paddingLeft: 0,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lpTokenIconContainer: {
    marginLeft: 0,
    flexShrink: 0,
    justifyContent: 'flex-start',
  },
  tokenSymbol: {
    flexShrink: 1,
    minWidth: 0,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '900',
    flexWrap: 'nowrap',
  },
  chainLogo: {
    borderWidth: 1.5,
    overflow: 'hidden',
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  touchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  middleContainer: {
    flexShrink: 1,
    flex: 1,
    minWidth: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  copy: {
    width: 12,
    height: 12,
  },
  contractAddress: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  showCopySymbol: {
    flexShrink: 1,
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    flexWrap: 'nowrap',
  },
}));
