package com.debank.rabbymobile

import android.content.Context
import android.os.Process
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import org.json.JSONArray
import org.json.JSONObject

/**
 * Regression/debug-only evidence collection for a MMKV file that can be
 * normalized away as soon as React Native opens it. This runs after
 * Application.super.onCreate(), but before loadReactNative(), so no JavaScript
 * MMKV instance has been created by this process yet.
 */
object KeyringStorageStartupDiagnostics {
  private const val TAG = "RabbyKeyringDiagnostic"
  private const val ROOT_DIRECTORY = "keyring-startup-diagnostics"
  private const val SNAPSHOTS_DIRECTORY = "snapshots"
  private const val MAX_SNAPSHOT_COUNT = 6
  private val KEYRING_FILE_NAMES = arrayOf("mmkv.keyring", "mmkv.keyring.crc")

  fun capture(context: Context) {
    if (!RabbyStartupTrace.isEnabled()) {
      return
    }

    RabbyStartupTrace.beginSection("KeyringDiagnostics.capture")
    try {
      val diagnosticsRoot = File(context.filesDir, ROOT_DIRECTORY)
      val snapshotsRoot = File(diagnosticsRoot, SNAPSHOTS_DIRECTORY)
      if (!snapshotsRoot.exists() && !snapshotsRoot.mkdirs()) {
        Log.w(TAG, "capture skipped: unable to create diagnostics directory")
        return
      }

      val capturedAtMillis = System.currentTimeMillis()
      val captureId = "launch-$capturedAtMillis-${Process.myPid()}"
      val captureDirectory = File(snapshotsRoot, captureId)
      if (!captureDirectory.mkdirs()) {
        Log.w(TAG, "capture skipped: unable to create snapshot directory")
        return
      }

      val snapshot = JSONObject()
        .put("schemaVersion", 1)
        .put("captureId", captureId)
        .put("capturedAtMillis", capturedAtMillis)
        .put("applicationId", BuildConfig.APPLICATION_ID)
        .put("buildType", BuildConfig.BUILD_TYPE)
        .put("processId", Process.myPid())
        .put("capturePoint", "application.onCreate.before-loadReactNative")
      val files = JSONArray()
      var copiedCount = 0
      var errorCount = 0

      for (fileName in KEYRING_FILE_NAMES) {
        val source = File(File(context.filesDir, "mmkv"), fileName)
        val target = File(captureDirectory, fileName)
        val fileSnapshot = JSONObject()
          .put("name", fileName)
          .put("sourcePresent", source.isFile)
          .put("sourceByteLength", if (source.isFile) source.length() else JSONObject.NULL)
          .put("sourceLastModifiedMillis", if (source.isFile) source.lastModified() else JSONObject.NULL)

        if (!source.isFile) {
          fileSnapshot.put("copyStatus", "missing")
          files.put(fileSnapshot)
          continue
        }

        try {
          copyFile(source, target)
          copiedCount += 1
          fileSnapshot
            .put("copyStatus", "copied")
            .put("snapshotByteLength", target.length())
            .put("snapshotLastModifiedMillis", target.lastModified())
        } catch (error: Throwable) {
          errorCount += 1
          fileSnapshot
            .put("copyStatus", "error")
            .put("errorType", error.javaClass.simpleName)
        }

        files.put(fileSnapshot)
      }

      snapshot
        .put("files", files)
        .put("copiedFileCount", copiedCount)
        .put("errorCount", errorCount)
        .put("status", if (errorCount == 0) "complete" else "partial")

      writeJsonAtomically(File(captureDirectory, "metadata.json"), snapshot)
      appendIndexEntry(File(diagnosticsRoot, "index.jsonl"), snapshot)
      retainNewestSnapshots(snapshotsRoot, captureDirectory)

      Log.i(
        TAG,
        "pre-RN capture id=$captureId copied=$copiedCount errors=$errorCount",
      )
      RabbyStartupTrace.instant("KeyringDiagnostics.capture.complete")
    } catch (error: Throwable) {
      Log.w(TAG, "pre-RN capture failed: ${error.javaClass.simpleName}")
      RabbyStartupTrace.instant("KeyringDiagnostics.capture.error")
    } finally {
      RabbyStartupTrace.endSection()
    }
  }

  private fun copyFile(source: File, target: File) {
    FileInputStream(source).channel.use { input ->
      FileOutputStream(target).channel.use { output ->
        var position = 0L
        val size = input.size()
        while (position < size) {
          val transferred = input.transferTo(position, size - position, output)
          if (transferred <= 0) {
            throw IllegalStateException("Unable to complete diagnostic file copy")
          }
          position += transferred
        }
      }
    }
  }

  private fun writeJsonAtomically(target: File, payload: JSONObject) {
    val temp = File(target.parentFile, "${target.name}.tmp")
    FileOutputStream(temp).use { output ->
      output.write(payload.toString().toByteArray(Charsets.UTF_8))
    }

    if (!temp.renameTo(target)) {
      temp.delete()
      throw IllegalStateException("Unable to publish diagnostic metadata")
    }
  }

  private fun appendIndexEntry(index: File, payload: JSONObject) {
    FileOutputStream(index, true).use { output ->
      output.write((payload.toString() + "\n").toByteArray(Charsets.UTF_8))
    }
  }

  private fun retainNewestSnapshots(snapshotsRoot: File, current: File) {
    val snapshots = snapshotsRoot.listFiles()
      ?.filter { it.isDirectory && it.name.startsWith("launch-") }
      ?.sortedBy { it.lastModified() }
      ?: return
    val removableCount = (snapshots.size - MAX_SNAPSHOT_COUNT).coerceAtLeast(0)

    snapshots
      .filter { it != current }
      .take(removableCount)
      .forEach(::deleteRecursively)
  }

  private fun deleteRecursively(file: File) {
    if (file.isDirectory) {
      file.listFiles()?.forEach(::deleteRecursively)
    }
    file.delete()
  }
}
