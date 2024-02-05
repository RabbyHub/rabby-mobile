import { useThemeColors } from '@/hooks/theme';
import React, { useRef } from 'react';
import {
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputSubmitEditingEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { RcIconCopyCC } from '@/assets/icons/common';
import { contactService } from '@/core/services';
import Clipboard from '@react-native-clipboard/clipboard';
import { toast } from '@/components/Toast';
import { SearchBar } from '@rneui/base';
import RcIconClose from '@/assets/icons/import-success/clear.svg';
// import { TouchableWithoutFeedback } from 'react-native-gesture-handler';
import {
  TouchableWithoutFeedback,
  // TextInput,
} from 'react-native-gesture-handler';

interface Props {
  address: string;
  aliasName?: string;
  onChange?: (aliasName: string) => void;
}

export const AddressInput: React.FC<Props> = ({
  address,
  aliasName,
  onChange,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          height: 'auto',
          backgroundColor: colors['neutral-card-1'],
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingTop: 12,
          position: 'relative',
        },
        searchContainer: {
          backgroundColor: 'transparent',
          flex: 1,
          width: '100%',
          padding: 0,
          // padding: 0,
          margin: 0,
        },
        input: {
          width: '100%',
          flex: 1,
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          paddingHorizontal: 6,
          // marginRight: 80,
          minHeight: 48,
          color: colors['neutral-title-1'],
          fontSize: 16,
          fontWeight: '500',
          paddingRight: 38,
        },
        address: {
          color: colors['neutral-body'],
          fontSize: Platform.OS === 'ios' ? 15 : 14,
          fontWeight: '400',
        },
        addressContainer: {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 10,
          paddingBottom: 12,
        },
        iconWrapper: {
          width: 18,
          height: 14,
          position: 'relative',
        },
        icon: {
          width: 14,
          height: 14,
          color: colors['neutral-foot'],
          position: 'absolute',
          left: 4,
          top: 2,
        },
        searchBarStyle: {
          margin: 0,
          padding: 0,
        },
        containerStyle: {
          borderTopWidth: 0,
          borderBottomWidth: 0,
          backgroundColor: colors['neutral-card-2'],
          borderRadius: 4,
          padding: 0,
        },
        inputContainerStyle: {
          backgroundColor: 'transparent',
          paddingHorizontal: 0,
          marginLeft: 0,
        },
        inputStyle: {
          color: colors['neutral-title-1'],
          fontSize: 16,
          fontWeight: '500',
        },
        leftIconContainerStyle: {
          width: 0,
          paddingLeft: 0,
          paddingRight: 0,
          marginLeft: 0,
          marginRight: 0,
        },
        clearIconContainer: {
          padding: 4,
        },
      }),

    [colors],
  );

  const onCopy = React.useCallback(() => {
    Clipboard.setString(address);
    toast.success('Copied');
  }, [address]);

  const handleSubmit = React.useCallback(
    (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
      contactService.setAlias({
        address,
        alias: e.nativeEvent.text,
      });
    },
    [address],
  );

  const [editingAliasName, setEditingAliasName] = React.useState<string>(
    aliasName || '',
  );
  const ref = React.useRef<any>(null);

  React.useEffect(() => {
    setEditingAliasName(aliasName || '');
  }, [aliasName]);

  return (
    <View style={styles.container}>
      {/* <TextInput
        ref={ref}
        onSubmitEditing={handleSubmit}
        value={editingAliasName}
        style={styles.input}
        onChange={nativeEvent => {
          setEditingAliasName(nativeEvent.nativeEvent.text);
          onChange?.(nativeEvent.nativeEvent.text);
        }}
        blurOnSubmit
        clearButtonMode="always"
        focusable={true}
      />
      {!!editingAliasName && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: 20,
            top: 28,
            width: 20,
            height: 20,
          }}
          onPress={() => {
            // setEditingAliasName('');
            // onChange?.('');
            ref.current?.clear();
          }}>
          <RcIconClose width={20} height={20} />
        </TouchableOpacity>
      )} */}

      <SearchBar
        ref={ref}
        style={styles.searchBarStyle}
        containerStyle={styles.containerStyle}
        inputContainerStyle={styles.inputContainerStyle}
        inputStyle={styles.inputStyle}
        leftIconContainerStyle={styles.leftIconContainerStyle}
        value={editingAliasName}
        onChangeText={v => {
          setEditingAliasName(v);
          onChange?.(v);
        }}
        clearIcon={
          <TouchableWithoutFeedback
            style={styles.clearIconContainer}
            onPress={() => {
              ref?.current?.clear();
            }}>
            <RcIconClose />
          </TouchableWithoutFeedback>
        }
        blurOnSubmit
      />

      <TouchableOpacity onPress={onCopy} style={styles.addressContainer}>
        <Text style={styles.address} textBreakStrategy="simple">
          {address}
          <View style={styles.iconWrapper}>
            <RcIconCopyCC
              color={colors['neutral-foot']}
              height={14}
              width={14}
              style={styles.icon}
            />
          </View>
        </Text>
      </TouchableOpacity>
    </View>
  );
};
function SearchIcon() {
  return null as React.ReactNode;
}
