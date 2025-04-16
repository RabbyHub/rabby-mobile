import { RcIconCloseCC } from '@/assets/icons/common';
import { Tab } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';

import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import {
  Image,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

interface Props {
  tab: Tab;
  onPressClose?(tab: Tab): void;
  onPress?(tab: Tab): void;
  isActive?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const BrowserTabCard: React.FC<Props> = ({
  tab,
  onPress,
  onPressClose,
  isActive,
  style,
}) => {
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const urlInfo = urlUtils.canoicalizeDappUrl(tab.url);

  return (
    <View
      style={[styles.wrap, isActive ? [styles.active, styles.shadow] : null]}>
      <TouchableOpacity
        style={[styles.card, isActive ? null : styles.shadow, style]}
        onPress={() => {
          onPress?.(tab);
        }}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1} ellipsizeMode="tail">
            {urlInfo.fullDomain}
          </Text>
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
        </View>
        <View style={styles.screenshot}>
          {tab.viewShot ? (
            <Image source={{ uri: tab.viewShot }} style={styles.viewShot} />
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
    borderRadius: 20,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 30,
    paddingVertical: 6,
  },
  cardTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  closeIcon: {
    position: 'absolute',
    top: 7,
    right: 12,
    zIndex: 10,
  },
  screenshot: {
    height: 210,
  },
  viewShot: {
    width: '100%',
    height: '100%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  wrap: {
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 24,
  },

  active: {
    borderColor: colors2024['brand-default'],
  },
}));
