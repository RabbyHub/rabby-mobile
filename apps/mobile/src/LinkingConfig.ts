import { getStateFromPath } from '@react-navigation/native';
import { RootNames } from './constant/layout';
import InAppBrowser from 'react-native-inappbrowser-reborn';

/**
 * Learn more about deep linking with React Navigation
 * https://reactnavigation.org/docs/deep-linking
 * https://reactnavigation.org/docs/configuring-links
 */

const getLinkingConfig = () => {
  const screens = {
    [RootNames.StackTransaction]: {
      screens: {
        [RootNames.Buy]: RootNames.Buy.toLowerCase(),
        [RootNames.MultiBuy]: RootNames.MultiBuy.toLowerCase(),
        [RootNames.Send]: 'send',
        [RootNames.SendTo]: 'sendto',
      },
    },
    NotFound: '*',
  };

  return {
    prefixes: ['rabby://', 'rabbymobile://', 'ethereum:'],
    config: {
      screens: screens,
    },

    getStateFromPath: (path: string, options: any) => {
      // Handle ethereum: URIs separately as they don't follow standard navigation paths
      if (path.startsWith('ethereum:')) {
        // Return undefined to let the app handle it through Linking events
        return undefined;
      }

      const newPath = path.replace('mobile-redirect/', '')?.toLowerCase();

      if (
        newPath.startsWith(RootNames.Buy.toLowerCase()) ||
        newPath.startsWith(RootNames.MultiBuy.toLowerCase())
      ) {
        InAppBrowser.close();
      }

      const state = getStateFromPath(newPath, options);

      return state;
    },
  };
};

export default getLinkingConfig;
