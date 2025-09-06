package com.debank.rabbymobile;

import android.os.Process;

public class RNHelpersImpl {
  public static final String NAME = "RNHelpers";

  public static void forceExitApp() {
    Process.killProcess(Process.myPid());
  }
}
