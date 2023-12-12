import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { makeThemeIconByCC } from '@/hooks/makeThemeIcon';
import { RcIconRightCC } from '@/assets/icons/common';
import { ThemeColors } from '@/constant/theme';
import { SvgProps } from 'react-native-svg';

const RcIconRight = makeThemeIconByCC(RcIconRightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

const styles = StyleSheet.create({
  entryItem: {
    borderRadius: 6,
    backgroundColor: '#FFF',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyringIcon: {
    width: 28,
    height: 28,
  },
  entryTitle: {
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  entrySubTitle: {
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  titleWrap: {
    flexDirection: 'column',
    flexShrink: 1,
    width: '100%',
    marginLeft: 12,
  },
  flexBox: {
    flexShrink: 1,
  },
});

interface Props {
  title: string;
  Icon: React.FC<SvgProps>;
  subTitle?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const WalletItem: React.FC<Props> = ({
  title,
  subTitle,
  Icon,
  onPress,
  style,
}) => {
  const colors = useThemeColors();

  return (
    <TouchableView
      style={[
        styles.entryItem,
        { backgroundColor: colors['neutral-bg-1'] },
        style,
      ]}
      onPress={onPress}>
      <View style={styles.flexBox}>
        <Icon style={[styles.keyringIcon]} />
      </View>
      <View style={styles.titleWrap}>
        <Text style={[styles.entryTitle, { color: colors['neutral-title-1'] }]}>
          {title}
        </Text>
        {subTitle ? (
          <Text
            style={[styles.entrySubTitle, { color: colors['neutral-body'] }]}>
            {subTitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.flexBox}>
        <RcIconRight width={20} height={20} />
      </View>
    </TouchableView>
  );
};
