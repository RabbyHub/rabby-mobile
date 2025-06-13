import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  View,
  TextStyle,
} from 'react-native';
import { IS_IOS } from '@/core/native/utils';
import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import BackupErrorSVG from '@/assets2024/icons/common/cancel.svg';
import BackupInfoSVG from '@/assets2024/icons/common/tip.svg';
import BackupLockSVG from '@/assets/icons/address/backup-lock.svg';
import BackupSuccessSVG from '@/assets/icons/address/backup-success.svg';
import BackupUploadSVG from '@/assets/icons/address/backup-upload.svg';
import { MaterialIndicator } from 'react-native-indicators';
import { createGetStyles2024 } from '@/utils/styles';

interface Props {
  status?:
    | 'success'
    | 'error'
    | 'unlock'
    | 'uploading'
    | 'info'
    | 'downloading'
    | 'loading';
  isGray?: boolean;
  description?: string;
  descriptionStyle?: StyleProp<TextStyle>;
  isDown?: boolean;
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  progress: {
    position: 'absolute',
    top: -10,
    left: -10,
  },
  statusIcon: {
    width: 28,
    height: 28,
  },
  statusIconWrapper: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    borderRadius: 100,
    zIndex: 1,
  },
  cloudIcon: {
    width: 80,
    height: 80,
  },
  root: {
    position: 'relative',
    alignItems: 'center',
  },
  description: {
    marginTop: 36,
    color: colors2024['neutral-title-1'],
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  iconWrapper: {
    position: 'relative',
  },
  errorText: {
    color: colors2024['red-default'],
    marginTop: 28,
  },
  successText: {
    color: colors2024['green-default'],
  },
  statusIconDownloading: {
    transform: [{ rotate: '180deg' }],
  },
}));

export const BackupIcon: React.FC<Props> = ({
  status,
  isGray,
  description,
  descriptionStyle,
  isDown,
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      const grayImage = isDown
        ? require('@/assets/icons/address/icloud-gray-new-down.png')
        : require('@/assets/icons/address/icloud-gray-new.png');
      return isGray ? grayImage : require('@/assets/icons/address/icloud.png');
    }
    return isGray
      ? require('@/assets/icons/address/gdrive-gray.png')
      : require('@/assets/icons/address/gdrive.png');
  }, [isGray, isDown]);
  const StatusIcon = React.useMemo(() => {
    switch (status) {
      case 'success':
        return BackupSuccessSVG;
      case 'error':
        return BackupErrorSVG;
      case 'unlock':
        return BackupLockSVG;
      case 'uploading':
      case 'downloading':
        return BackupUploadSVG;
      case 'info':
        return BackupInfoSVG;
      default:
        return undefined;
    }
  }, [status]);

  return (
    <View style={styles.root}>
      <View style={styles.iconWrapper}>
        <Image style={styles.cloudIcon} source={CloudImageSrc} />

        {StatusIcon && (
          <View style={styles.statusIconWrapper}>
            <StatusIcon
              style={StyleSheet.flatten([
                styles.statusIcon,
                status === 'downloading' && styles.statusIconDownloading,
              ])}
            />
          </View>
        )}

        {(status === 'uploading' ||
          status === 'downloading' ||
          status === 'loading') && (
          <View style={styles.progress}>
            <MaterialIndicator
              color={colors2024['brand-default']}
              size={100}
              trackWidth={2.5}
              borderRadius={4}
            />
          </View>
        )}
      </View>
      {description && (
        <Text
          style={StyleSheet.flatten([
            styles.description,
            status === 'error' && styles.errorText,
            status === 'success' && styles.successText,
            descriptionStyle,
          ])}>
          {description}
        </Text>
      )}
    </View>
  );
};
