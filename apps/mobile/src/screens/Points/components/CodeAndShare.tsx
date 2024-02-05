import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import IconCopy from '@/assets/icons/points/copy-cc.svg';
import IconTwitter from '@/assets/icons/points/twitter-x.svg';
import { useRabbyPoints } from '../hooks';
import { formatTokenAmount } from '@/utils/number';
import { toast } from '@/components/Toast';
import Clipboard from '@react-native-clipboard/clipboard';
import { openExternalUrl } from '@/core/utils/linking';
import { Skeleton } from '@rneui/base';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';

export const shareRabbyPointsTwitter = ({
  snapshot,
  usedOtherInvitedCode,
  invitedCode,
}: {
  snapshot?: ReturnType<typeof useRabbyPoints>['snapshot'];
  usedOtherInvitedCode?: boolean;
  invitedCode?: string;
}) => {
  if (!snapshot) return;

  const {
    address_balance,
    metamask_swap,
    rabby_nadge,
    rabby_nft,
    rabby_old_user,
    extra_bouns,
  } = snapshot;

  const sum =
    address_balance +
    metamask_swap +
    rabby_nadge +
    rabby_nft +
    rabby_old_user +
    (usedOtherInvitedCode ? extra_bouns : 0);
  const score = formatTokenAmount(sum, 0);

  let text =
    encodeURIComponent(`Just scored ${score} Rabby Points with a few clicks, and you can get extra points for migrating  MetaMask wallet into Rabby!

Everyone can get points, and use my referral code '${invitedCode}' for an extra bonus.

Ready to claim? @Rabby_io

https://rabby.io/rabby-points?code=${invitedCode}
`);
  if (snapshot.metamask_swap) {
    text =
      encodeURIComponent(`Just scored ${score} Rabby Points with a few clicks, and got extra ${formatTokenAmount(
        snapshot.metamask_swap,
        0,
      )} points for migrating my MetaMask wallet into Rabby!

Everyone can get points, and use my referral code '${invitedCode}' for an extra bonus.

Ready to claim? @Rabby_io

https://rabby.io/rabby-points?code=${invitedCode}
`);
  }

  if (sum === 0) {
    text =
      encodeURIComponent(`Claim Rabby Points with a few clicks, and you can get extra points for migrating  MetaMask wallet into Rabby!

Everyone can get points, and use my referral code '${invitedCode}' for an extra bonus.

Ready to claim? @Rabby_io

https://rabby.io/rabby-points?code=${invitedCode}
`);
  }
  console.log('openExternalUrl');
  openExternalUrl(`https://twitter.com/intent/tweet?text=${text}`);
};

export const CodeAndShare: React.FC<{
  invitedCode?: string;
  snapshot?: ReturnType<typeof useRabbyPoints>['snapshot'];
  loading?: boolean;
  usedOtherInvitedCode?: boolean;
}> = ({ invitedCode, snapshot, loading, usedOtherInvitedCode }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const copyInvitedCode = React.useCallback(() => {
    Clipboard.setString(invitedCode || '');
    toast.success('Referral code copied!');
  }, [invitedCode]);

  const share = React.useCallback(() => {
    shareRabbyPointsTwitter({ snapshot, usedOtherInvitedCode, invitedCode });
  }, [snapshot, usedOtherInvitedCode, invitedCode]);

  if (loading) {
    return <CodeAndShareLoading />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={copyInvitedCode}
        style={styles.buttonContainer}>
        <Text style={styles.buttonText}>{invitedCode?.toUpperCase()}</Text>
        <IconCopy
          style={styles.icon}
          width={16}
          height={16}
          color={colors['neutral-body']}
        />
      </TouchableOpacity>
      <View style={styles.gap} />
      <TouchableOpacity onPress={share} style={styles.buttonContainer}>
        <Text style={styles.buttonText}>Share on</Text>
        <IconTwitter
          style={styles.icon}
          width={16}
          height={16}
          color={colors['neutral-title-1']}
        />
      </TouchableOpacity>
    </View>
  );
};

const CodeAndShareLoading: React.FC = () => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.loadingContainer}>
      <Skeleton width={172} height={40} style={styles.buttonContainer} />
      <View style={styles.gap} />
      <Skeleton width={172} height={40} style={styles.buttonContainer} />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gap: {
    width: 16,
  },
  buttonContainer: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 6,
    flex: 1,
    maxWidth: 172,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors['neutral-card2'],
  },
  buttonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors['neutral-title-1'],
  },
  icon: {
    marginLeft: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonContainer: {
    width: 172,
    height: 40,
    borderRadius: 6,
  },
}));
