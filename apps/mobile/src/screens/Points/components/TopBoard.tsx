import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewProps,
} from 'react-native';
import Icon1st from '@/assets/icons/points/1st.svg';
import Icon2nd from '@/assets/icons/points/2nd.svg';
import Icon3rd from '@/assets/icons/points/3rd.svg';
import { ClaimUserAvatar } from './ClaimUserAvatar';
import { openExternalUrl } from '@/core/utils/linking';
import { ellipsisAddress } from '@/utils/address';
import { formatNumber } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors, useThemeStyles } from '@/hooks/theme';

interface User {
  id: string;
  logo_url: string;
  web3_id: string;
  claimed_points: number;
  index: number;
  style?: ViewProps['style'];
  showCurrentUser?: boolean;
}

const getStyles = createGetStyles(colors => ({
  container: {
    height: 56,
    paddingLeft: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentUserContainer: {
    backgroundColor: colors['neutral-bg1'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-line'],
  },
  avatar: {
    width: 28,
    height: 28,
  },
  fixedPadding: {
    height: 56,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userIdText: {
    marginLeft: 12,
    marginRight: 4,
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },

  leftContainer: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  claimedPointsText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title1'],
    textAlign: 'right',
  },
  rankTextContainer: {
    width: 78,
    alignItems: 'center',
    textAlign: 'center',
  },
  rankIcon: {
    height: '100%',
    width: 'auto',
  },
  rankText: {
    marginLeft: 23,
    fontSize: 15,
    fontWeight: '400',
    color: colors['neutral-foot'],
  },
}));

export const TopUserItem = (props: User) => {
  const gotoDebank = React.useCallback(() => {
    openExternalUrl(`https://debank.com/profile/${props.id}`);
  }, [props.id]);
  const { styles } = useThemeStyles(getStyles);

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        props.showCurrentUser && styles.currentUserContainer,
        props.style,
      ])}>
      <View style={styles.userInfoContainer}>
        <ClaimUserAvatar src={props.logo_url} style={styles.avatar} />
        <TouchableOpacity onPress={gotoDebank}>
          <Text style={styles.userIdText}>
            {props.web3_id || ellipsisAddress(props.id)}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.leftContainer}>
        <Text style={styles.claimedPointsText}>
          {formatNumber(props.claimed_points, 0)}
        </Text>
        <View style={styles.rankTextContainer}>
          {props.index === 0 && (
            <Icon1st
              style={StyleSheet.flatten([
                styles.rankIcon,
                props.showCurrentUser && styles.fixedPadding,
              ])}
            />
          )}
          {props.index === 1 && (
            <Icon2nd
              style={StyleSheet.flatten([
                styles.rankIcon,
                props.showCurrentUser && styles.fixedPadding,
              ])}
            />
          )}
          {props.index === 2 && (
            <Icon3rd
              style={StyleSheet.flatten([
                styles.rankIcon,
                props.showCurrentUser && styles.fixedPadding,
              ])}
            />
          )}
          {props.index > 2 && (
            <View>
              <Text style={styles.rankText}>
                {props.index > 99 ? '100+' : props.index + 1}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};
