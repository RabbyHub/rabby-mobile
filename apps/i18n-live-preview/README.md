# i18n Live Preview

This tool now works around live devices instead of a single global rule list.

## Flow

1. The Metro-injected runtime registers a device on startup.
2. It uploads the current in-memory i18n JSON snapshot it already has.
3. Product opens the web console and picks one online device.
4. Product searches keys by key or by current text value.
5. Product edits one key and saves a patch.
6. The server stores that patch and the device polls for it.
7. The device applies the patch to its i18next store immediately.
8. Product can export the merged JSON for the selected device and locale.

## Run the service

```bash
python3 apps/i18n-live-preview/server.py --host 0.0.0.0 --port 8765
```

Open `http://127.0.0.1:8765`.

## Enable the mobile runtime

The existing env var still works. If it points to `/api/v1/rules`, the runtime
will normalize it to `/api/v1`.

```bash
cd apps/mobile
I18N_LIVE_PREVIEW=1 \
I18N_LIVE_PREVIEW_URL=http://127.0.0.1:8765/api/v1/rules \
yarn start:dev
```

## Main endpoints

- `GET /api/v1/devices`
- `POST /api/v1/devices/register`
- `POST /api/v1/devices/:deviceId/heartbeat`
- `GET /api/v1/devices/:deviceId`
- `GET /api/v1/devices/:deviceId/commands?since=<version>`
- `POST /api/v1/devices/:deviceId/patches`
- `DELETE /api/v1/devices/:deviceId/patches?locale=<locale>&key=<key>`
- `GET /api/v1/devices/:deviceId/export?locale=<locale>`
