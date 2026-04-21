#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import mimetypes
import threading
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
from uuid import uuid4


APP_DIR = Path(__file__).resolve().parent
DATA_FILE = APP_DIR / "data" / "store.json"
WEB_DIR = APP_DIR / "web"
STORE_LOCK = threading.Lock()
ONLINE_WINDOW_SECONDS = 20


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().replace(microsecond=0).isoformat()


def clone_json(value: Any) -> Any:
    return deepcopy(value)


def default_store() -> dict[str, Any]:
    return {
        "updatedAt": now_iso(),
        "devices": [],
    }


def is_online(last_seen_at: str) -> bool:
    try:
        last_seen = datetime.fromisoformat(last_seen_at)
    except ValueError:
        return False

    return now() - last_seen <= timedelta(seconds=ONLINE_WINDOW_SECONDS)


def prune_offline_devices(store: dict[str, Any]) -> dict[str, Any]:
    store["devices"] = [
        device for device in store["devices"] if is_online(device["lastSeenAt"])
    ]
    return store


def load_store_unlocked() -> dict[str, Any]:
    if not DATA_FILE.exists():
        return default_store()

    with DATA_FILE.open("r", encoding="utf-8") as handle:
        raw_store = json.load(handle)

    return prune_offline_devices(normalize_store(raw_store))


def save_store_unlocked(store: dict[str, Any]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    prune_offline_devices(store)
    store["updatedAt"] = now_iso()
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(store, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def with_locked_store(callback):
    with STORE_LOCK:
        store = load_store_unlocked()
        result = callback(store)
        save_store_unlocked(store)
        return result


def normalize_snapshot_by_locale(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, dict[str, Any]] = {}
    for locale, payload in value.items():
        if isinstance(locale, str) and isinstance(payload, dict):
            normalized[locale] = clone_json(payload)
    return normalized


def normalize_patch_entry(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    patch_value = value.get("value")
    if not isinstance(patch_value, str):
        patch_value = str(patch_value or "")

    return {
        "value": patch_value,
        "updatedAt": str(value.get("updatedAt") or now_iso()),
    }


def normalize_patches_by_locale(value: Any) -> dict[str, dict[str, dict[str, Any]]]:
    if not isinstance(value, dict):
        return {}

    normalized: dict[str, dict[str, dict[str, Any]]] = {}
    for locale, locale_patches in value.items():
        if not isinstance(locale, str) or not isinstance(locale_patches, dict):
            continue

        next_locale_patches: dict[str, dict[str, Any]] = {}
        for key, patch_value in locale_patches.items():
            if not isinstance(key, str) or not key.strip():
                continue
            normalized_patch = normalize_patch_entry(patch_value)
            if normalized_patch:
                next_locale_patches[key] = normalized_patch

        if next_locale_patches:
            normalized[locale] = next_locale_patches

    return normalized


def normalize_device(raw_device: Any) -> dict[str, Any] | None:
    if not isinstance(raw_device, dict):
        return None

    device_id = str(raw_device.get("deviceId") or "").strip()
    if not device_id:
        return None

    current_locale = str(raw_device.get("currentLocale") or "").strip()
    snapshot_by_locale = normalize_snapshot_by_locale(raw_device.get("snapshotByLocale"))
    patches_by_locale = normalize_patches_by_locale(raw_device.get("patchesByLocale"))

    return {
        "deviceId": device_id,
        "deviceName": str(raw_device.get("deviceName") or device_id).strip() or device_id,
        "platform": str(raw_device.get("platform") or "react-native").strip()
        or "react-native",
        "namespace": str(raw_device.get("namespace") or "translations").strip()
        or "translations",
        "currentLocale": current_locale,
        "registeredAt": str(raw_device.get("registeredAt") or now_iso()),
        "lastSeenAt": str(raw_device.get("lastSeenAt") or now_iso()),
        "appName": str(raw_device.get("appName") or "RabbyMobile").strip()
        or "RabbyMobile",
        "version": int(raw_device.get("version", 0)),
        "snapshotByLocale": snapshot_by_locale,
        "patchesByLocale": patches_by_locale,
    }


def normalize_store(raw_store: Any) -> dict[str, Any]:
    if not isinstance(raw_store, dict):
        return default_store()

    normalized_devices = []
    for raw_device in raw_store.get("devices", []):
        device = normalize_device(raw_device)
        if device is not None:
            normalized_devices.append(device)

    return {
        "updatedAt": str(raw_store.get("updatedAt") or now_iso()),
        "devices": normalized_devices,
    }


def get_device(store: dict[str, Any], device_id: str) -> dict[str, Any] | None:
    for device in store["devices"]:
        if device["deviceId"] == device_id:
            return device
    return None


def ensure_device(
    store: dict[str, Any],
    device_id: str,
    device_name: str,
    platform: str,
    namespace: str,
    app_name: str,
) -> dict[str, Any]:
    existing = get_device(store, device_id)
    if existing is not None:
        return existing

    device = {
        "deviceId": device_id,
        "deviceName": device_name or device_id,
        "platform": platform or "react-native",
        "namespace": namespace or "translations",
        "currentLocale": "",
        "registeredAt": now_iso(),
        "lastSeenAt": now_iso(),
        "appName": app_name or "RabbyMobile",
        "version": 0,
        "snapshotByLocale": {},
        "patchesByLocale": {},
    }
    store["devices"].append(device)
    return device


def set_deep_value(target: dict[str, Any], dotted_key: str, value: str) -> None:
    parts = dotted_key.split(".")
    cursor = target

    for part in parts[:-1]:
        next_value = cursor.get(part)
        if not isinstance(next_value, dict):
            next_value = {}
            cursor[part] = next_value
        cursor = next_value

    cursor[parts[-1]] = value


def merge_snapshot_with_patches(
    snapshot: dict[str, Any], patches: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    merged = clone_json(snapshot)
    for key, patch in patches.items():
        set_deep_value(merged, key, patch["value"])
    return merged


def list_locales(device: dict[str, Any]) -> list[str]:
    locales = set(device["snapshotByLocale"].keys())
    locales.update(device["patchesByLocale"].keys())
    if device["currentLocale"]:
        locales.add(device["currentLocale"])
    return sorted(locales)


def build_patch_list(device: dict[str, Any]) -> list[dict[str, Any]]:
    payload: list[dict[str, Any]] = []
    for locale, locale_patches in device["patchesByLocale"].items():
        for key, patch in locale_patches.items():
            payload.append(
                {
                    "locale": locale,
                    "key": key,
                    "value": patch["value"],
                    "updatedAt": patch["updatedAt"],
                }
            )
    payload.sort(key=lambda item: (item["locale"], item["key"]))
    return payload


def summarize_device(device: dict[str, Any]) -> dict[str, Any]:
    return {
        "deviceId": device["deviceId"],
        "deviceName": device["deviceName"],
        "platform": device["platform"],
        "appName": device["appName"],
        "namespace": device["namespace"],
        "currentLocale": device["currentLocale"],
        "registeredAt": device["registeredAt"],
        "lastSeenAt": device["lastSeenAt"],
        "isOnline": is_online(device["lastSeenAt"]),
        "localeCount": len(list_locales(device)),
        "patchCount": len(build_patch_list(device)),
        "version": device["version"],
    }


def build_device_detail(device: dict[str, Any]) -> dict[str, Any]:
    merged_by_locale: dict[str, dict[str, Any]] = {}
    for locale in list_locales(device):
        merged_by_locale[locale] = merge_snapshot_with_patches(
            device["snapshotByLocale"].get(locale, {}),
            device["patchesByLocale"].get(locale, {}),
        )

    return {
        "device": summarize_device(device),
        "availableLocales": list_locales(device),
        "snapshotByLocale": clone_json(device["snapshotByLocale"]),
        "patchesByLocale": clone_json(device["patchesByLocale"]),
        "mergedByLocale": merged_by_locale,
        "patches": build_patch_list(device),
    }


def sanitize_snapshot_payload(payload: Any) -> dict[str, dict[str, Any]]:
    return normalize_snapshot_by_locale(payload)


class I18nPreviewHandler(BaseHTTPRequestHandler):
    server_version = "RabbyI18nPreview/0.2"

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        parts = self.path_parts(parsed.path)

        if parts == ["api", "v1", "devices"]:
            self.handle_list_devices()
            return

        if len(parts) == 4 and parts[:3] == ["api", "v1", "devices"]:
            self.handle_get_device(parts[3])
            return

        if len(parts) == 5 and parts[:3] == ["api", "v1", "devices"]:
            device_id = parts[3]
            action = parts[4]
            if action == "commands":
                self.handle_get_commands(device_id, parsed)
                return
            if action == "export":
                self.handle_export_device(device_id, parsed)
                return

        self.serve_static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        parts = self.path_parts(parsed.path)

        if parts == ["api", "v1", "devices", "register"]:
            self.handle_register_device()
            return

        if len(parts) == 5 and parts[:3] == ["api", "v1", "devices"]:
            device_id = parts[3]
            action = parts[4]
            if action == "heartbeat":
                self.handle_heartbeat(device_id)
                return
            if action == "patches":
                self.handle_upsert_patch(device_id)
                return

        self.send_error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        parts = self.path_parts(parsed.path)

        if len(parts) == 5 and parts[:3] == ["api", "v1", "devices"] and parts[4] == "patches":
            self.handle_delete_patch(parts[3], parsed)
            return

        self.send_error_json(HTTPStatus.NOT_FOUND, "unknown endpoint")

    def handle_list_devices(self) -> None:
        with STORE_LOCK:
            store = load_store_unlocked()
            payload = {
                "updatedAt": store["updatedAt"],
                "devices": [summarize_device(device) for device in store["devices"]],
            }
        self.send_json(payload)

    def handle_get_device(self, device_id: str) -> None:
        with STORE_LOCK:
            store = load_store_unlocked()
            device = get_device(store, device_id)
            if device is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
                return
            payload = build_device_detail(device)
        self.send_json(payload)

    def handle_register_device(self) -> None:
        payload = self.read_json_body()
        if payload is None:
            return

        device_id = str(payload.get("deviceId") or uuid4().hex).strip()
        device_name = str(payload.get("deviceName") or device_id).strip() or device_id
        platform = str(payload.get("platform") or "react-native").strip() or "react-native"
        namespace = str(payload.get("namespace") or "translations").strip() or "translations"
        app_name = str(payload.get("appName") or "RabbyMobile").strip() or "RabbyMobile"
        current_locale = str(payload.get("currentLocale") or "").strip()
        snapshot_by_locale = sanitize_snapshot_payload(payload.get("snapshotByLocale"))

        def update(store: dict[str, Any]) -> dict[str, Any]:
            device = ensure_device(store, device_id, device_name, platform, namespace, app_name)
            device["deviceName"] = device_name
            device["platform"] = platform
            device["namespace"] = namespace
            device["appName"] = app_name
            device["currentLocale"] = current_locale
            device["lastSeenAt"] = now_iso()
            if snapshot_by_locale:
                device["snapshotByLocale"] = snapshot_by_locale
            return {
                "deviceId": device["deviceId"],
                "version": device["version"],
                "patches": build_patch_list(device),
                "availableLocales": list_locales(device),
            }

        self.send_json(with_locked_store(update))

    def handle_heartbeat(self, device_id: str) -> None:
        payload = self.read_json_body()
        if payload is None:
            return

        current_locale = str(payload.get("currentLocale") or "").strip()
        new_locales = sanitize_snapshot_payload(payload.get("newSnapshotByLocale"))

        def update(store: dict[str, Any]) -> dict[str, Any]:
            device = get_device(store, device_id)
            if device is None:
                raise KeyError("device not found")

            device["lastSeenAt"] = now_iso()
            if current_locale:
                device["currentLocale"] = current_locale
            for locale, locale_snapshot in new_locales.items():
                if locale not in device["snapshotByLocale"]:
                    device["snapshotByLocale"][locale] = locale_snapshot
            return {
                "deviceId": device["deviceId"],
                "version": device["version"],
                "availableLocales": list_locales(device),
            }

        try:
            response = with_locked_store(update)
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
            return

        self.send_json(response)

    def handle_get_commands(self, device_id: str, parsed) -> None:
        query = parse_qs(parsed.query)
        since = int(query.get("since", ["0"])[0] or "0")

        with STORE_LOCK:
            store = load_store_unlocked()
            device = get_device(store, device_id)
            if device is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
                return

            if since >= device["version"]:
                self.send_response(HTTPStatus.NOT_MODIFIED)
                self.send_cors_headers()
                self.end_headers()
                return

            payload = {
                "deviceId": device["deviceId"],
                "version": device["version"],
                "patches": build_patch_list(device),
            }

        self.send_json(payload)

    def handle_upsert_patch(self, device_id: str) -> None:
        payload = self.read_json_body()
        if payload is None:
            return

        locale = str(payload.get("locale") or "").strip()
        key = str(payload.get("key") or "").strip()
        value = payload.get("value")

        if not locale or not key or not isinstance(value, str):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "`locale`, `key`, and string `value` are required",
            )
            return

        def update(store: dict[str, Any]) -> dict[str, Any]:
            device = get_device(store, device_id)
            if device is None:
                raise KeyError("device not found")

            locale_patches = device["patchesByLocale"].setdefault(locale, {})
            locale_patches[key] = {
                "value": value,
                "updatedAt": now_iso(),
            }
            device["version"] += 1
            device["lastSeenAt"] = now_iso()
            return build_device_detail(device)

        try:
            response = with_locked_store(update)
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
            return

        self.send_json(response)

    def handle_delete_patch(self, device_id: str, parsed) -> None:
        query = parse_qs(parsed.query)
        locale = str(query.get("locale", [""])[0]).strip()
        key = str(query.get("key", [""])[0]).strip()

        if not locale or not key:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "`locale` and `key` query params are required",
            )
            return

        def update(store: dict[str, Any]) -> dict[str, Any]:
            device = get_device(store, device_id)
            if device is None:
                raise KeyError("device not found")

            locale_patches = device["patchesByLocale"].get(locale, {})
            if key in locale_patches:
                del locale_patches[key]
                if not locale_patches:
                    device["patchesByLocale"].pop(locale, None)
                device["version"] += 1
            return build_device_detail(device)

        try:
            response = with_locked_store(update)
        except KeyError:
            self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
            return

        self.send_json(response)

    def handle_export_device(self, device_id: str, parsed) -> None:
        query = parse_qs(parsed.query)
        requested_locale = str(query.get("locale", [""])[0]).strip()

        with STORE_LOCK:
            store = load_store_unlocked()
            device = get_device(store, device_id)
            if device is None:
                self.send_error_json(HTTPStatus.NOT_FOUND, "device not found")
                return

            locale = requested_locale or device["currentLocale"]
            if not locale:
                locales = list_locales(device)
                locale = locales[0] if locales else ""

            merged = merge_snapshot_with_patches(
                device["snapshotByLocale"].get(locale, {}),
                device["patchesByLocale"].get(locale, {}),
            )

        filename = f"{device_id}-{locale or 'unknown'}-patched.json"
        body = json.dumps(merged, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, raw_path: str) -> None:
        relative_path = raw_path.lstrip("/") or "index.html"
        target = (WEB_DIR / relative_path).resolve()

        if WEB_DIR not in target.parents and target != WEB_DIR:
            self.send_error_json(HTTPStatus.FORBIDDEN, "forbidden")
            return

        if target.is_dir():
            target = target / "index.html"

        if not target.exists():
            self.send_error_json(HTTPStatus.NOT_FOUND, "file not found")
            return

        content_type, _ = mimetypes.guess_type(str(target))
        body = target.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_cors_headers()
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self) -> dict[str, Any] | None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)

        try:
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self.send_error_json(HTTPStatus.BAD_REQUEST, "invalid json body")
            return None

        if not isinstance(payload, dict):
            self.send_error_json(HTTPStatus.BAD_REQUEST, "json body must be an object")
            return None

        return payload

    def send_json(self, payload: dict[str, Any], status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status: int, message: str) -> None:
        self.send_json({"error": message}, status=status)

    def send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Credentials", "false")
        self.send_header("Cache-Control", "no-store")

    def path_parts(self, raw_path: str) -> list[str]:
        return [unquote(part) for part in raw_path.split("/") if part]

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{now_iso()}] {self.address_string()} {format % args}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Serve the i18n live preview device registry and operator UI."
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", default=8765, type=int)
    args = parser.parse_args()

    with STORE_LOCK:
        save_store_unlocked(load_store_unlocked())

    server = ThreadingHTTPServer((args.host, args.port), I18nPreviewHandler)
    print(f"Serving i18n preview console at http://{args.host}:{args.port}")
    print(f"Device API root: http://{args.host}:{args.port}/api/v1/devices")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
