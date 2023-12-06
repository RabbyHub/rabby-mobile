/**
 * Sample React Native HomeScreen
 * https://github.com/facebook/react-native
 *
 * @format
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import RootScreenContainer from '@/components/ScreenContainer/RootScreenContainer';
import { RootNames, ScreenColors } from '@/constant/layout';

import { Colors } from 'react-native/Libraries/NewAppScreen';
import TouchableView from '@/components/Touchable/TouchableView';

import HeaderArea from './HeaderArea';
import { useNavigation } from '@react-navigation/native';
import { useThemeColors } from '@/hooks/theme';
import { useValidWalletServices } from '@/hooks/walletconnect';
import WalletConnect from '@walletconnect/client';
import { openWallet } from '@/utils/walletconnect';

const defaultParams = {
  bridge: 'https://derelay.rabby.io',
  clientMeta: {
    description: 'Connect with WalletConnect',
    url: 'https://debank.com',
    icons: ['https://debank.com/square.png'],
    name: 'Rabby Wallet',
  },
};

function Section({
  children,
  title,
}: React.PropsWithChildren<{
  title: string;
}>): JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

function AssetsSummary() {
  const navigation = useNavigation();
  const colors = useThemeColors();

  return (
    <View
      style={{
        height: '100%',
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}>
        <Text
          style={{
            fontSize: 18,
            lineHeight: 18,
            color: 'white',
          }}>
          This is Assets Summary, Go to{' '}
          <TouchableView
            onPress={() => {
              navigation.push(RootNames.AccountTransaction, {
                screen: RootNames.MyBundle,
                params: {},
              });
            }}>
            <Text
              style={{
                color: colors['blue-default'],
                fontSize: 18,
                lineHeight: 18,
              }}>
              My Bundle
            </Text>
          </TouchableView>
        </Text>
      </View>
    </View>
  );
}

function AssetsScrollList() {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{
        ...backgroundStyle,
        height: '100%',
      }}>
      <View
        style={{
          backgroundColor: isDarkMode ? Colors.black : Colors.white,
        }}>
        {Array(100)
          .fill(undefined)
          .map((_, idx) => {
            return (
              <Section title="This One Row" key={`psuedo-row-${idx}`}>
                This One Asset Token Row: {idx + 1}
              </Section>
            );
          })}
      </View>
    </ScrollView>
  );
}

function HomeScreen(): JSX.Element {
  const navigation = useNavigation();
  const { isLoading, validServices } = useValidWalletServices();
  React.useEffect(() => {
    navigation.setOptions({
      headerTitle: () => <HomeScreen.HeaderArea />,
    });
  }, [navigation]);

  const [state, setState] = useState<{ uri?: string; cb?: unknown }>({});

  const open = useCallback(
    async (uri: string, cb: unknown): Promise<unknown> => {
      // console.log('open');
      setState({
        uri,
        cb,
      });
      return undefined;
    },
    [setState],
  );

  const close = useCallback((): unknown => {
    setState(currentState => {
      // console.log('close');
      const { cb } = currentState;
      setTimeout(() => typeof cb === 'function' && cb(), 0);
      return {
        uri: undefined,
        cb: undefined,
      };
    });
    return undefined;
  }, [setState]);

  const qrcodeModal = useMemo(
    () => ({
      open,
      close,
    }),
    [open, close],
  );

  const connect = async () => {
    const wallet = validServices.find(
      item => item.name.toLowerCase() === 'metamask',
    );
    if (wallet) {
      const connector = new WalletConnect({
        qrcodeModal,
        ...defaultParams,
      });
      await connector.createSession();
      console.log('uri', connector.uri);
      openWallet(wallet, connector.uri);
    } else {
      console.log('no wallet');
    }
  };

  return (
    <RootScreenContainer
      style={{ backgroundColor: ScreenColors.homeHeaderBlue }}>
      <View
        style={{
          width: '100%',
          height: 280,
          flexShrink: 0,
        }}>
        {/* <AssetsSummary /> */}
        <Button title="connect" onPress={connect}></Button>
      </View>
      <AssetsScrollList />
    </RootScreenContainer>
  );
}

HomeScreen.HeaderArea = HeaderArea;

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default HomeScreen;
