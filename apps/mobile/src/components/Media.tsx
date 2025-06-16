import { IconPlay } from '@/assets/icons/nft';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useSwitch } from '@/hooks/useSwitch';
import React, { ReactNode, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import FastImage, { FastImageProps, ImageStyle } from 'react-native-fast-image';
import Video, { VideoRef } from 'react-native-video';
import { CustomTouchableOpacity } from './CustomTouchableOpacity';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';

export enum MEDIA_TYPE {
  IMAGE = 'image',
  IMAGE_URL = 'image_url',
  VIDEO_URL = 'video_url',
  AUDIO_URL = 'audio_url',
}

interface MediaProps {
  src?: string;
  thumbnail?: string;
  poster?: string;
  type?: MEDIA_TYPE | NFTItem['content_type'];
  failedPlaceholder?: ReactNode;
  style?: ViewStyle;
  mediaStyle?: ImageStyle;
  handleSuccess?(): void;
  handleError?(): void;
  playable?: boolean;
  playIconSize?: number;
}

const isDebankUrl = (url: string) => url.includes('debank.com');

const getValidLink = (link?: string) => {
  return link && link.startsWith('http') && isDebankUrl(link)
    ? link
    : undefined;
};

const SUPPORT_IMAGE_TYPE = ['.png', '.jpg', '.jpeg', '.gif', '.ico'];

const checkImageLink = (link?: string) => {
  return getValidLink(link) &&
    SUPPORT_IMAGE_TYPE.some(x => link?.toLowerCase().endsWith(x))
    ? link
    : undefined;
};

export const Media = ({
  type = MEDIA_TYPE.IMAGE_URL,
  src,
  poster,
  failedPlaceholder,
  handleSuccess,
  handleError,
  style,
  mediaStyle,
  playable = false,
  thumbnail,
  playIconSize,
  onPress,
  resizeMode,
}: MediaProps &
  Pick<TouchableOpacityProps, 'onPress'> &
  Pick<FastImageProps, 'resizeMode'>) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyle(colors), [colors]);
  // const isFocused = useIsFocused();

  const Component: typeof React.Component | React.FC = useMemo(
    () => (onPress ? CustomTouchableOpacity : View),
    [onPress],
  );

  const ref = useRef<VideoRef>(null);
  const { on: loading, turnOff } = useSwitch(true);
  const {
    on: failed,
    turnOff: loadingSucceed,
    turnOn: loadingFail,
  } = useSwitch(false);
  const { on: pause, toggle } = useSwitch(true);

  const _src = useMemo(() => getValidLink(src), [src]);
  const _thumbnail = useMemo(() => checkImageLink(thumbnail), [thumbnail]);
  const _poster = useMemo(() => checkImageLink(poster), [poster]);

  const imageUrl = useMemo(() => _thumbnail || _src, [_thumbnail, _src]);

  // for image
  const source = useMemo(
    () => ({
      uri: imageUrl,
    }),
    [imageUrl],
  );

  // for video
  const thumbnailSource = useMemo(
    () => ({
      uri: _thumbnail,
    }),
    [_thumbnail],
  );

  const srcSource = useMemo(() => ({ uri: _src }), [_src]);

  const onSuccess = useCallback(() => {
    turnOff();
    loadingSucceed();
    handleSuccess && handleSuccess();
  }, [handleSuccess, loadingSucceed, turnOff]);

  const onError = useCallback(() => {
    turnOff();
    loadingFail();
    handleError && handleError();
  }, [handleError, loadingFail, turnOff]);

  const changePlay = useCallback(() => {
    ref?.current?.seek(0);
    toggle();
  }, [toggle]);
  const containerStyles = useMemo(
    () => StyleSheet.flatten([styles.view, style]),
    [styles.view, style],
  );
  const mediaContainerStyles = useMemo(
    () => StyleSheet.flatten([styles.media, mediaStyle]),
    [styles.media, mediaStyle],
  );

  const handleLoad = useCallback(
    () => !pause && onSuccess(),
    [pause, onSuccess],
  );

  if (failed || !_src) {
    return <View style={containerStyles}>{failedPlaceholder}</View>;
  }

  return (
    <Component style={containerStyles} onPress={onPress}>
      {type === MEDIA_TYPE.IMAGE || type === MEDIA_TYPE.IMAGE_URL ? (
        <FastImage
          source={source}
          style={mediaContainerStyles}
          onLoad={onSuccess}
          onError={onError}
          onLoadEnd={turnOff}
          resizeMode={resizeMode}
          fallback
        />
      ) : null}
      {type === MEDIA_TYPE.VIDEO_URL ? (
        playable ? (
          <CustomTouchableOpacity style={mediaContainerStyles} onPress={toggle}>
            <Video
              style={mediaContainerStyles}
              source={srcSource}
              controls={!pause}
              onLoad={handleLoad}
              onError={onError}
              paused={pause}
              ref={ref}
              onEnd={changePlay}
              poster={_poster}
            />

            {pause ? (
              <CustomTouchableOpacity
                onPress={toggle}
                style={styles.detailPlayIcon}>
                <IconPlay width={72} height={72} />
              </CustomTouchableOpacity>
            ) : null}
          </CustomTouchableOpacity>
        ) : (
          <>
            {_thumbnail ? (
              <FastImage
                source={thumbnailSource}
                style={mediaContainerStyles}
                resizeMode="cover"
                onLoad={onSuccess}
                onError={onError}
                onLoadEnd={turnOff}
                fallback
              />
            ) : (
              <Video
                style={mediaContainerStyles}
                source={srcSource}
                onLoad={onSuccess}
                onError={onError}
                paused={pause}
                poster={_poster}
              />
            )}
            <IconPlay
              width={playIconSize || 16}
              height={playIconSize || 16}
              style={styles.playIcon}
            />
          </>
        )
      ) : null}
    </Component>
  );
};

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    view: {
      width: 100,
      height: 100,
      // borderRadius: 8,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: colors['neutral-bg-1'],
    },
    media: {
      width: '100%',
      height: '100%',
      zIndex: 1,
    },
    loading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    playIcon: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      alignItems: 'center',
      zIndex: 1,
    },
    detailPlayIcon: {
      position: 'absolute',
      right: 6,
      bottom: 6,
      alignItems: 'center',
      width: 72,
      height: 72,
      zIndex: 1,
    },
  });
