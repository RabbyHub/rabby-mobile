import React, { useMemo } from 'react';
import { PanResponder, Text, View } from 'react-native';

import { createGetStyles } from '@/utils/styles';
import Animated from 'react-native-reanimated';
import { useThemeStyles } from '@/hooks/theme';
import { useAutoLockCountDown } from './LockAbout';
import { colord } from 'colord';
import { NEED_DEVSETTINGBLOCKS } from '@/constant/env';
