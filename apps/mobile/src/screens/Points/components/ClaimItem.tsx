import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@/hooks/theme';
import { Button, Tip } from '@/components';
import LinearGradient from 'react-native-linear-gradient';
import { Skeleton } from '@rneui/base';
import { createGetStyles } from '@/utils/styles';

const getStyles = createGetStyles(colors => ({
  container: {
    position: 'relative',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 16,
    borderColor: colors['neutral-line'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  claimContainer: {
    backgroundColor: colors['blue-light-1'],
  },
  topContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomColor: colors['neutral-line'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  titleText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors['neutral-title1'],
  },
  titleStyle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors['neutral-title2'],
  },
  disabledTitleStyle: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.5,
    color: colors['neutral-foot'],
  },

  claimButton: {
    borderRadius: 4,
    minWidth: 100,
    width: 'auto',
    paddingHorizontal: 12,
    height: 32,
    fontSize: 13,
    fontWeight: '500',
  },
  disabledBtn: {
    borderRadius: 4,
    minWidth: 100,
    width: 'auto',
    paddingHorizontal: 12,
    height: 32,
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: colors['neutral-card2'],
  },
  claimLoading: {
    top: 2,
  },
  descriptionText: {
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
    fontSize: 12,
    color: colors['neutral-foot'],
  },
  claimItemLoadingContainer: {
    // Add any specific styles for the ClaimItemLoading container
  },
  skeletonInput: {
    width: 146,
    height: 18,
  },
  loadingText: {
    paddingTop: 12,
    paddingBottom: 14,
    fontSize: 12,
  },
}));

interface ClaimItemProps {
  id: number;
  title: string;
  description: string;
  start_at: number;
  end_at: number;
  claimable_points: number;
  onClaim: (id: number, points: number) => void;
  claimable?: boolean;
  claimLoading?: boolean;
}

const ClaimItem: React.FC<ClaimItemProps> = props => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const disabled = React.useMemo(
    () =>
      props.claimable_points <= 0 || !props.claimable || !!props.claimLoading,
    [props.claimable_points, props.claimable, props.claimLoading],
  );

  const claim = React.useCallback(() => {
    if (!disabled) {
      props.onClaim(props.id, props.claimable_points || 0);
    }
  }, [disabled, props]);

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        props.claimable && styles.claimContainer,
      ])}>
      <View style={styles.topContainer}>
        <Text style={styles.titleText}>{props.title}</Text>
        <Tip content={'No points to be claimed now'}>
          <Button
            title={`${t('page.rabbyPoints.claimItem.claim')} ${
              props.claimable_points <= 0 || !props.claimable
                ? ''
                : props.claimable_points
            }`}
            linearGradientProps={{
              colors: props.claimable
                ? ['#5CEBFF', '#5C42FF']
                : [colors['neutral-card2'], colors['neutral-card2']],
              start: { x: 0.04, y: 0.16 },
              end: { x: 0.92, y: 1 },
            }}
            ViewComponent={props.claimable ? LinearGradient : undefined}
            buttonStyle={styles.claimButton}
            onPress={claim}
            titleStyle={styles.titleStyle}
            loading={props.claimLoading}
            disabled={!props.claimable}
            disabledStyle={styles.disabledBtn}
            disabledTitleStyle={styles.disabledTitleStyle}
          />
        </Tip>
      </View>
      <Text style={styles.descriptionText}>{props.description}</Text>
    </View>
  );
};

const ClaimItemLoading: React.FC = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={StyleSheet.flatten([styles.container])}>
      <View style={StyleSheet.flatten([styles.topContainer, { height: 56 }])}>
        <Skeleton width={124} height={18} />
      </View>
      <View style={styles.descriptionText}>
        <Skeleton width={200} height={14} />
      </View>
    </View>
  );
};

const ClaimLoading: React.FC = () => {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <ClaimItemLoading key={i} />
      ))}
    </>
  );
};

export { ClaimItem, ClaimItemLoading, ClaimLoading };
