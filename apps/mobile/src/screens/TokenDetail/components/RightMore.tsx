import { useTheme2024 } from '@/hooks/theme';
import React, { useCallback, useEffect, useMemo } from 'react';
import { TouchableOpacity } from 'react-native';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { RcIconMore } from '@/assets/icons/home';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';
import { ITokenItem } from '@/store/tokens';

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};
export const RightMore: React.FC<{
  token: ITokenItem;
  isMultiAddress?: boolean;
  triggerUpdate: () => void;
  refreshTags: () => void;
  unHold?: boolean;
}> = ({ token, refreshTags, unHold }) => {
  const { colors2024 } = useTheme2024();

  const {
    removePinedToken,
    pinToken,
    userTokenSettings,
    fetchUserTokenSettings,
  } = useUserTokenSettings();

  useEffect(() => {
    fetchUserTokenSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPined = useMemo(
    () =>
      userTokenSettings?.pinedQueue?.some(
        pinned => pinned.chainId === token.chain && pinned.tokenId === token.id,
      ),
    [token.id, token.chain, userTokenSettings?.pinedQueue],
  );

  const handlePress = useCallback(() => {
    if (isPined) {
      removePinedToken({
        id: token.id,
        chain: token.chain,
      });
    } else {
      pinToken({
        id: token.id,
        chain: token.chain,
      });
    }
    setTimeout(() => {
      refreshTags();
    }, 0);
  }, [isPined, pinToken, refreshTags, removePinedToken, token.id, token.chain]);

  return (
    <>
      <TouchableOpacity style={{ marginRight: 18 }} onPress={handlePress}>
        <RcIconFavorite
          width={22}
          height={21}
          color={
            isPined ? colors2024['orange-default'] : colors2024['neutral-info']
          }
        />
      </TouchableOpacity>
      {!unHold && (
        <CustomTouchableOpacity hitSlop={hitSlop}>
          <RcIconMore width={24} height={24} />
        </CustomTouchableOpacity>
      )}
    </>
  );
};
