import { Linking, Alert } from 'react-native';

export async function openExternalUrl(url: string) {
  const supported = await Linking.canOpenURL(url);

  const result = {
    couldOpen: supported,
    maybeOpened: false,
  };

  try {
    // we always try to open the URL, even if it's not supported
    await Linking.openURL(url);
    result.maybeOpened = true;
  } catch (err) {
    result.maybeOpened = false;
    if (!supported) {
      Alert.alert(`Don't know how to open this URL: ${url}`);
    } else {
      Alert.alert(`Can't open this URL: ${url}`);
    }
  }

  return result;
}
