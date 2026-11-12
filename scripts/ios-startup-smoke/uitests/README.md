# Installed-app startup check

This is a standalone XCUITest runner, with **no application target** and no
CocoaPods/JavaScript dependencies. It launches an already-installed simulator
`com.debank.rabby-mobile-regression` application normally. It does not change
startup code, import a wallet, enable test-only app state, or inject a deep link.

The runner checks two cold starts. Each must reach the actual onboarding action
`e2e.onboarding.welcome.import-existing`, enabled and hittable, then remain in the
foreground with that action visible for at least 10 seconds. This existing ID is
available in regression builds without enabling the lifecycle-E2E switch.
Use a fresh dedicated simulator: existing wallet state is deliberately not reset
or accepted as a substitute for the onboarding assertion.

Example (paths and device UUID are supplied by the caller):

```sh
DEVELOPER_DIR=/Applications/Xcode-26.3.app/Contents/Developer \
  xcodebuild build-for-testing \
  -project scripts/ios-startup-smoke/uitests/StartupSmoke.xcodeproj \
  -scheme StartupSmoke -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$runner_derived_data" ARCHS=arm64 CODE_SIGNING_ALLOWED=NO

DEVELOPER_DIR=/Applications/Xcode-26.3.app/Contents/Developer \
  xcodebuild test-without-building -xctestrun "$test_run_file" \
  -destination "platform=iOS Simulator,id=$simulator_udid,arch=arm64" \
  -resultBundlePath "$result_bundle" -parallel-testing-enabled NO \
  -test-timeouts-enabled YES -default-test-execution-time-allowance 240 \
  -maximum-test-execution-time-allowance 240
```

`test_run_file` is the single generated `.xctestrun` under
`$runner_derived_data/Build/Products`. Its filename includes the SDK version;
do not hardcode that version. Keep the `.xctestrun` beside its generated product
directories if transporting the runner. Pin `DEVELOPER_DIR` per command and use
separate runner DerivedData for each Xcode version. Do not assume a runner or
`.xctestrun` produced by one Xcode works with another Xcode. The application under
test must stay unchanged across the OS matrix, even when runner toolchains differ.

Screenshot attachments are kept on success and failure, including teardown.
The caller should retain the `.xcresult`, capture simulator crash/system logs,
and impose an outer process deadline as well. Runner launch/runtime failures are
infrastructure failures, not a successful application startup. A simulator pass
does not cover device signing, App Store packaging, or all business scenarios.
