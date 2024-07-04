import React from 'react';
import LogoWithText from './LogoWithText';
import { Text, TextStyle, View } from 'react-native';
import useCommonStyle from '@/components/Approval/hooks/useCommonStyle';

export interface Props {
  protocol: {
    name: string;
    logo_url: string;
  } | null;
  style?: TextStyle;
}

export const ProtocolListItem: React.FC<Props> = ({ protocol, style }) => {
  const commonStyle = useCommonStyle();

  if (!protocol) {
    return (
      <Text
        style={{
          ...commonStyle.subRowText,
          ...style,
        }}>
        -
      </Text>
    );
  }

  return (
    <View>
      <LogoWithText
        logo={protocol.logo_url}
        text={protocol.name}
        logoRadius={16}
        textStyle={{
          ...commonStyle.subRowText,
          ...style,
        }}
      />
    </View>
  );
};
