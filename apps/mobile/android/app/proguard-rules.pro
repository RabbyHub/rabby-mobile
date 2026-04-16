# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in $ANDROID_HOME/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}
-dontwarn io.branch.**

# # keep screen capture callback
# -keep class android.content.ScreenCaptureCallback { *; }

# react native keychain https://github.com/oblador/react-native-keychain#proguard-rules
-keep class com.facebook.crypto.** {
   *;
}

# Keep SQLite classes
-keep class io.liteglue.** { *; }

# # react-native-svg https://github.com/react-native-svg/react-native-svg#problems-with-proguard
# # https://github.com/software-mansion/react-native-svg/blob/main/android/proguard-rules.pro
# -keep public class com.horcrux.svg.** {*;}

# # react-native-reanimated https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation
# # https://github.com/software-mansion/react-native-reanimated/blob/main/packages/react-native-reanimated/android/proguard-rules.pro
# -keep class com.swmansion.reanimated.** { *; }
# -keep class com.facebook.react.turbomodule.** { *; }

# https://github.com/DylanVann/react-native-fast-image?tab=readme-ov-file#are-you-using-proguard
-keep public class com.dylanvann.fastimage.* {*;}
-keep public class com.dylanvann.fastimage.** {*;}
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep public class * extends com.bumptech.glide.module.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }#

# :react-native-inappbrowser-reborn https://github.com/proyecto26/react-native-inappbrowser/blob/develop/README.md#android
-keepattributes *Annotation*
-keepclassmembers class ** {
  @org.greenrobot.eventbus.Subscribe <methods>;
}
-keep enum org.greenrobot.eventbus.ThreadMode { *; }

# kotlin

-keep class kotlin.** { *; }

-keep class kotlin.Metadata { *; }

