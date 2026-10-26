---
name: go-rabby-io-well-known
description: Maintain Rabby Go well-known files and deployment routing. Use when updating go.rabby.io, go-regression.rabby.io, or go-debug.rabby.io .well-known/apple-app-site-association or .well-known/assetlinks.json files, Universal Links, Android App Links, app package IDs, team IDs, certificate fingerprints, or the Rabby Go static-site deployment workflow.
---

# Rabby Go Well-Known

## Boundary

The Rabby Go static site is maintained in the standalone repository:

```text
https://github.com/RabbyHub/go.rabby.io
```

This rabby-mobile repository should keep only the native app configuration that
consumes those links, such as Associated Domains, Android intent filters, and
deep-link handling code. Do not reintroduce `apps/go.rabby.io` or publish Rabby
Go `.well-known` files from rabby-mobile workflows.

The association files are:

```text
.well-known/apple-app-site-association
.well-known/assetlinks.json
```

Both files must be valid JSON, served directly with HTTP `200`, no redirect,
and `Content-Type: application/json`.

## Targets

`RabbyHub/go.rabby.io` maps deploy targets to S3 roots and public hosts:

| Target | S3 site root | Entry path | Public host |
| --- | --- | --- | --- |
| `regression` | `rabby-go-regression` | `mobile-regression` | `https://go-regression.rabby.io/` |
| `production` | `rabby-go` | `mobile` | `https://go.rabby.io/` |
| `debug` | `rabby-go-debug` | `mobile-debug` | `https://go-debug.rabby.io/` |

The current GitHub Actions workflow is
`.github/workflows/deploy-regression.yml` in `RabbyHub/go.rabby.io`.
Its `workflow_dispatch` input supports `regression` and `production`;
`regression` is the default. The deploy script also supports `debug`, but CI
does not expose debug unless a reviewed workflow change adds it.

## Edit

1. Work in `RabbyHub/go.rabby.io` from an up-to-date `main` branch.

```bash
git fetch origin main
git switch -c chore/update-go-rabby-well-known origin/main
```

2. Edit only the necessary association file(s). Preserve these native contracts
   unless the app configuration is intentionally changing in the same rollout:

- iOS app IDs use team id `ZPNP2SF27Q`.
- iOS paths are `/mobile-debug/*`, `/mobile-regression/*`, and `/mobile/*`.
- Android package names are `com.debank.rabbymobile.debug`,
  `com.debank.rabbymobile.regression`, and `com.debank.rabbymobile`.
- Android fingerprints must come from the actual signing certificate for that
  package/flavor. Do not copy a fingerprint across flavors by assumption.

3. Validate locally before opening a PR:

```bash
python3 -m json.tool .well-known/apple-app-site-association >/dev/null
python3 -m json.tool .well-known/assetlinks.json >/dev/null
corepack yarn install --immutable
corepack yarn check
```

4. Open a PR to `RabbyHub/go.rabby.io:main`. Keep PR text limited to the
   changed app-link contract and validation. Do not include credentials,
   local-only paths, or secret values.

## Deploy

Deploy regression first. Deploy production only after the regression result is
verified and the production rollout is approved.

Regression:

```bash
gh workflow run deploy-regression.yml \
  -R RabbyHub/go.rabby.io \
  --ref main \
  -f target=regression
```

Production:

```bash
gh workflow run deploy-regression.yml \
  -R RabbyHub/go.rabby.io \
  --ref main \
  -f target=production
```

The workflow needs these repository secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
RABBY_MOBILE_BUILD_BUCKET
```

The workflow currently uploads to S3 with `SKIP_CDN_INVALIDATION=true`, so CDN
caches may need time to expire. Do not add cloud credentials to code, workflow
YAML, PR text, logs, or issue comments.

## Verify

After deployment, inspect the workflow run and verify the public files:

```bash
gh run list \
  -R RabbyHub/go.rabby.io \
  --workflow deploy-regression.yml \
  --limit 5

curl -fsS -D /tmp/go-rabby-aasa.headers \
  https://go-regression.rabby.io/.well-known/apple-app-site-association \
  -o /tmp/go-rabby-aasa.json
python3 -m json.tool /tmp/go-rabby-aasa.json >/dev/null

curl -fsS -D /tmp/go-rabby-assetlinks.headers \
  https://go-regression.rabby.io/.well-known/assetlinks.json \
  -o /tmp/go-rabby-assetlinks.json
python3 -m json.tool /tmp/go-rabby-assetlinks.json >/dev/null
```

For production, replace the host with `go.rabby.io`. Confirm the response is
`200`, not `3xx` or cached `403`, and that the content type is JSON.

If the public URL appears stale, distinguish S3 freshness from CDN cache before
changing code. With an authorized shell that already has AWS credentials:

```bash
aws s3api head-object \
  --bucket "$RABBY_MOBILE_BUILD_BUCKET" \
  --key "rabby-go-regression/.well-known/apple-app-site-association" \
  --query '[LastModified,ContentType,CacheControl,ContentLength]' \
  --output table

aws s3api head-object \
  --bucket "$RABBY_MOBILE_BUILD_BUCKET" \
  --key "rabby-go-regression/.well-known/assetlinks.json" \
  --query '[LastModified,ContentType,CacheControl,ContentLength]' \
  --output table
```

Use `rabby-go` instead of `rabby-go-regression` for production. If S3 is fresh
but CDN is stale, wait for cache expiry or perform a deliberate CloudFront
invalidation only as an explicit deployment operation.
