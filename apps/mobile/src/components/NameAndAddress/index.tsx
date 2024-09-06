import {
  CopyAddressIcon,
  CopyAddressIconType,
} from '@/components/AddressViewer/CopyAddress';
import { ALIAS_ADDRESS } from '@/constant/gas';
import { getAliasName } from '@/core/apis/contact';
import { useThemeStyles } from '@/hooks/theme';
import { ellipsisAddress } from '@/utils/address';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

export const NameAndAddress = ({
  address,
  hideCopy = false,
  style,
  nameStyle,
  addressStyle,
  copyIconStyle,
}: {
  address: string;
  hideCopy?: boolean;
  style?: StyleProp<ViewStyle>;
  nameStyle?: StyleProp<TextStyle>;
  addressStyle?: StyleProp<TextStyle>;
  copyIconStyle?: StyleProp<ViewStyle>;
}) => {
  const isAddr = useMemo(() => {
    return /^0x[a-zA-Z0-9]{40}/.test(address);
  }, [address]);

  const { styles } = useThemeStyles(getNameAndAddressStyle);

  const aliasName = useMemo(() => {
    return (
      getAliasName(address) || ALIAS_ADDRESS[address?.toLowerCase() || ''] || ''
    );
  }, [address]);

  const copyAddressRef = React.useRef<CopyAddressIconType>(null);

  const noCopy = !isAddr || hideCopy;

  return (
    <View style={[styles.lineContainer, style]}>
      <View
        style={styles.textWrapper}
        // disabled={noCopy}
        // onPress={() => {
        //   copyAddressRef.current?.doCopy();
        // }}
      >
        {aliasName && (
          <Text
            style={[styles.aliasNameStyle, nameStyle]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {aliasName}
          </Text>
        )}
        <Text style={[styles.text, addressStyle]} numberOfLines={1}>
          {aliasName
            ? `(${ellipsisAddress(address)})`
            : ellipsisAddress(address)}
        </Text>
      </View>
      {!noCopy && (
        <TouchableWithoutFeedback
          onPress={() => copyAddressRef.current?.doCopy()}>
          <CopyAddressIcon
            ref={copyAddressRef}
            address={address}
            style={[styles.copyIcon, copyIconStyle]}
          />
        </TouchableWithoutFeedback>
      )}
    </View>
  );
};

const getNameAndAddressStyle = createGetStyles(colors => {
  return {
    lineContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      maxWidth: '100%',
      // ...makeDebugBorder('yellow'),
    },
    textWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      flexShrink: 1,
    },
    aliasNameStyle: {
      fontSize: 12,
      marginRight: 0,
      color: colors['neutral-foot'],
      flexShrink: 1,
      minWidth: 0,
      // ...makeDebugBorder(),
    },
    text: {
      fontSize: 12,
      color: colors['neutral-foot'],
      flexShrink: 0,
    },
    copyIcon: { marginLeft: 3, width: 14, height: 14, flexShrink: 0 },
  };
});
