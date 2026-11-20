import 'react-native';

type BorderCurve = 'circular' | 'continuous';

// Image views honor `borderCurve` on iOS just like plain views do; only their
// style typings are missing it.
declare module 'react-native' {
  interface ImageStyle {
    borderCurve?: BorderCurve | undefined;
  }
}

declare module 'react-native-fast-image' {
  interface ImageStyle {
    borderCurve?: BorderCurve | undefined;
  }
}
