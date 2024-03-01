import { default as IconInputLoading } from '@/assets/icons/points/loading.svg';
import { default as IconInputChecked } from '@/assets/icons/points/checked.svg';
import React, { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { ClaimUserAvatar } from './ClaimUserAvatar';
import { useRabbyPointsInvitedCodeCheck } from '../hooks';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useCurrentAccount } from '@/hooks/account';
import { ellipsisAddress } from '@/utils/address';
import { formatTokenAmount } from '@/utils/number';
import { Button } from '@/components';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { GradientPoint } from './GradientPoint';
import { Skeleton } from '@rneui/base';
import useInterval from 'react-use/lib/useInterval';
import { Animated, Easing } from 'react-native';
import RcIconClose from '@/assets/icons/points/close-cc.svg';
import TouchableView from '@/components/Touchable/TouchableView';
dayjs.extend(utc);

export const ClaimRabbyPointsModal = (
  props: {
    visible: boolean;
    onCancel: () => void;
  } & ClaimPointsProps,
) => {
  const { visible, onCancel, ...other } = props;
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      style={styles.modal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}>
        <ClaimPoints {...other} onCancel={onCancel} />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const spinValue = new Animated.Value(0);

Animated.loop(
  Animated.timing(spinValue, {
    toValue: 1,
    duration: 100,
    easing: Easing.linear,
    useNativeDriver: true,
  }),
).start(() => {
  spinValue.setValue(0);
});

export const spin = spinValue.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg'],
});

interface ClaimPointsProps {
  web3Id?: string;
  logo?: string;
  onClaimed?: (code?: string) => void;
  onCancel?: () => void;
  snapshot?: {
    id: string;
    address_balance: number;
    metamask_swap: number;
    rabby_old_user: number;
    rabby_nadge: number;
    rabby_nft: number;
    extra_bouns: number;
    claimed: boolean;
    snapshot_at: number;
  };
  snapshotLoading?: boolean;
}

const ClaimPoints: React.FC<ClaimPointsProps> = ({
  web3Id,
  logo,
  onClaimed,
  snapshot,
  snapshotLoading,
  onCancel,
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();
  const [invitedCode, setInvitedCode] = useState('');
  const [loadingNum, setLoadingNum] = useState(0);
  const { currentAccount: account } = useCurrentAccount();
  const [focused, setFocused] = useState(false);

  const avatar = logo;
  const name = web3Id || ellipsisAddress(account?.address || '');
  const snapshotTime = snapshot?.snapshot_at
    ? dayjs
        .unix(snapshot?.snapshot_at)
        .utc(false)
        .format('UTC+0 YYYY-MM-DD HH:mm:ss')
    : '';

  const debounceInvitedCode = useDeferredValue(invitedCode);
  const { codeStatus, codeLoading } =
    useRabbyPointsInvitedCodeCheck(debounceInvitedCode);

  const iconStatue = useMemo(() => {
    if (!invitedCode) {
      return null;
    }
    if (codeLoading) {
      return (
        <View style={styles.iconLoadingContainer}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <IconInputLoading />
          </Animated.View>
        </View>
      );
    }
    if (!codeStatus?.invite_code_exist) {
      return null;
    }
    return (
      <View style={styles.iconCheckedContainer}>
        <IconInputChecked />
      </View>
    );
  }, [
    invitedCode,
    codeLoading,
    codeStatus?.invite_code_exist,
    styles.iconCheckedContainer,
    styles.iconLoadingContainer,
  ]);

  const fixedList = useMemo(
    () => [
      {
        key: 'address_balance',
        label: t('page.rabbyPoints.claimModal.addressBalance'),
      },
      {
        key: 'metamask_swap',
        label: t('page.rabbyPoints.claimModal.MetaMaskSwap'),
      },
      {
        key: 'rabby_old_user',
        label: t('page.rabbyPoints.claimModal.rabbyUser'),
      },
      {
        key: 'rabby_nadge',
        label: t('page.rabbyPoints.claimModal.rabbyValuedUserBadge'),
      },
      {
        key: 'rabby_nft',
        label: t('page.rabbyPoints.claimModal.rabbyDesktopGenesisNft'),
      },
    ],
    [t],
  );

  const list = useMemo(
    () =>
      codeStatus?.invite_code_exist
        ? [
            ...fixedList,
            {
              key: 'extra_bouns',
              label: t('page.rabbyPoints.claimModal.referral-code'),
            },
          ]
        : fixedList,
    [fixedList, codeStatus?.invite_code_exist, t],
  );

  const points = useMemo(() => {
    if (snapshot) {
      const {
        address_balance,
        metamask_swap,
        rabby_nadge,
        rabby_nft,
        rabby_old_user,
        extra_bouns,
      } = snapshot;
      return formatTokenAmount(
        address_balance +
          metamask_swap +
          rabby_nadge +
          rabby_nft +
          rabby_old_user +
          (codeStatus?.invite_code_exist ? extra_bouns : 0),
        0,
      );
    }
    return '';
  }, [snapshot, codeStatus?.invite_code_exist]);

  const titleLoading = snapshotLoading || loadingNum < list.length;

  useInterval(
    () => {
      setLoadingNum(s => s + 1);
    },
    !!snapshot && !snapshotLoading && loadingNum < list.length ? 900 : null,
  );
  const onSubmit = useCallback(() => {
    onClaimed?.(invitedCode);
  }, [onClaimed, invitedCode]);

  // const LinearGradientComponent: SkeletonProps['LinearGradientComponent'] =
  //   useCallback(
  //     props => <LinearGradient {...props} colors={['#5CEBFF', '#5C42FF']} />,
  //     [],
  //   );

  return (
    <View style={styles.container}>
      <TouchableView
        style={styles.closeView}
        onPress={() => {
          onCancel?.();
        }}>
        <RcIconClose color={colors['neutral-foot']} width={24} height={24} />
      </TouchableView>

      <Text style={styles.title}>{t('page.rabbyPoints.claimModal.title')}</Text>
      <View style={styles.avatarContainer}>
        <ClaimUserAvatar src={avatar} />
        <Text>{name}</Text>
      </View>
      <View style={styles.pointsContainer}>
        {!titleLoading ? (
          <GradientPoint style={styles.pointsText}>
            {titleLoading ? '' : points}
          </GradientPoint>
        ) : (
          <Skeleton
            width={80}
            height={40}
            animation="wave"
            // LinearGradientComponent={LinearGradientComponent}
            // style={styles.titleSkeleton}
          />
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          {t('page.rabbyPoints.claimModal.snapshotTime', {
            time: snapshotTime,
          })}
        </Text>
        <View style={styles.listContainer}>
          {list.map((e, idx) => (
            <Item
              key={e.key}
              label={e.label}
              value={snapshot?.[e.key]}
              loading={snapshotLoading || loadingNum < idx}
            />
          ))}
        </View>
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder={t('page.rabbyPoints.claimModal.placeholder')}
          value={invitedCode}
          onChangeText={text => setInvitedCode(text.toUpperCase())}
          style={StyleSheet.flatten([
            styles.input,
            focused && styles.inputFocused,
            !!invitedCode &&
              !codeLoading &&
              !codeStatus?.invite_code_exist &&
              styles.errorInput,
          ])}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          placeholderTextColor={colors['neutral-foot']}
          autoCorrect={false}
        />
        <View style={styles.inputStatus}>{iconStatue}</View>
      </View>
      {!!debounceInvitedCode &&
        !codeStatus?.invite_code_exist &&
        !codeLoading && (
          <Text style={styles.errorText}>
            {t('page.rabbyPoints.claimModal.invalid-code')}
          </Text>
        )}

      <Button
        title={t('page.rabbyPoints.claimModal.claim')}
        onPress={onSubmit}
        buttonStyle={styles.button}
        titleStyle={styles.buttonTitle}
      />
    </View>
  );
};

const Item: React.FC<{
  label: string;
  value: string | number;
  loading?: boolean;
}> = ({ label, value, loading = true }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  if (loading) {
    return (
      <View style={styles.itemContainer}>
        <Skeleton width={92} />
        <Skeleton width={52} />
      </View>
    );
  }
  return (
    <View style={styles.itemContainer}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>
        {Number(value) >= 0 ? `+${value}` : value || 0}
      </Text>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  modal: { maxWidth: 353, width: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    marginHorizontal: 20,
    maxWidth: 353,
    width: '100%',
    backgroundColor: colors['neutral-bg-1'],
    padding: 20,
    paddingBottom: 24,
    borderRadius: 8,
    position: 'relative',
  },
  closeView: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 10,
  },
  title: {
    color: colors['neutral-title1'],
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  titleSkeleton: {
    backgroundColor: '#5CEBFF',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    marginTop: 12,
    gap: 6,
  },
  avatar: {
    width: 20,
    height: 20,
  },
  pointsContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  pointsText: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoContainer: {
    borderRadius: 8,
    backgroundColor: colors['neutral-card-3'],
    padding: 12,
    paddingBottom: 16,
  },
  infoText: {
    color: '#7c86c8',
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 12,
  },
  listContainer: {
    gap: 16,
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    height: 44,
    padding: 0,
    marginVertical: 20,
  },
  input: {
    flex: 1,
    width: '100%',
    backgroundColor: colors['neutral-bg-1'],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors['neutral-line'],
    height: 44,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    color: colors['neutral-title1'],
  },
  inputStatus: {
    position: 'absolute',
    width: 16,
    height: 16,
    top: 14,
    right: 14,
  },
  inputFocused: {
    borderColor: colors['blue-default'],
  },
  errorInput: {
    borderColor: colors['red-default'],
  },
  errorText: {
    fontSize: 13,
    borderColor: colors['red-default'],
    marginBottom: 20,
    textAlign: 'center',
  },

  button: {
    borderRadius: 6,
    height: 52,
    width: '100%',
    backgroundColor: colors['blue-default'],
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: colors['neutral-title2'],
  },
  iconLoadingContainer: {
    width: 16,
    height: 16,
  },
  iconCheckedContainer: {
    width: 16,
    height: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemLabel: {
    color: colors['neutral-body'],
    fontSize: 13,
  },
  itemValue: {
    color: colors['neutral-title1'],
    fontSize: 13,
    fontWeight: '500',
  },
}));
