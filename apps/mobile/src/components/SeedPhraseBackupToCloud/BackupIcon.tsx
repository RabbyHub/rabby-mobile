import { Image, StyleSheet, Text, View } from 'react-native';
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
  status: 'success' | 'error' | 'unlock' | 'running' | 'info';
  isGray?: boolean;
  description?: string;
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
      marginTop: 42,
    },
    iconWrapper: {
      position: 'relative',
    },
    errorText: {
      color: colors['red-default'],
    },
    successText: {
      color: colors['green-default'],
    },
  });

export const BackupIcon: React.FC<Props> = ({
  status,
  isGray,
  description,
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
      ? require('@/assets/icons/address/icloud-gray.png')
      : require('@/assets/icons/address/icloud.png');
  }, [isGray]);
  const StatusIcon = React.useMemo(() => {
    switch (status) {
      case 'success':
        return BackupSuccessSVG;
      case 'error':
        return BackupErrorSVG;
      case 'unlock':
        return BackupLockSVG;
      case 'running':
        return BackupUploadSVG;
      case 'info':
      default:
        return BackupInfoSVG;
    }
  }, [status]);

  return (
    <View style={styles.root}>
      <View style={styles.iconWrapper}>
        <Image style={styles.cloudIcon} source={CloudImageSrc} />

        <View style={styles.statusIconWrapper}>
          <StatusIcon style={styles.statusIcon} />
        </View>
        {status === 'running' && (
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
          ])}>
          {description}
        </Text>
      )}
    </View>
  );
};
