import { Linking, Alert } from 'react-native';

export async function openExternalUrl(url: string) {
  const supported = await Linking.canOpenURL(url);

  const result = {
    couldOpen: true,
  };

  if (supported) {
    // Opening the link with some app, if the URL scheme is "http" the web link should be opened
    // by some browser in the mobile
    await Linking.openURL(url);

    result.couldOpen = true;
  } else {
    Alert.alert(`Don't know how to open this URL: ${url}`);

    result.couldOpen = false;
  }

  return result;
}
