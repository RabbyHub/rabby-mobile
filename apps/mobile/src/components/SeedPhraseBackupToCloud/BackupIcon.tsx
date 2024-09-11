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
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import BackupErrorSVG from '@/assets/icons/address/backup-error.svg';
import BackupInfoSVG from '@/assets/icons/address/backup-info.svg';
import BackupLockSVG from '@/assets/icons/address/backup-lock.svg';
import BackupSuccessSVG from '@/assets/icons/address/backup-success.svg';
import BackupUploadSVG from '@/assets/icons/address/backup-upload.svg';
import { MaterialIndicator } from 'react-native-indicators';

interface Props {
  status:
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
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
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
      borderWidth: 2,
      borderColor: 'white',
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
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      marginTop: 36,
    },
    iconWrapper: {
      position: 'relative',
    },
    errorText: {
      color: colors['red-default'],
      marginTop: 28,
    },
    successText: {
      color: colors['green-default'],
    },
    statusIconDownloading: {
      transform: [{ rotate: '180deg' }],
    },
  });

export const BackupIcon: React.FC<Props> = ({
  status,
  isGray,
  description,
  descriptionStyle,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const CloudImageSrc = React.useMemo(() => {
    if (IS_IOS) {
      return isGray
        ? require('@/assets/icons/address/icloud-gray.png')
        : require('@/assets/icons/address/icloud.png');
    }
    return isGray
      ? require('@/assets/icons/address/gdrive-gray.png')
      : require('@/assets/icons/address/gdrive.png');
  }, [isGray]);
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
              color={colors['blue-default']}
              size={100}
              trackWidth={2.5}
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
