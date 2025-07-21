import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React, { useState } from 'react';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { BrowserSiteCardList } from '@/screens/Browser/components/BrowserSiteCardList';
import { BrowserBookmarkEmpty } from './BrowserBookmarkEmpty';
import { useTranslation } from 'react-i18next';
import { DropDownMenuView } from '@/components2024/DropDownMenu';
import { RcIconAddPlusCircle } from '@/assets2024/icons/browser';

export const BrowserBookmarkList = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle });
  const { openTab } = useBrowser();
  const { bookmarkList, removeBookmark, addBookmark, getBookmark } =
    useBrowserBookmark();

  const handlePress = useMemoizedFn((dappInfo: DappInfo) => {
    openTab(dappInfo.url || dappInfo.origin);
  });

  const handleFavoritePress = useMemoizedFn((dappInfo: DappInfo) => {
    const key = dappInfo.url || dappInfo.origin;
    if (getBookmark(key)) {
      removeBookmark(key);
    } else {
      addBookmark({
        url: key,
        name: dappInfo.name,
        icon: dappInfo.icon,
        createdAt: Date.now(),
      });
    }
  });

  const { t } = useTranslation();

  const [isShowDelete, setIsShowDelete] = useState(false);

  return (
    <View style={[styles.container, style]}>
      <BrowserSiteCardList
        data={bookmarkList}
        onPress={handlePress}
        onFavoritePress={handleFavoritePress}
        style={styles.list}
        ListEmptyComponent={BrowserBookmarkEmpty}
        isShowDelete={isShowDelete}
      />
      <View
        // eslint-disable-next-line react-native/no-inline-styles
        style={{
          ...styles.bottomArea,
          borderColor: isLight
            ? 'rgba(0, 0, 0, 0.06)'
            : 'rgba(255, 255, 255, 0.06)',
        }}>
        <TouchableOpacity
          onPress={() => {
            setIsShowDelete(prev => !prev);
          }}>
          <Text style={styles.bottomText}>{t('global.Edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => openTab()}>
          <RcIconAddPlusCircle
            width={44}
            height={44}
            color={colors2024['neutral-foot']}
            borderColor={colors2024['neutral-line']}
            backgroundColor={colors2024['neutral-bg-1']}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            // navigation.goBack();
          }}>
          <Text style={styles.bottomText}>{t('global.Done')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    height: '100%',
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  list: {
    paddingHorizontal: 20,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  subTitle: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    color: colors2024['neutral-secondary'],
  },
  bottomArea: {
    paddingVertical: 6,
    paddingHorizontal: 35,
    paddingBottom: 30,
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomText: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    color: colors2024['neutral-title-1'],
    fontWeight: '500',
    lineHeight: 24,
  },
}));
