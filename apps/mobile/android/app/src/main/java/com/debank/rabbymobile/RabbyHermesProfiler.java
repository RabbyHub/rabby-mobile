package com.debank.rabbymobile;

import androidx.annotation.Keep;

/** Direct stop for the diagnostic profiler; RN 0.81.6's Java disable is misbound. */
@Keep
final class RabbyHermesProfiler {
  private RabbyHermesProfiler() {}

  static synchronized boolean stopSampling() {
    if (!BuildConfig.IS_HERMES_ENABLED) {
      return false;
    }
    System.loadLibrary("rabby_hermes_profiler");
    stopSamplingNative();
    return true;
  }

  private static native void stopSamplingNative();
}
