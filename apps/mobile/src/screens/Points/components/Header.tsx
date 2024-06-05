import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { ClaimUserAvatar } from './ClaimUserAvatar';
import { CountUp, ReturnValue } from 'use-count-up';
import { useTranslation } from 'react-i18next';

export const PointsHeader = ({
  avatar,
  userName,
  previousPoints,
  currentPoints,
  showDiffPoints,
  diffPoints,
  onComplete,
  onUpdate,
  total,
  initClaimedEnded,
}: {
  avatar?: string;
  userName: string;
  previousPoints: number;
  currentPoints: number;
  diffPoints: number;
  onComplete: () => void;
  onUpdate: (value: ReturnValue) => void;
  showDiffPoints: boolean;
  total: string;
  initClaimedEnded?: boolean;
}) => {
  const { t } = useTranslation();

  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);

  return (
    <View>
      <Text style={styles.title}>{t('page.rabbyPoints.title')}</Text>
      <View style={styles.userInfoContainer}>
        <View style={styles.avatarContainer}>
          <ClaimUserAvatar src={avatar} />
          <Text style={styles.userName}>{userName}</Text>
        </View>
        <View>
          <View style={styles.pointsWrapper}>
            <Text
              style={
                initClaimedEnded ? styles.initClaimedEnded : styles.points
              }>
              {initClaimedEnded ? (
                t('page.rabbyPoints.initialPointsClaimEnded')
              ) : (
                <CountUp
                  start={previousPoints}
                  end={currentPoints}
                  duration={1}
                  isCounting={currentPoints !== previousPoints}
                  thousandsSeparator=","
                  onComplete={onComplete}
                  onUpdate={onUpdate}
                  key={currentPoints}
                />
              )}
            </Text>

            {/* {showDiffPoints && (
              <View style={styles.diffPointsContainer}>
                <Text style={styles.diffPoints}>+{diffPoints}</Text>
              </View>
            )} */}
          </View>
        </View>
        <View style={styles.totalPointsContainer}>
          <Text style={styles.totalPoints}>
            {t('page.rabbyPoints.out-of-x-current-total-points', { total })}
          </Text>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles(colors => ({
  title: {
    paddingTop: 16,
    paddingBottom: 28,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '500',
    color: colors['neutral-title2'],
  },
  userInfoContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 34,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 20,
    height: 20,
  },
  userName: {
    fontSize: 15,
    marginLeft: 4,
    color: colors['neutral-title2'],
    opacity: 0.8,
  },
  pointsWrapper: {
    position: 'relative',
    width: 'auto',
    padding: 0,
    margin: 0,
  },

  points: {
    color: colors['neutral-title2'],
    fontSize: 40,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 12,
    position: 'relative',
  },
  initClaimedEnded: {
    color: colors['neutral-title2'],
    fontSize: 20,
    fontWeight: '900',
    marginTop: 20,
    marginBottom: 25,
  },
  diffPointsContainer: {
    position: 'absolute',
    width: '100%',
    height: 30,
    top: -20,
    left: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'flex-end',
  },

  diffPoints: {
    fontSize: 14,
    fontWeight: 'normal',
    textAlign: 'right',
    textAlignVertical: 'bottom',
    color: colors['neutral-title-2'],
  },
  totalPointsContainer: {
    opacity: 0.7,
  },
  totalPoints: {
    fontSize: 12,
    fontWeight: 'normal',
    color: colors['neutral-title2'],
  },
}));
