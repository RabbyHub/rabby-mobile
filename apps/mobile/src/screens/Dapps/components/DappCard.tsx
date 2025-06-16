import RcIconDisconnect from '@/assets/icons/dapp/icon-disconnect-circle.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import { TestnetChainLogo } from '@/components/Chain/TestnetChainLogo';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import {
  Image,
  Platform,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';
import { DappIcon } from './DappIcon';
import { noop } from 'lodash';
import { HighlightText } from '@/components2024/HighlightText';

export const DappCardListBy = ({
  data,
}: {
  data: (DappInfo['info'] & object)['collected_list'];
}) => {
  const { styles } = useTheme2024({ getStyle });
  return data?.length ? (
    <View style={styles.listBy}>
      {data.slice(0, 6).map(item => {
        return (
          <Image
            style={styles.listByIcon}
            source={{ uri: item.logo_url }}
            key={item.logo_url}
          />
        );
      })}
    </View>
  ) : null;
};

interface DappCardProps {
  data: DappInfo;
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
  onFavoritePress?: (dapp: DappInfo) => void;
  isActive?: boolean;
  isShowDesc?: boolean;
  keyword?: string;
}

export const DappCard: React.FC<DappCardProps> = ({
  data,
  onPress,
  ...rest
}) => {
  // const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(data);
      }}>
      <DappCardInner data={data} {...rest} />
    </TouchableOpacity>
  );
};

export const DappCardInner: React.FC<DappCardProps> = ({
  isActive,
  data,
  onFavoritePress,
  style,
  isShowDesc = false,
  keyword,
}) => {
  const { styles } = useTheme2024({ getStyle });

  const chain = findChain({ enum: data.chainId });

  return (
    <View style={[styles.dappCard, style]}>
      <View style={styles.body} onStartShouldSetResponder={() => true}>
        <View style={styles.dappIconWraper}>
          <DappIcon
            source={
              data?.info?.logo_url
                ? {
                    uri: data.info?.logo_url,
                  }
                : undefined
            }
            origin={data.origin}
            style={styles.dappIcon}
          />
          {isActive ? <View style={styles.dappIconCircle} /> : null}
          <>
            {data?.isConnected && chain ? (
              chain.isTestnet ? (
                <TestnetChainLogo
                  name={chain.name}
                  style={styles.chainIcon}
                  size={styles.chainIcon.width}
                />
              ) : (
                <Image
                  source={{
                    uri: chain?.logo,
                  }}
                  style={styles.chainIcon}
                />
              )
            ) : null}
            {/* {!data?.isConnected ? (
              <RcIconDisconnect style={styles.chainIcon} />
            ) : null} */}
          </>
        </View>
        <View style={styles.dappContent}>
          {keyword ? (
            <HighlightText
              style={styles.dappOrigin}
              highlightStyle={styles.dappOriginHighlight}
              numberOfLines={1}
              searchWords={[keyword]}
              textToHighlight={stringUtils.unPrefix(data.origin, 'https://')}
            />
          ) : (
            <Text style={styles.dappOrigin} numberOfLines={1}>
              {stringUtils.unPrefix(data.origin, 'https://')}
            </Text>
          )}
          <View style={styles.dappInfo}>
            {data.info?.name ? (
              <Text style={[styles.dappName]} numberOfLines={1}>
                {data.info?.name}
              </Text>
            ) : null}
            {data.info?.name && data.info?.collected_list?.length ? (
              <View style={styles.divider} />
            ) : null}
            <DappCardListBy data={data.info?.collected_list} />
          </View>
        </View>
        <TouchableOpacity
          style={styles.dappAction}
          // disallowInterruption={true}
          hitSlop={10}
          onLongPress={noop}
          onPress={() => {
            onFavoritePress?.(data);
          }}>
          {data.isFavorite ? <RcIconStarFull /> : <RcIconStar />}
        </TouchableOpacity>
      </View>
      {data.info?.description && !isActive && isShowDesc ? (
        <View style={styles.footer}>
          <View style={styles.dappDesc}>
            <Text style={styles.dappDescText} numberOfLines={1}>
              {data.info.description}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  dappCard: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 20,
    minHeight: 78,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',

    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.02)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 11.9,
      },
      android: {
        // elevation: 4,
      },
    }),
  },

  dappContent: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    overflow: 'hidden',
  },
  dappOrigin: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },

  dappOriginHighlight: {
    color: colors2024['brand-default'],
  },

  dappInfo: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    overflow: 'hidden',
  },

  dappName: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    flexShrink: 1,
  },

  divider: {
    width: 1,
    height: 12,
    backgroundColor: colors2024['neutral-line'],
  },

  dappAction: {
    padding: 8,
    marginRight: -8,
  },
  body: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  footer: {
    marginTop: 8,
  },
  dappDesc: {
    position: 'relative',
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 8,
    borderRadius: 12,
  },
  dappDescText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  dappIconWraper: {
    position: 'relative',
  },
  dappIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  dappIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: colors2024['green-default'],
    position: 'absolute',
    top: -4,
    left: -4,
  },
  chainIcon: {
    width: 16,
    height: 16,
    borderRadius: 16,
    position: 'absolute',
    right: 0,
    bottom: -2.5,
  },
  listBy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listByIcon: {
    width: 12,
    height: 12,
    borderRadius: 12,
    opacity: 0.7,
  },
}));
