import React from 'react';
import LogoWithText from './LogoWithText';
import { TextStyle, View } from 'react-native';

export interface Props {
  protocol: {
    name: string;
    logo_url: string;
  } | null;
  style?: TextStyle;
}

// const LogoWithTextStyled = styled(LogoWithText)`
//   .text {
//     font-size: inherit;
//     font-weight: inherit;
//     color: inherit;
//     line-height: inherit;
//   }
// `;

export const ProtocolListItem: React.FC<Props> = ({ protocol, style }) => {
  if (!protocol) {
    return null;
  }

  return (
    <View>
      <LogoWithText
        logo={protocol.logo_url}
        text={protocol.name}
        logoRadius={16}
        textStyle={style}
      />
    </View>
  );
};
