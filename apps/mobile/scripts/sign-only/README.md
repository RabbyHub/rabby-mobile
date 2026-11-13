# Sign-only packages

Build an unsigned package locally, upload it to the fe-opcode artifact
broker, then let the **sign-only workflow in `RabbyHub/rabby-ci`**
(`rabby-mobile-sign-only.yml`) perform only the signing, CDN publish and
optional Lark notification.

The signing workflow is not part of this repository any more: it lives in the
private `rabby-ci` repo together with the other packaging lanes. This repo still
owns the build/sign helper scripts, because the private workflow checks them out
from here.

## Android

```bash
bash scripts/sign-only/build-unsigned-android.sh
```

Output: `.sign-only/app-signonly-unsigned.apk`.

## iOS

Install Pods first if `ios/Pods` is missing:

```bash
yarn ios:installpod
bash scripts/sign-only/build-unsigned-ios.sh
```

Output: `.sign-only/RabbyMobile.xcarchive.zip`.

## Upload and trigger

The upload endpoint needs a fe-opcode JWT. The dashboard stores one in
`localStorage` after login; the JWT login tab can also produce one. Keep it in
an ignored local environment variable rather than command history.

```bash
export OPFE_SIGN_ONLY_SERVICE_URL=https://rabby-fe-opcode-service.dbkops.com
export OPFE_SIGN_ONLY_TOKEN='<fe-opcode JWT>'

node scripts/sign-only/publish.mjs \
  --platform android \
  --file .sign-only/app-signonly-unsigned.apk \
  --source-sha "$(git rev-parse HEAD)" \
  --prepare
```

The command prints a `gh workflow run ...` command. Run that command yourself
with your own GitHub identity; fe-opcode does not store a GitHub token or
trigger workflows on your behalf. Add `--notify-lark` to generate inputs that
push the signed package to the CI/CD Lark group after signing. Without it, the
package is signed and published to the regression CDN but no Lark message is
sent.

The prepare response suggests `--ref 'develop'`, because that is where the
`rabby-mobile` scripts are read from. The dispatch itself happens on the
rabby-ci side, so the branch you pass selects the **mobile code/scripts**, not
the workflow file:

```bash
node scripts/sign-only/publish.mjs \
  --platform ios \
  --file .sign-only/RabbyMobile.xcarchive.zip \
  --prepare --workflow-ref tmp/20261112
```

The printed command and the `--json` payload's `workflow.ref` then point at
that branch. (The GitHub form cannot prefill inputs, so prefer the prepared
command over typing into the workflow page.)

The workflow only downloads from the sign-only broker path for the same sign
request, requires the SHA-256 passed to the workflow to match the downloaded
artifact, and refuses packages marked as built from a dirty source tree. The
dirty flag is best-effort build metadata, not an attestation: `publish.mjs`
always reports the real `git status` result, so only trigger signing from
reviewed commits.

The same flow is available from the `仅签名打包` page in the fe-opcode
dashboard, including the Lark notification toggle.

## Requirements

`OPFE_SIGN_ONLY_TOKEN` (or `~/.config/opfe/sign-only-token`), plus an
authenticated `gh` if you run the prepared command yourself.

The signing jobs pick their machines from the workflow defaults: iOS signs on
the LAN Mac mini (`mobile-local`), Android on the Linux builder (`mobile`).
Both fall back to the JDK 17 / Android SDK that is already installed if the
downloads stall.

## Signing controls

Who can dispatch this workflow is governed by repository write access; restrict
it to the trusted release group. The Android credential must be a dedicated
regression keystore that is never shared with the Play upload or store key. The
signing jobs run on shared self-hosted runners with a warm workspace; prefer
moving them to an isolated runner if the machine is also used for untrusted
feature-test builds.

## Runner keychain

The iOS job does not depend on the operator's login keychain. It creates a
per-run keychain under `$RUNNER_TEMP`, imports the `match` certificate into it,
sets the key partition list, and removes stale same-name provisioning profiles
from both `~/Library/MobileDevice/Provisioning Profiles` and Xcode's
`~/Library/Developer/Xcode/UserData/Provisioning Profiles` cache. The login
keychain is hidden from codesign for the job and the original search list is
restored afterwards. `macos_machine_location` selects `mobile-local` (default)
or `mobile`.

## Artifact download proxy

The download step honors the `SIGN_ONLY_DOWNLOAD_PROXY` repository variable or
the ambient `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` environment. It forces
HTTP/1.1 and retries transient failures; use this on machines where a direct
connection to `download.rabby.io` is slow or drops HTTP/2 streams.

## Upload through a proxy

`publish.mjs` PUTs the artifact directly to a presigned S3 URL. When the direct
cross-border upload is too slow, route only that upload through an HTTP proxy:

```bash
node apps/mobile/scripts/sign-only/publish.mjs \
  --platform android \
  --file .sign-only/app-signonly-unsigned.apk \
  --prepare --proxy http://127.0.0.1:7890
```

`OPFE_SIGN_ONLY_PROXY` works as the environment-variable equivalent. The proxy
must accept HTTP `CONNECT`; credentials in the URL are supported.

Run the proxy upload test with:

```bash
yarn sign-only:test
```
