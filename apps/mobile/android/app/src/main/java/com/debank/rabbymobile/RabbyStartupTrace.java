package com.debank.rabbymobile;

import android.os.Build;
import android.os.Trace;

public final class RabbyStartupTrace {
  private static final String PRODUCTION_APPLICATION_ID = "com.debank.rabbymobile";
  private static final String PREFIX = "Rabby:";
  private static final int MAX_SECTION_NAME_LENGTH = 120;

  private RabbyStartupTrace() {}

  public static boolean isEnabled() {
    return BuildConfig.DEBUG || !PRODUCTION_APPLICATION_ID.equals(BuildConfig.APPLICATION_ID);
  }

  public static void beginSection(String name) {
    if (!isEnabled()) {
      return;
    }

    Trace.beginSection(formatName(name));
  }

  public static void endSection() {
    if (!isEnabled()) {
      return;
    }

    try {
      Trace.endSection();
    } catch (Throwable ignored) {
      // Keep trace helpers diagnostic-only.
    }
  }

  public static void instant(String name) {
    if (!isEnabled()) {
      return;
    }

    beginSection(name);
    endSection();
  }

  public static void beginAsyncSection(String name, int cookie) {
    if (!isEnabled() || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return;
    }

    Trace.beginAsyncSection(formatName(name), cookie);
  }

  public static void endAsyncSection(String name, int cookie) {
    if (!isEnabled() || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return;
    }

    Trace.endAsyncSection(formatName(name), cookie);
  }

  public static void counter(String name, int value) {
    if (!isEnabled() || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return;
    }

    Trace.setCounter(formatName(name), value);
  }

  private static String formatName(String rawName) {
    String name = rawName == null || rawName.length() == 0 ? "unknown" : rawName;
    String normalized = name.startsWith(PREFIX) ? name : PREFIX + name;
    normalized = normalized.replace('\n', ' ').replace('\r', ' ');

    if (normalized.length() <= MAX_SECTION_NAME_LENGTH) {
      return normalized;
    }

    return normalized.substring(0, MAX_SECTION_NAME_LENGTH);
  }
}
