## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios adhoc

```sh
[bundle exec] fastlane ios adhoc
```

Release for the iOS adhoc

### ios hashcheck

```sh
[bundle exec] fastlane ios hashcheck
```

Valid ios adhoc

### ios appstore

```sh
[bundle exec] fastlane ios appstore
```

Release for the iOS production

---

## Android

### android hashcheck

```sh
[bundle exec] fastlane android hashcheck
```

Valid android adhoc

### android selfhost

```sh
[bundle exec] fastlane android selfhost
```

Release for the Android selfhost

### android playstore

```sh
[bundle exec] fastlane android playstore
```

Release for the Android playstore

---

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
