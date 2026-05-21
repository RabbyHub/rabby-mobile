package com.rabbywallet.keychain9

import android.os.SystemClock
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

object RabbyNativeLogger {
  const val EVENT_NAME = "RabbyNativeLog"

  private const val LOG_TAG = "RabbyNativeLogger"

  fun debug(
      reactContext: ReactApplicationContext,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?> = emptyMap()
  ) {
    log(Log.DEBUG, "debug", reactContext, moduleName, tag, event, data, null)
  }

  fun info(
      reactContext: ReactApplicationContext,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?> = emptyMap()
  ) {
    log(Log.INFO, "info", reactContext, moduleName, tag, event, data, null)
  }

  fun warn(
      reactContext: ReactApplicationContext,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?> = emptyMap(),
      error: Throwable? = null
  ) {
    log(Log.WARN, "warn", reactContext, moduleName, tag, event, data, error)
  }

  fun error(
      reactContext: ReactApplicationContext,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?> = emptyMap(),
      error: Throwable? = null
  ) {
    log(Log.ERROR, "error", reactContext, moduleName, tag, event, data, error)
  }

  private fun log(
      priority: Int,
      level: String,
      reactContext: ReactApplicationContext,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?>,
      error: Throwable?
  ) {
    val message = "[$tag] $event ${data.filterValues { it != null }}"
    if (error != null) {
      Log.println(priority, LOG_TAG, message)
      Log.println(priority, LOG_TAG, Log.getStackTraceString(error))
    } else {
      Log.println(priority, LOG_TAG, message)
    }

    emit(reactContext, level, moduleName, tag, event, data)
  }

  private fun emit(
      reactContext: ReactApplicationContext,
      level: String,
      moduleName: String,
      tag: String,
      event: String,
      data: Map<String, Any?>
  ) {
    try {
      if (!reactContext.hasActiveCatalystInstance()) {
        return
      }

      val payload = Arguments.createMap()
      payload.putString("level", level)
      payload.putString("module", moduleName)
      payload.putString("tag", tag)
      payload.putString("event", event)
      payload.putString("thread", Thread.currentThread().name)
      payload.putDouble("timestampMs", System.currentTimeMillis().toDouble())
      payload.putDouble("elapsedRealtimeMs", SystemClock.elapsedRealtime().toDouble())
      payload.putMap("data", toWritableMap(data))

      reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, payload)
    } catch (fail: Throwable) {
      Log.d(LOG_TAG, "Failed to emit native log event: ${fail.message}", fail)
    }
  }

  private fun toWritableMap(data: Map<String, Any?>): WritableMap {
    val map = Arguments.createMap()
    data.forEach { (key, value) -> putValue(map, key, value) }
    return map
  }

  private fun putValue(map: WritableMap, key: String, value: Any?) {
    when (value) {
      null -> map.putNull(key)
      is Boolean -> map.putBoolean(key, value)
      is Int -> map.putInt(key, value)
      is Short -> map.putInt(key, value.toInt())
      is Byte -> map.putInt(key, value.toInt())
      is Long -> map.putDouble(key, value.toDouble())
      is Float -> map.putDouble(key, value.toDouble())
      is Double -> map.putDouble(key, value)
      is String -> map.putString(key, value)
      is CharSequence -> map.putString(key, value.toString())
      else -> map.putString(key, value.toString())
    }
  }
}
