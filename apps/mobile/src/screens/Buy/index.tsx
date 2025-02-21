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
import { BestQuoteLoading } from '../Bridge/components/loading';
import { BuyQuoteList } from './components/QuoteList';
import LinearGradient from 'react-native-linear-gradient';
import { Button } from '@/components2024/Button';
import { colord } from 'colord';
import { getTokenSymbol } from '@/utils/token';
import { openapi } from '@/core/request';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { PropsForAccountSwitchScreen } from '@/hooks/accountsSwitcher';
import { BuyToIcon } from './components/ToIcon';
import { toast } from '@/components2024/Toast';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { RootNames } from '@/constant/layout';
import InAppBrowser from 'react-native-inappbrowser-reborn';

const floatBottom_height = 112;

export const BuyScreen = ({
  isForMultipleAdderss,
}: {
  isForMultipleAdderss?: boolean;
}) => {
  useLastUsedAccountInScreen({ disableAutoEffect: isForMultipleAdderss });

  const { t } = useTranslation();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const headerRight = useCallback(() => <RightHeader />, []);
  useLayoutEffect(() => {
    setNavigationOptions({
      headerRight,
    });
  }, [headerRight, setNavigationOptions]);

  const {
    currentAddr,
    regionList,
    region,
    switchRegion,

    toToken,
    onToTokenChange,

    tokenAmount,

    amount,
    onPayMountChange,

    activeProvider,
    setActiveProvider,

    quotes,
    loading,
    noQuote,

    refreshQuotes,
  } = useBuy(isForMultipleAdderss);

  const isQuoteLoading = loading;

  const symbol = React.useMemo(() => getTokenSymbol(toToken), [toToken]);

  const [getUrlLoading, setUrlLoading] = React.useState(false);

  const toBuy = useCallback(async () => {
    if (currentAddr && activeProvider && region && amount && toToken) {
      setUrlLoading(true);
      try {
        const data = await openapi.getBuyWidgetUrl({
          user_addr: currentAddr,
          country_code: region,
          usd_amount: amount,
          receive_token_uuid: `${toToken?.chain}:${toToken?.id}`,
          service_provider: activeProvider,
          redirect_url: `https://rabby-io-git-feat-test-redirect-debanker.vercel.app/mobile-redirect/${
            isForMultipleAdderss ? RootNames.MultiBuy : RootNames.Buy
          }`,
        });
        await InAppBrowser.isAvailable();
        InAppBrowser.close();
        const result = await InAppBrowser.open(data.url, {
          modalPresentationStyle: 'fullScreen',
          animated: true,
          animations: {
            startEnter: 'slide_in_right',
            startExit: 'slide_out_left',
            endEnter: 'slide_in_left',
            endExit: 'slide_out_right',
          },
        });

        console.log('InAppBrowser open result', result);

        refreshQuotes();
        // onPayMountChange('');
      } catch (error) {
        toast.error(String(error));
        console.log('error', error);
      }
      setUrlLoading(false);
    }
  }, [
    currentAddr,
    activeProvider,
    region,
    amount,
    toToken,
    isForMultipleAdderss,
    refreshQuotes,
  ]);

  return (
    <NormalScreenContainer>
      {isForMultipleAdderss && (
        <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
      )}
      <KeyboardAwareScrollView
        enableOnAndroid
        scrollEnabled
        extraHeight={52}
        keyboardOpeningTime={0}
        contentContainerStyle={styles.screen}>
        <View>
          <SelectRegion
            region={region}
            onSelectRegion={switchRegion}
            regionList={regionList}
          />
        </View>
        <View style={{ gap: 8 }}>
          <BuyToken
            type="from"
            currency="USD"
            onInputChange={onPayMountChange}
            value={amount}
          />
          <BuyToken
            type="to"
            currency="USD"
            token={toToken}
            onTokenSelect={onToTokenChange}
            value={tokenAmount + ''}
            noQuote={noQuote}
            loading={loading}
          />
          <BuyToIcon style={styles.switchButtonContainer} />
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

        {noQuote ? (
          <Text style={styles.errorTip}>{t('page.buy.noQuote')}</Text>
        ) : null}

        {!loading && quotes?.length ? (
          <BuyQuoteList
            symbol={symbol}
            quotes={quotes || []}
            activeProvider={activeProvider}
            setActiveProvider={setActiveProvider}
          />
        ) : null}

        <View style={styles.bottom} />
      </KeyboardAwareScrollView>
      {!loading && quotes?.length ? (
        <LinearGradient
          colors={[
            colord(colors2024['neutral-bg-1']).alpha(0.3).toRgbString(),
            colors2024['neutral-bg-1'],
          ]}
          locations={[0, 1]}
          start={{ x: 0.54, y: 0 }}
          end={{ x: 0.54, y: 0.5 }}
          style={styles.floatBottom}>
          <Button
            title={t('page.buy.toBuy')}
            onPress={toBuy}
            loading={getUrlLoading}
            containerStyle={styles.btnContainerStyle}
          />
        </LinearGradient>
      ) : null}
    </NormalScreenContainer>
  );
};
const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof BuyScreen>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  return <BuyScreen {...props} isForMultipleAdderss />;
};

BuyScreen.ForMultipleAddress = ForMultipleAddress;

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
    paddingHorizontal: 24,
  },
  bottom: {
    height: floatBottom_height,
  },
  errorTip: {
    marginTop: 16,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
  },
  btnContainerStyle: {
    width: '100%',
  },
}));
