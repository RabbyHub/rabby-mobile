# Release stages

The packaging pipeline is split into four explicit stages. Each stage is a
command, not a mode flag, so a failed stage can be retried without repeating the
others.

| Stage   | Command                                                                                | Notes                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| build   | `scripts/unsigned/build-{android,ios}.sh` (non-prod) or the prod path of `deploy-*.sh` | prod: one pass, no parallel compile, no cache, Sentry uploads during the build. non-prod: unsigned artifact + `attest.json` |
| sign    | `scripts/unsigned/sign-android.sh`, iOS export                                         | consumes the attestation, never builds; credentials come from the packager's environment                                    |
| publish | `deploy-*.sh` publish half (S3/CDN, Play/ASC)                                          | non-prod: `--sentry` uploads symbols from the built artifact                                                                |
| notify  | `scripts/release/notify.sh`                                                            | repeatable on its own: the same package can be announced again                                                              |

## Sentry policy

| Lane                   | Build time                                                              | Publish time                  |
| ---------------------- | ----------------------------------------------------------------------- | ----------------------------- |
| prod                   | uploads (default; the scripts refuse `SENTRY_DISABLE_AUTO_UPLOAD=true`) | —                             |
| unsigned / verify      | disabled                                                                | only when publish asks for it |
| regression / sign-only | disabled                                                                | optional                      |

## Caching and parallelism

Only non-prod lanes may use them:

- native build and Metro bundle may run in parallel;
- native compilation output may come from a content-addressed cache.

A cache hit is only trusted when the stored manifest matches every restored
file, and a periodic clean-build-vs-cache-hit comparison must still produce a
byte-identical artifact. Prod never uses either optimisation.
