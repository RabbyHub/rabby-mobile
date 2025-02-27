import { Text } from '@/components';
import { RootNames } from '@/constant/layout';
import { apisSafe } from '@/core/apis/safe';
import { useTheme2024 } from '@/hooks/theme';
import { replaceToFirst } from '@/utils/navigation';
import { isValidAddress } from '@ethereumjs/util';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn, useRequest } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard, TouchableWithoutFeedback, View } from 'react-native';
import { Spin } from '../TransactionRecord/components/Spin';
import { Chain } from '@/constant/chains';
import { useDuplicateAddressModal } from './components/DuplicateAddressModal';
import { createGetStyles2024 } from '@/utils/styles';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { NextInput } from '@/components2024/Form/Input';
import PasteButton from '@/components2024/PasteButton';
import { ellipsisAddress } from '@/utils/address';

export const ImportSafeAddressScreen2024 = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });

  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState<string>();
  const { t } = useTranslation();

  const {
    data: chainList,
    runAsync,
    loading,
  } = useRequest(
    async (address: string) => {
      const res = await apisSafe.fetchGnosisChainList(address);
      if (!res.length) {
        throw new Error('This address is not a valid safe address');
      }
      return res;
    },
    {
      manual: true,
      debounceWait: 500,
      onBefore() {
        setError('');
      },
      onError(e) {
        setError(e.message);
      },
      onSuccess() {
        setError('');
      },
    },
  );

  const handleChange = useMemoizedFn(text => {
    const value = text;
    setInput(value);
    if (!value) {
      setError(t('page.importSafe.error.required'));
      return;
    }
    if (!isValidAddress(value)) {
      setError(t('page.importSafe.error.invalid'));
      return;
    }
    runAsync(value);
  });
  const duplicateAddressModal = useDuplicateAddressModal();

  const handleNext = async () => {
    Keyboard.dismiss();
    try {
      await apisSafe.importGnosisAddress(
        input,
        (chainList || []).map(chain => chain.network),
      );
      replaceToFirst(RootNames.StackAddress, {
        screen: RootNames.ImportSuccess2024,
        params: {
          type: KEYRING_TYPE.GnosisKeyring,
          address: input,
          brandName: KEYRING_CLASS.GNOSIS,
          alias: ellipsisAddress(input),
          supportChainList: chainList,
        },
      });
    } catch (err: any) {
      if (err.name === 'DuplicateAccountError') {
        duplicateAddressModal.show({
          address: err.message,
          brandName: KEYRING_CLASS.GNOSIS,
          type: KEYRING_TYPE.GnosisKeyring,
        });
      } else {
        setError(err?.message || t('Not a valid address'));
      }
    }
  };

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('global.Confirm'),
        onPress: handleNext,
        disabled:
          !input || !!error || loading || (chainList && chainList.length <= 0),
      }}
      style={styles.screen}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <View style={styles.topContent}>
            <WalletIcon
              type={KEYRING_TYPE.GnosisKeyring}
              width={40}
              height={40}
              style={styles.icon}
            />
            <View>
              <NextInput.TextArea
                style={styles.textContainer}
                inputStyle={styles.textArea}
                tipText={''}
                hasError={!!error}
                fieldErrorTextStyle={styles.error}
                containerStyle={Object.assign(
                  {},
                  error
                    ? {}
                    : {
                        borderColor: 'transparent',
                      },
                )}
                inputProps={{
                  placeholder: 'Input safe address',
                  value: input,
                  blurOnSubmit: true,
                  returnKeyType: 'done',
                  onChangeText: handleChange,
                }}
              />
              {loading ? (
                <View style={styles.loading}>
                  <Spin
                    style={styles.spin}
                    color={colors2024['neutral-secondary']}
                  />
                  <Text style={styles.loadingText}>
                    {t('page.importSafe.loading')}
                  </Text>
                </View>
              ) : (
                <>
                  {error ? (
                    <Text style={styles.errorMessage}>{error}</Text>
                  ) : (
                    !!chainList?.length && (
                      <GnosisSupportChainList data={chainList} />
                    )
                  )}
                </>
              )}
            </View>

            <PasteButton
              style={styles.pasteButton}
              onPaste={text => {
                handleChange(text);
              }}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
    </FooterButtonScreenContainer>
  );
};

export const GnosisSupportChainList = ({
  data,
  style,
}: {
  data: Chain[];
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { t } = useTranslation();

  return (
    <View style={[styles.chainListContainer, style]}>
      <Text style={styles.chainListDesc}>
        {t('page.importSafe.gnosisChainDesc', {
          count: data?.length,
        })}
      </Text>
      <View style={styles.chainList}>
        {data?.map(chain => {
          return (
            <View style={styles.chainListItem} key={chain.id}>
              <Image
                source={{
                  uri: chain.logo,
                }}
                alt=""
                style={styles.chainLogo}
              />
              <Text style={styles.chainName}>{chain.name}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  screen: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    height: '100%',
    width: '100%',
    paddingHorizontal: 20,
  },
  topContent: {
    alignItems: 'center',
    flexShrink: 0,
  },
  errorMessage: {
    color: ctx.colors2024['red-default'],
    fontSize: 13,
    marginTop: 12,
    marginBottom: 16,
  },
  icon: {
    width: 40,
    height: 40,
  },
  itemAddressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
  },
  qAndASection: {
    marginBottom: 24,
  },
  textContainer: {
    marginTop: 20,
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  textArea: {
    marginTop: 14,
    paddingHorizontal: 20,
    backgroundColor: ctx.colors['neutral-card-1'],
  },
  error: {
    textAlign: 'left',
  },
  pasteButton: {
    marginTop: 58,
  },
  tipWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
    marginBottom: 28,
  },
  tip: {
    color: ctx.colors2024['neutral-info'],
    fontWeight: '400',
    fontSize: 16,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  spin: {
    width: 16,
    height: 16,
  },
  loadingText: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  tipIcon: {
    width: 16,
    height: 16,
  },
  modalNextButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    color: ctx.colors2024['neutral-InvertHighlight'],
    backgroundColor: ctx.colors2024['brand-default'],
  },
  chainListContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  chainListDesc: {
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 12,
  },
  chainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  chainListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chainLogo: {
    width: 20,
    height: 20,
  },
  chainName: {
    fontSize: 12,
    fontWeight: '400',
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 16,
  },
}));
