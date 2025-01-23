import { useCallback, useLayoutEffect } from 'react';
import { Text } from 'react-native';
import { View } from 'react-native';
import { RightHeader } from './components/RightHeader';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer from '@/components2024/ScreenContainer/NormalScreenContainer';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { SelectRegion } from './components/SelectRegion';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { BuyToken } from './components/Token';
import { useBuy } from './hooks';
import SwitchBtn from '../Bridge/components/BridgeSwitchBtn';
import { BestQuoteLoading } from '../Bridge/components/loading';
import { BuyQuoteList } from './components/QuoteList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Button } from '@/components2024/Button';
import { colord } from 'colord';

const floatBottom_height = 140;

export const BuyScreen = () => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const headerRight = useCallback(() => <RightHeader onPress={() => {}} />, []);
  useLayoutEffect(() => {
    setNavigationOptions({
      headerRight,
    });
  }, [headerRight, setNavigationOptions]);

  const {
    region,
    switchRegion,

    currency,
    switchCurrency,

    toToken,
    onToTokenChange,

    amount,
    onPayMountChange,
  } = useBuy();

  const isQuoteLoading = false;

  return (
    <NormalScreenContainer>
      <KeyboardAwareScrollView
        enableOnAndroid
        scrollEnabled
        extraHeight={52}
        keyboardOpeningTime={0}
        contentContainerStyle={styles.screen}>
        <View>
          <SelectRegion region={region} onSelectRegion={switchRegion} />
        </View>
        <View style={{ gap: 8 }}>
          <BuyToken type="from" currency="USD" />
          <BuyToken type="to" currency="USD" />
          <SwitchBtn style={styles.switchButtonContainer} onPress={() => {}} />
        </View>

        {isQuoteLoading && (
          <>
            <Text style={styles.searchingQuote}>
              {t('page.buy.searchingQuote')}
            </Text>

            <View style={styles.loadingQuoteContainer}>
              <BestQuoteLoading />
            </View>
          </>
        )}

        <BuyQuoteList />
        <View style={styles.bottom} />
      </KeyboardAwareScrollView>
      <LinearGradient
        colors={[
          colord(colors2024['neutral-bg-1']).alpha(0.3).toRgbString(),
          colors2024['neutral-bg-1'],
        ]}
        locations={[0, 1]}
        start={{ x: 0.54, y: 0 }}
        end={{ x: 0.54, y: 0.5 }}
        style={styles.floatBottom}>
        <Button title={t('global.Confirm')} />
      </LinearGradient>
    </NormalScreenContainer>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  screen: {
    paddingHorizontal: 20,
  },

  tokenBox: {
    backgroundColor: colors2024['neutral-bg-2'],
    padding: 24,
    borderRadius: 20,
  },

  label: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },

  interfaceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 36,
    alignItems: 'center',
  },

  switchButtonContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -30 }, { translateY: -40 }],
  },

  input: {
    flex: 1,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    color: colors2024['neutral-title-1'],
    fontSize: 28,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    // height: 36,
    lineHeight: 36,
    paddingLeft: 0,
    borderWidth: 0,
    overflow: 'hidden',
  },

  divider: {
    marginHorizontal: 12,
    borderWidth: 0,
    borderLeftWidth: 1,
    width: 0,
    height: 27,
    borderColor: colors2024['neutral-line'],
  },

  token: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 20,
    backgroundColor: colors2024['neutral-line'],
  },
  tokenText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 20,
  },
  usdValue: {
    marginTop: 8,
    color: colors2024['neutral-info'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 18,
  },

  searchingQuote: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 36,
    marginBottom: 18,
  },

  loadingQuoteContainer: {
    borderWidth: 1,
    paddingBottom: 16,
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
  },

  floatBottom: {
    width: '100%',
    height: floatBottom_height,
    paddingTop: 10,
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
  },
  bottom: {
    height: floatBottom_height,
  },
}));
