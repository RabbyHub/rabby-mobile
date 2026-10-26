package com.zoontek.rnbootsplash

import android.app.Activity
import androidx.annotation.LayoutRes
import androidx.annotation.StyleRes

object RNBootSplash {

  @JvmStatic
  fun init(activity: Activity, @StyleRes themeResId: Int) {
    RNBootSplashModuleImpl.init(activity, themeResId)
  }

  @JvmStatic
  fun init(
    activity: Activity,
    @StyleRes themeResId: Int,
    @LayoutRes layoutResId: Int,
  ) {
    RNBootSplashModuleImpl.init(activity, themeResId, layoutResId)
  }
}
