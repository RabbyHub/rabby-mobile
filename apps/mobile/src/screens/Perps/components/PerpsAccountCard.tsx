/* eslint-disable react-native/no-inline-styles */
import { RcTradPerps } from '@/assets2024/icons/perps';
import { Button } from '@/components2024/Button';
import {
  AccountHistoryItem,
  PositionAndOpenOrder,
} from '@/hooks/perps/usePerpsStore';
import { RcIconCloseCC } from '@/assets/icons/common';
import { useTheme2024 } from '@/hooks/theme';
import { GasAccountWrapperBg } from '@/screens/GasAccount/components/WrapperBg';
import { formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ImageBackground, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { usePerpsPopupState } from '../hooks/usePerpsPopupState';
import { usePerpsAccount } from '@/hooks/perps/usePerpsAccount';
import { Text } from '@/components/Typography';
import RcIconMinButton from '@/assets2024/icons/perps/IconMinButton.svg';
import ImgLearnMore from '@/assets2024/icons/perps/ImgLearnMore.png';
import RcIconLearnArrow from '@/assets2024/icons/perps/IconLearnArrow.svg';
import RcIconPlusButton from '@/assets2024/icons/perps/IconPlusButton.svg';
import RcIconAddFunds from '@/assets2024/icons/perps/IconAddFunds.svg';
import { apisPerps } from '@/core/apis';

export const PerpsAccountCard: React.FC<{
  isLogin: boolean;
  positionAndOpenOrders?: PositionAndOpenOrder[] | null;
  localLoadingHistory: AccountHistoryItem[];
}> = ({ isLogin, localLoadingHistory }) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const [popupState, setPopupState] = usePerpsPopupState();

  const { availableBalance, accountValue } = usePerpsAccount();

  const isNewUser = React.useMemo(() => {
    return Number(availableBalance) === 0 && accountValue === 0 && isLogin;
  }, [availableBalance, accountValue, isLogin]);

  const [hasClosedLearnMore, setHasClosedLearnMore] = React.useState(true);
  React.useEffect(() => {
    apisPerps.getHasClosedLearnMoreCard().then(closed => {
      setHasClosedLearnMore(closed);
    });
  }, []);

  const showLearnMore = isNewUser && !hasClosedLearnMore;

  return (
    <>
      <LinearGradient
        colors={['#0F2F3A', '#041920']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, styles.balanceCard]}>
        <View style={styles.balanceCardInner}>
          <View style={styles.balanceCardRow}>
            <View style={styles.balanceCardContentLeft}>
              <Text style={styles.balance}>
                {formatUsdValue(Number(availableBalance || 0))}
              </Text>
              <Text style={styles.availableBalance}>
                {t('page.perps.PerpsCard.available')}
              </Text>
            </View>
            {Number(availableBalance) === 0 ? (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setPopupState(prev => ({
                    ...prev,
                    isShowDepositPopup: true,
                  }));
                }}>
                <RcIconAddFunds />
                <Text style={styles.actionBtnText}>
                  {t('page.perps.PerpsCard.addFunds')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionBtns}>
                <TouchableOpacity
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowDepositPopup: true,
                    }));
                  }}>
                  <RcIconPlusButton />
                </TouchableOpacity>
                <TouchableOpacity
                  // style={styles.actionBtn}
                  onPress={() => {
                    setPopupState(prev => ({
                      ...prev,
                      isShowWithdrawPopup: true,
                    }));
                  }}>
                  <RcIconMinButton />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
      {showLearnMore && (
        <LinearGradient
          colors={isLight ? ['#FFF', '#FFF'] : ['#0F2F3A', '#041920']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, styles.balanceCard, { marginTop: 12 }]}>
          <ImageBackground
            source={ImgLearnMore}
            resizeMode="cover"
            style={styles.learnCardInner}>
            <View style={{ position: 'absolute', right: 16, top: 16 }}>
              <RcIconCloseCC
                width={20}
                height={20}
                color={colors2024['neutral-secondary']}
              />
            </View>
            <Text style={styles.learnTitle}>
              {t('page.perps.PerpsCard.title')}
            </Text>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 4,
              }}>
              <Text style={styles.learnDesc}>
                {t('page.perps.PerpsCard.learnMore')}
              </Text>
              <RcIconLearnArrow />
            </TouchableOpacity>
          </ImageBackground>
        </LinearGradient>
      )}
    </>
  );
};

// return (
//   <GasAccountWrapperBg style={[styles.card, styles.loginCard]}>
//     <View style={styles.loginCardContent}>
//       <RcTradPerps style={styles.icon} />
//       <Text style={styles.loginCardTitle}>
//         {t('page.perps.PerpsCard.title')}
//       </Text>
//       <Text style={styles.loginCardDesc}>
//         {t('page.perps.PerpsCard.loginDesc')}
//       </Text>
//     </View>
//     <View style={styles.loginCardBtns}>
//       <Button
//         height={48}
//         type="primary"
//         onPress={() => {
//           setPopupState(prev => ({
//             ...prev,
//             isShowLoginPopup: true,
//           }));
//         }}
//         titleStyle={styles.btnTitle}
//         title={t('page.perps.PerpsCard.loginBtn')}
//       />
//       <Button
//         height={48}
//         onPress={() => {
//           setPopupState(prev => ({
//             ...prev,
//             isShowGuidePopup: true,
//           }));
//         }}
//         buttonStyle={styles.learnBtn}
//         titleStyle={styles.learnBtnTitle}
//         title={t('page.perps.PerpsCard.learnBtn')}
//       />
//     </View>
//   </GasAccountWrapperBg>
// );
// };

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  loginCard: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 20,
    height: 20,
  },
  loginCardTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: colors2024['neutral-title-1'],
    textAlign: 'center',
  },
  loginCardDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  btnTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  loginCardContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  loginCardBtns: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    marginTop: 'auto',
  },
  learnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: colors2024['neutral-title-1'],
  },
  learnDesc: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: '#23C0B0',
  },
  learnBtn: {
    backgroundColor: colors2024['neutral-line'],
  },
  learnBtnTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
  balanceCard: {
    marginTop: 10,
    borderRadius: 16,
    padding: 2, // gradient border width
  },
  balanceCardInner: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0E1A1E',
  },
  learnCardInner: {
    position: 'relative',
    borderRadius: 16,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    height: 106,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  balanceCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceCardContentLeft: {
    flexDirection: 'column',
    flex: 1,
  },
  balance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '900',
    color: '#F7FAFC',
  },
  availableBalance: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: '#717380',
    marginTop: 4,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 120,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#23C0B0',
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: '#040601',
  },
  history: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
}));
