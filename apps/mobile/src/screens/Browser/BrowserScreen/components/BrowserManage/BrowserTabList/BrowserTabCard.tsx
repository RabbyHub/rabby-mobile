import { RcIconCloseCC } from '@/assets/icons/common';
import { Tab } from '@/core/services/browserService';
import { useTheme2024 } from '@/hooks/theme';
import { getViewShotUri } from '@/utils/browser';

import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import FastImage from 'react-native-fast-image';

interface Props {
  tab: Tab;
  onPressClose?(tab: Tab): void;
  onPress?(tab: Tab): void;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BrowserTabCard: React.FC<Props> = ({
  tab,
  onPress,
  onPressClose,
  isActive,
  style,
  containerStyle,
}) => {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const urlInfo = urlUtils.canoicalizeDappUrl(tab.url);

  return (
    <View
      style={[
        styles.wrap,
        isActive ? [styles.active, styles.shadow] : null,
        containerStyle,
      ]}>
      <TouchableOpacity
        style={[styles.card, isActive ? null : styles.shadow, style]}
        onPress={() => {
          onPress?.(tab);
        }}>
        <View style={styles.cardHeader}>
          {tab.url ? (
            <TouchableOpacity
              hitSlop={8}
              style={styles.closeIcon}
              onPress={() => onPressClose?.(tab)}>
              <RcIconCloseCC
                width={16}
                height={16}
                color={colors2024['neutral-secondary']}
              />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {urlInfo.fullDomain}
          </Text>
        </View>
        <View style={styles.screenshot}>
          {tab.viewShot ? (
            <FastImage
              source={{ uri: getViewShotUri(tab.viewShot) }}
              style={styles.viewShot}
            />
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    position: 'relative',
    backgroundColor: colors2024['neutral-bg-1'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    borderRadius: 14,
  },
  shadow: {
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 11.9,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: colors2024['neutral-bg-2'],
    position: 'relative',
    textAlign: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 30,
    paddingVertical: 6,
    height: 30,
    flex: 0,
  },
  cardTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  closeIcon: {
    position: 'absolute',
    top: 9,
    left: 12,
    zIndex: 10,
  },
  screenshot: {
    height: 168,
  },
  viewShot: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  wrap: {
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 17,
  },

  active: {
    borderColor: colors2024['brand-default'],
  },
}));
