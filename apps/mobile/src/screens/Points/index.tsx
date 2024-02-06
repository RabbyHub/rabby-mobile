import { FocusAwareStatusBar } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRabbyPoints } from './hooks';
import React from 'react';
import { ellipsisAddress } from '@/utils/address';
import { useCurrentAccount } from '@/hooks/account';
import { formatTokenAmount } from '@/utils/number';
import { toast } from '@/components/Toast';
import { openapi } from '@/core/request';
import { useTranslation } from 'react-i18next';
import { addressUtils } from '@rabby-wallet/base-utils';
import { PointsHeader } from './components/Header';
import { PointsContent } from './components/Content';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { SetReferralCode } from './components/ReferrralCode';
import { CodeAndShare } from './components/CodeAndShare';
import { ClaimRabbyPointsModal } from './components/ClaimRabbyPointsModal';
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import { ClaimRabbyVerifyModal } from './components/VerifyAddressModal';

const { isSameAddress } = addressUtils;

export const PointScreen = () => {
  const navigation = useNavigation();
  const bottomTabBatHeight = useBottomTabBarHeight();
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  const [currentUserCode, setCurrentUserCode] = useState<string | undefined>();
  const [claimedIds, setClaimedIds] = useState<number[]>([]);
  const [claimItemLoading, setClaimItemLoading] = useState<
    Record<number, boolean>
  >({});

  const { currentAccount: account } = useCurrentAccount();

  const {
    signature,
    signatureLoading,
    snapshot,
    snapshotLoading,
    userPointsDetail,
    userLoading,
    topUsers,
    topUsersLoading,
    activities,
    activitiesLoading,
    verifyAddress,
    // refreshAll,
    refreshActivities,
    refreshTopUsers,
    refreshUserPoints,
  } = useRabbyPoints();

  const avatar =
    userPointsDetail?.logo_thumbnail_url || userPointsDetail?.logo_url;

  const userName = React.useMemo(
    () => userPointsDetail?.web3_id || ellipsisAddress(account?.address || ''),
    [userPointsDetail?.web3_id, account?.address],
  );
  const [visible, setVisible] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [previousPoints, setPreviousPoints] = useState(0);

  const [currentPoints, setCurrentPoint] = useState(0);
  const [showDiffPoints, setShowDiffPoints] = useState(false);
  const [diffPoints, setDiffPoints] = useState(0);

  useEffect(() => {
    setPreviousPoints(userPointsDetail?.claimed_points || 0);
    setCurrentPoint(userPointsDetail?.claimed_points || 0);
  }, [userPointsDetail?.claimed_points]);

  const total = useMemo(
    () =>
      userPointsDetail?.total_claimed_points
        ? formatTokenAmount(userPointsDetail?.total_claimed_points, 0)
        : '',
    [userPointsDetail?.total_claimed_points],
  );
  const invitedCode = currentUserCode || userPointsDetail?.invite_code;
  const hadInvitedCode = !userLoading ? !!invitedCode : true;
  const initRef = useRef(false);

  const lockRef = useRef(false);

  const goBack = React.useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      initRef.current = false;
    }
  }, [navigation]);

  const claimSnapshot = React.useCallback(
    async (invite_code?: string) => {
      if (lockRef.current) return;
      lockRef.current = true;
      try {
        setVisible(false);
        await verifyAddress({
          code: invite_code,
          claimSnapshot: true,
        });
      } catch (error) {
        setVisible(true);
        console.error(error);
        console.log('claimSnapshot error');
        toast.info(String((error as any)?.message || error));
      }
      lockRef.current = false;
    },
    [verifyAddress],
  );

  const verifyAddr = React.useCallback(async () => {
    try {
      setVerifyVisible(false);
      await verifyAddress();
    } catch (error) {
      setVerifyVisible(true);
      toast.info(String((error as any)?.message || error));
      console.error(error);
    }
  }, [verifyAddress]);

  const claimItem = React.useCallback(
    async (campaign_id: number, points: number) => {
      if (account?.address && signature) {
        try {
          if (claimItemLoading[campaign_id]) {
            return;
          }
          setClaimItemLoading(e => ({ ...e, [campaign_id]: true }));
          await openapi.claimRabbyPointsById({
            user_id: account?.address,
            campaign_id: campaign_id,
            signature,
          });
          setCurrentPoint(e => {
            setPreviousPoints(e);
            setDiffPoints(points);
            return e + points;
          });
          refreshUserPoints();
          setClaimedIds(e =>
            e.includes(campaign_id) ? e : [...e, campaign_id],
          );
        } catch (error) {
          toast.info(String((error as any)?.message || error));
        } finally {
          setClaimItemLoading(e => ({ ...e, [campaign_id]: false }));
        }
      }
    },
    [account?.address, signature, claimItemLoading, refreshUserPoints],
  );

  const setReferralCode = React.useCallback(
    async (code: string) => {
      if (account?.address && signature) {
        await openapi.setRabbyPointsInviteCode({
          id: account?.address,
          signature,
          invite_code: code,
        });
        setCurrentUserCode(code);
        toast.success(t('page.rabbyPoints.code-set-successfully'));
      }
    },
    [account?.address, signature, t],
  );

  useEffect(() => {
    if (account?.address) {
      initRef.current = false;
    }
  }, [account?.address]);

  useFocusEffect(() => {
    return () => {
      // console.log('useFocusEffect');
      initRef.current = false;
    };
  });

  const focused = useIsFocused();

  const refreshInitRef = useRef(false);

  useEffect(() => {
    if (!focused) {
      initRef.current = false;
      refreshInitRef.current = false;
    } else {
      if (!refreshInitRef.current) {
        refreshInitRef.current = true;
        refreshActivities();
        refreshTopUsers();
        refreshUserPoints();
      }
    }

    if (focused && !initRef.current && !signatureLoading && !snapshotLoading) {
      if (snapshot && !snapshot?.claimed) {
        setVisible(true);
        setVerifyVisible(false);
      } else if (!signature) {
        setVisible(false);
        setVerifyVisible(true);
      }
      initRef.current = true;
    }
  }, [
    focused,
    snapshot,
    signatureLoading,
    snapshotLoading,
    refreshActivities,
    refreshTopUsers,
    refreshUserPoints,
    signature,
  ]);

  const currentUserIdx = useMemo(() => {
    if (topUsers && account?.address) {
      const idx = topUsers?.findIndex(e =>
        isSameAddress(e.id, account.address),
      );

      if (idx !== -1) {
        return idx;
      }
    }
    return 1000;
  }, [topUsers, account?.address]);

  const contentStyle = useMemo(
    () =>
      StyleSheet.flatten([
        styles.content,
        {
          paddingBottom: bottomTabBatHeight,
        },
      ]),
    [styles.content, bottomTabBatHeight],
  );

  const count = useRef({ pre: 0, now: 0 });
  count.current = { pre: previousPoints, now: currentPoints };

  return (
    <View style={styles.container}>
      <FocusAwareStatusBar
        barStyle="light-content"
        backgroundColor={'transparent'}
        translucent
      />
      <ImageBackground
        source={require('@/assets/icons/points/bg.png')}
        resizeMode="cover"
        style={styles.bgImage}
      />
      <ClaimRabbyPointsModal
        visible={visible}
        web3Id={userPointsDetail?.web3_id}
        logo={
          userPointsDetail?.logo_thumbnail_url || userPointsDetail?.logo_url
        }
        onClaimed={claimSnapshot}
        onCancel={React.useCallback(() => {
          setVisible(false);
          goBack();
        }, [goBack])}
        snapshot={snapshot}
        snapshotLoading={snapshotLoading}
      />
      <ClaimRabbyVerifyModal
        visible={verifyVisible}
        onCancel={React.useCallback(() => {
          setVerifyVisible(false);
          goBack();
        }, [goBack])}
        onConfirm={verifyAddr}
      />
      <SafeAreaView style={styles.container} edges={['top']}>
        <PointsHeader
          avatar={avatar}
          userName={userName}
          previousPoints={previousPoints}
          currentPoints={currentPoints}
          diffPoints={diffPoints}
          onComplete={React.useCallback(() => {
            console.log('onComplete');
            setShowDiffPoints(false);
          }, [])}
          onUpdate={React.useCallback(v => {
            console.log('onUpdate', v);
            if (count.current.pre !== count.current.now) {
              setShowDiffPoints(true);
            }
          }, [])}
          showDiffPoints={showDiffPoints}
          total={total}
        />
        <View style={contentStyle}>
          <PointsContent
            activities={activities}
            claimItem={claimItem}
            claimItemLoading={claimItemLoading}
            claimedIds={claimedIds}
            topUsers={topUsers}
            userPointsDetail={userPointsDetail}
            currentUserIdx={currentUserIdx}
            activitiesLoading={activitiesLoading}
            renderHeader={React.useCallback(
              () => (
                <View style={styles.padding20}>
                  {!hadInvitedCode ? (
                    <SetReferralCode onSetCode={setReferralCode} />
                  ) : (
                    <CodeAndShare
                      invitedCode={invitedCode}
                      snapshot={snapshot}
                      loading={
                        !userPointsDetail && (userLoading || snapshotLoading)
                      }
                      usedOtherInvitedCode={
                        !!(userPointsDetail as any)?.inviter_code
                      }
                    />
                  )}
                </View>
              ),
              [
                styles.padding20,
                hadInvitedCode,
                setReferralCode,
                invitedCode,
                snapshot,
                userLoading,
                snapshotLoading,
                userPointsDetail,
              ],
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const getStyle = createGetStyles(colors => ({
  container: { flex: 1 },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 320,
  },
  padding20: {
    padding: 20,
  },
  content: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors['neutral-bg1'],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
}));
