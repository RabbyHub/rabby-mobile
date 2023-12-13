import React from 'react';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';

import { StyleSheet, View, Text } from 'react-native';
import { useThemeColors } from '@/hooks/theme';

import { default as RcWatchAddress } from '@/assets/icons/address/watch.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { RcIconRightCC } from '@/assets/icons/common';
import { ThemeColors } from '@/constant/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import TouchableItem from '@/components/Touchable/TouchableItem';
import { apisAddress } from '@/core/apis';
import { useAccounts } from '@/hooks/account';

const RcIconRight = makeThemeIconFromCC(RcIconRightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

const TEST_ADDR = '0x10b26700b0a2d3f5ef12fa250aba818ee3b43bf4';
function TestBlock() {
  const { fetchAccounts } = useAccounts();

  return (
    <View style={{ padding: 20 }}>
      <TouchableItem
        onPress={() => {
          apisAddress.addWatchAddress(TEST_ADDR);
          setTimeout(fetchAccounts, 500);
        }}>
        <>
          <Text>Add Address hongbo.eth:</Text>
          <Text>({TEST_ADDR})</Text>
        </>
      </TouchableItem>
    </View>
  );
}

function BottomBlockArea() {
  const colors = useThemeColors();

  return (
    <View style={[styles.blockView]}>
      {/* Import Watch-only Address */}
      <Text
        style={{
          color: colors['neutral-body'],
          fontSize: 14,
          fontStyle: 'normal',
          fontWeight: '400',
          marginBottom: 8,
        }}>
        Import Watch-only Address
      </Text>

      <TouchableView
        style={[styles.entryItem, { backgroundColor: colors['neutral-bg-1'] }]}
        onPress={() => {}}>
        <View style={{ flexShrink: 1 }}>
          <RcWatchAddress style={[styles.keyringIcon]} />
        </View>
        <View
          style={{
            flexDirection: 'column',
            flexShrink: 1,
            width: '100%',
            marginLeft: 12,
          }}>
          <Text
            style={[styles.entryTitle, { color: colors['neutral-title-1'] }]}>
            Add Contacts
          </Text>
          <Text
            style={[styles.entrySubTitle, { color: colors['neutral-body'] }]}>
            You can also use it as a watch-only address
          </Text>
        </View>
        <View style={{ flexShrink: 1 }}>
          <RcIconRight width={20} height={20} />
        </View>
      </TouchableView>
    </View>
  );
}

function ImportNewAddressScreen(): JSX.Element {
  return (
    <NormalScreenContainer style={{ padding: 20 }}>
      <View style={[{ flex: 1 }]}>
        <TestBlock />
        <BottomBlockArea />
      </View>
    </NormalScreenContainer>
  );
}

const styles = StyleSheet.create({
  blockView: { width: '100%' },
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
});

export default ImportNewAddressScreen;
