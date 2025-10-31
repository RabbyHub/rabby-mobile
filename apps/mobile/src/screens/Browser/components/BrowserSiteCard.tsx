import RcIconStarFull from '@/assets/icons/dapp/icon-star-mini-full.svg';
import { HighlightText } from '@/components2024/HighlightText';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import React from 'react';
import {
  Image,
  Platform,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
// import { TouchableOpacity } from 'react-native-gesture-handler';

export const BrowserSiteListBy = ({
  data,
}: {
  data: NonNullable<DappInfo['info']>['collected_list'];
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
  containerStyle?: StyleProp<ViewStyle>;
  isShowListBy?: boolean;
  isShowFavorite?: boolean;
  isShowBorder?: boolean;
  keyword?: string;
}

export const BrowserSiteCard: React.FC<DappCardProps> = ({
  data,
  onPress,
  containerStyle,
  ...rest
}) => {
  // const { styles } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.(data);
      }}
      style={containerStyle}>
      <BrowserSiteCardInner data={data} {...rest} />
    </TouchableOpacity>
  );
};

export const BrowserSiteCardInner: React.FC<DappCardProps> = ({
  isActive,
  data,
  onFavoritePress,
  keyword,
  style,
  isShowDesc = false,
  isShowListBy = false,
  isShowFavorite = false,
  isShowBorder = false,
}) => {
  const { styles } = useTheme2024({ getStyle });

  // const chain = findChain({ enum: data.chainId });

  return (
    <View
      style={[
        styles.dappCard,
        isShowBorder ? styles.dappCardBorder : null,
        style,
      ]}>
      <View style={styles.body}>
        <View style={styles.dappIconWraper}>
          <DappIcon
            source={
              data?.icon
                ? {
                    uri: data.icon,
                  }
                : undefined
            }
            origin={data.origin}
            style={styles.dappIcon}
          />
          {isActive ? <View style={styles.dappIconCircle} /> : null}
          <>
            {/* {data?.isConnected && chain ? (
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
            ) : null} */}
            {/* {!data?.isConnected ? (
              <RcIconDisconnect style={styles.chainIcon} />
            ) : null} */}
          </>
        </View>
        <View style={styles.dappContent}>
          {data.name ? (
            <>
              {keyword ? (
                <HighlightText
                  style={styles.dappTitle}
                  highlightStyle={styles.dappOriginHighlight}
                  numberOfLines={1}
                  searchWords={[keyword]}
                  textToHighlight={data.name}
                />
              ) : (
                <Text style={[styles.dappTitle]} numberOfLines={1}>
                  {data.name}
                </Text>
              )}
            </>
          ) : null}
          <View style={styles.dappInfo}>
            <Text style={styles.dappOrigin} numberOfLines={1}>
              {stringUtils.unPrefix(data.origin, 'https://')}
            </Text>
            {isShowListBy &&
            data.origin &&
            data.info?.collected_list?.length ? (
              <View style={styles.divider} />
            ) : null}
            {isShowListBy && data.info?.collected_list?.length ? (
              <BrowserSiteListBy data={data.info?.collected_list} />
            ) : null}
          </View>
        </View>

        {/* <TouchableOpacity
          style={styles.dappAction}
          // disallowInterruption={true}
          hitSlop={10}
          onLongPress={noop}
          onPress={() => {
            onFavoritePress?.(data);
          }}>
          {data.isFavorite ? <RcIconStarFull /> : <RcIconStar />}
        </TouchableOpacity> */}
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
      {isShowFavorite && data.isFavorite ? (
        <View style={styles.badge}>
          <RcIconStarFull width={12} height={12} />
        </View>
      ) : null}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  dappCard: {
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    // borderWidth: 1,
    // borderColor: colors2024['neutral-line'],
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 24,
    minHeight: 70,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',

    position: 'relative',

    // ...Platform.select({
    //   ios: {
    //     shadowColor: 'rgba(0, 0, 0, 0.02)',
    //     shadowOffset: { width: 0, height: 10 },
    //     shadowOpacity: 1,
    //     shadowRadius: 11.9,
    //   },
    //   android: {
    //     // elevation: 4,
    //   },
    // }),
  },

  dappCardBorder: {
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
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
  dappTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  dappOrigin: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
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
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors2024['orange-light-1'],
    paddingVertical: 3,
    paddingHorizontal: 12,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 12,
  },
}));
