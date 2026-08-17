package com.rabbywallet.nativeopenapi

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.rabbywallet.nativehttp.RabbyNativeHttpRuntime
import java.nio.ByteBuffer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/** Native-only OpenAPI runtime. JS receives only the fixed diagnostic result. */
object RabbyNativeOpenApiRuntime {
  private const val PREFERENCES_NAME = "rabby_native_openapi"
  private const val API_KEY = "api_key"
  private const val API_TIME = "api_time"

  private val nextDiagnosticId = AtomicLong(1)
  private val diagnosticCallbacks =
    ConcurrentHashMap<Long, NativeOpenApiDiagnosticCallback>()
  private val nextTokenSyncId = AtomicLong(1)
  private val tokenSyncCallbacks =
    ConcurrentHashMap<Long, NativeTokenSyncCallback>()
  private val nextAddressAssetSyncId = AtomicLong(1)
  private val addressAssetSyncCallbacks =
    ConcurrentHashMap<Long, NativeAddressAssetSyncCallback>()
  private val storageDiagnosticExecutor = Executors.newSingleThreadExecutor {
    runnable -> Thread(runnable, "rabby-native-token-cache-diagnostic")
  }
  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var preferences: SharedPreferences? = null

  @Volatile
  private var applicationContext: Context? = null

  init {
    RabbyNativeHttpRuntime.ensureInitialized()
    System.loadLibrary("rabbynativeopenapi")
  }

  @JvmStatic
  fun initialize(context: Context) {
    if (preferences != null) {
      return
    }
    synchronized(this) {
      if (preferences == null) {
        val appContext = context.applicationContext
        applicationContext = appContext
        preferences = appContext.getSharedPreferences(
          PREFERENCES_NAME,
          Context.MODE_PRIVATE,
        )
      }
    }
  }

  @JvmStatic
  fun loadCredential(): Array<String>? {
    val store = requireNotNull(preferences) {
      "RabbyNativeOpenApiRuntime is not initialized"
    }
    val hasKey = store.contains(API_KEY)
    val hasTime = store.contains(API_TIME)
    if (!hasKey && !hasTime) {
      return null
    }
    return arrayOf(
      store.getString(API_KEY, "") ?: "",
      store.getLong(API_TIME, 0).toString(),
    )
  }

  @JvmStatic
  fun saveCredential(apiKey: String, apiTime: Long): Boolean {
    val store = requireNotNull(preferences) {
      "RabbyNativeOpenApiRuntime is not initialized"
    }
    return store.edit()
      .putString(API_KEY, apiKey)
      .putLong(API_TIME, apiTime)
      .commit()
  }

  @JvmStatic
  fun randomUuid(): String = UUID.randomUUID().toString().lowercase()

  @JvmStatic
  fun commitTokenSnapshot(
    ownerAddress: String,
    syncTimestampMs: Long,
    replacementKind: Int,
    replacementChainIds: Array<String>,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    deleteStaleForChainSql: String,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? {
    val context = applicationContext
      ?: return "native OpenAPI runtime is not initialized"
    return NativeTokenCachePersistence.commit(
      context = context,
      ownerAddress = ownerAddress,
      syncTimestampMs = syncTimestampMs,
      tableName = tableName,
      upsertSql = upsertSql,
      deleteStaleSql = deleteStaleSql,
      deleteStaleForChainSql = deleteStaleForChainSql,
      replacementKind = replacementKind,
      replacementChainIds = replacementChainIds,
      expectedColumnsCsv = expectedColumnsCsv,
      payload = payload,
    )
  }

  @JvmStatic
  fun commitAddressSnapshot(
    ownerAddress: String,
    syncTimestampMs: Long,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? {
    val context = applicationContext
      ?: return "native OpenAPI runtime is not initialized"
    return NativeAddressCachePersistence.commit(
      context = context,
      ownerAddress = ownerAddress,
      syncTimestampMs = syncTimestampMs,
      tableName = tableName,
      upsertSql = upsertSql,
      deleteStaleSql = deleteStaleSql,
      expectedColumnsCsv = expectedColumnsCsv,
      payload = payload,
    )
  }

  @JvmStatic
  fun verifyTokenSnapshotWriteContract(
    ownerAddress: String,
    syncTimestampMs: Long,
    replacementKind: Int,
    replacementChainIds: Array<String>,
    tableName: String,
    upsertSql: String,
    deleteStaleSql: String,
    deleteStaleForChainSql: String,
    expectedColumnsCsv: String,
    payload: ByteBuffer,
  ): String? {
    val context = applicationContext
      ?: return "native OpenAPI runtime is not initialized"
    return NativeTokenCachePersistence.verifyWriteContract(
      context = context,
      ownerAddress = ownerAddress,
      syncTimestampMs = syncTimestampMs,
      tableName = tableName,
      upsertSql = upsertSql,
      deleteStaleSql = deleteStaleSql,
      deleteStaleForChainSql = deleteStaleForChainSql,
      replacementKind = replacementKind,
      replacementChainIds = replacementChainIds,
      expectedColumnsCsv = expectedColumnsCsv,
      payload = payload,
    )
  }

  @JvmStatic
  fun runDiagnostic(
    context: Context,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    callback: NativeOpenApiDiagnosticCallback,
  ) {
    initialize(context)
    val diagnosticId = nextDiagnosticId.getAndIncrement()
    diagnosticCallbacks[diagnosticId] = callback
    try {
      startDiagnostic(
        diagnosticId,
        applicationIdentity,
        clientVersion,
        address,
      )
    } catch (_: Throwable) {
      diagnosticCallbacks.remove(diagnosticId)
      mainHandler.post {
        callback.onComplete(
          NativeOpenApiDiagnosticResult(
            success = false,
            error = "native OpenAPI diagnostic could not start",
            firstStatusCode = 0,
            secondStatusCode = 0,
            firstDurationMs = 0,
            secondDurationMs = 0,
            firstBodyBytes = 0,
            secondBodyBytes = 0,
            firstCredentialDisposition = "not_started",
            secondCredentialDisposition = "not_started",
            firstRequestCredentialRevision = 0,
            firstCurrentCredentialRevision = 0,
            secondRequestCredentialRevision = 0,
            secondCurrentCredentialRevision = 0,
            secondUsedLatestAvailableCredential = false,
          ),
        )
      }
    }
  }

  @JvmStatic
  fun syncTokenCache(
    context: Context,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    replaceExisting: Boolean,
    callback: NativeTokenSyncCallback,
  ) {
    initialize(context)
    val syncId = nextTokenSyncId.getAndIncrement()
    tokenSyncCallbacks[syncId] = callback
    try {
      startTokenSync(
        syncId,
        applicationIdentity,
        clientVersion,
        address,
        replaceExisting,
      )
    } catch (_: Throwable) {
      tokenSyncCallbacks.remove(syncId)
      mainHandler.post {
        callback.onComplete(
          NativeTokenSyncResult(
            success = false,
            address = address.lowercase(),
            generation = 0,
            stage = "none",
            chainCount = 0,
            sourceTokenCount = 0,
            filteredTokenCount = 0,
            committedRowCount = 0,
            committedAtMs = 0,
            durationMs = 0,
            error = "native token sync could not start",
          ),
        )
      }
    }
  }

  @JvmStatic
  fun syncTokenChains(
    context: Context,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    chainIds: Array<String>,
    replacementKind: Int,
    replaceExisting: Boolean,
    callback: NativeTokenSyncCallback,
  ) {
    initialize(context)
    val syncId = nextTokenSyncId.getAndIncrement()
    tokenSyncCallbacks[syncId] = callback
    try {
      startTokenChainSync(
        syncId,
        applicationIdentity,
        clientVersion,
        address,
        chainIds,
        replacementKind,
        replaceExisting,
      )
    } catch (_: Throwable) {
      tokenSyncCallbacks.remove(syncId)
      mainHandler.post {
        callback.onComplete(
          NativeTokenSyncResult(
            success = false,
            address = address.lowercase(),
            generation = 0,
            stage = "none",
            chainCount = 0,
            sourceTokenCount = 0,
            filteredTokenCount = 0,
            committedRowCount = 0,
            committedAtMs = 0,
            durationMs = 0,
            error = "native token sync could not start",
          ),
        )
      }
    }
  }

  @JvmStatic
  fun syncProtocolCache(
    context: Context,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    replaceExisting: Boolean,
    callback: NativeAddressAssetSyncCallback,
  ) {
    initialize(context)
    val syncId = nextAddressAssetSyncId.getAndIncrement()
    addressAssetSyncCallbacks[syncId] = callback
    try {
      startProtocolSync(
        syncId,
        applicationIdentity,
        clientVersion,
        address,
        replaceExisting,
      )
    } catch (_: Throwable) {
      addressAssetSyncCallbacks.remove(syncId)
      mainHandler.post {
        callback.onComplete(
          NativeAddressAssetSyncResult(
            kind = "protocol",
            success = false,
            address = address.lowercase(),
            generation = 0,
            stage = "none",
            sourceItemCount = 0,
            committedRowCount = 0,
            committedAtMs = 0,
            durationMs = 0,
            error = "native protocol sync could not start",
          ),
        )
      }
    }
  }

  @JvmStatic
  fun runTokenCacheWriteDiagnostic(
    context: Context,
    callback: NativeTokenCacheWriteDiagnosticCallback,
  ) {
    initialize(context)
    storageDiagnosticExecutor.execute {
      val startedAt = SystemClock.elapsedRealtime()
      val error = try {
        verifyTokenCacheWrite(System.currentTimeMillis())
      } catch (_: Throwable) {
        "native token cache write diagnostic failed"
      }
      val result = NativeTokenCacheWriteDiagnosticResult(
        success = error == null,
        stage = if (error == null) "rolled_back" else "transaction",
        attemptedRowCount = 1,
        durationMs = SystemClock.elapsedRealtime() - startedAt,
        error = error ?: "",
      )
      mainHandler.post { callback.onComplete(result) }
    }
  }

  @JvmStatic
  fun cancelTokenCacheSync(address: String) {
    cancelTokenSync(address)
  }

  @JvmStatic
  fun cancelAllTokenCacheSyncs() {
    cancelAllTokenSyncs()
  }

  @JvmStatic
  fun cancelProtocolCacheSync(address: String) {
    cancelProtocolSync(address)
  }

  @JvmStatic
  fun cancelAllProtocolCacheSyncs() {
    cancelAllProtocolSyncs()
  }

  @JvmStatic
  private external fun startDiagnostic(
    diagnosticId: Long,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
  )

  @JvmStatic
  private external fun startTokenSync(
    syncId: Long,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    replaceExisting: Boolean,
  )

  @JvmStatic
  private external fun startTokenChainSync(
    syncId: Long,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    chainIds: Array<String>,
    replacementKind: Int,
    replaceExisting: Boolean,
  )

  @JvmStatic
  private external fun startProtocolSync(
    syncId: Long,
    applicationIdentity: String,
    clientVersion: String,
    address: String,
    replaceExisting: Boolean,
  )

  @JvmStatic
  private external fun cancelTokenSync(address: String)

  @JvmStatic
  private external fun cancelAllTokenSyncs()

  @JvmStatic
  private external fun cancelProtocolSync(address: String)

  @JvmStatic
  private external fun cancelAllProtocolSyncs()

  @JvmStatic
  private external fun verifyTokenCacheWrite(syncTimestampMs: Long): String?

  @JvmStatic
  private fun onDiagnosticCompleted(
    diagnosticId: Long,
    success: Boolean,
    error: String,
    firstStatusCode: Int,
    secondStatusCode: Int,
    firstDurationMs: Long,
    secondDurationMs: Long,
    firstBodyBytes: Long,
    secondBodyBytes: Long,
    firstCredentialDisposition: String,
    secondCredentialDisposition: String,
    firstRequestCredentialRevision: Long,
    firstCurrentCredentialRevision: Long,
    secondRequestCredentialRevision: Long,
    secondCurrentCredentialRevision: Long,
    secondUsedLatestAvailableCredential: Boolean,
  ) {
    val callback = diagnosticCallbacks.remove(diagnosticId) ?: return
    val result = NativeOpenApiDiagnosticResult(
      success,
      error,
      firstStatusCode,
      secondStatusCode,
      firstDurationMs,
      secondDurationMs,
      firstBodyBytes,
      secondBodyBytes,
      firstCredentialDisposition,
      secondCredentialDisposition,
      firstRequestCredentialRevision,
      firstCurrentCredentialRevision,
      secondRequestCredentialRevision,
      secondCurrentCredentialRevision,
      secondUsedLatestAvailableCredential,
    )
    mainHandler.post { callback.onComplete(result) }
  }

  @JvmStatic
  private fun onTokenSyncCompleted(
    syncId: Long,
    success: Boolean,
    address: String,
    generation: Long,
    stage: String,
    chainCount: Long,
    sourceTokenCount: Long,
    filteredTokenCount: Long,
    committedRowCount: Long,
    committedAtMs: Long,
    durationMs: Long,
    error: String,
  ) {
    val callback = tokenSyncCallbacks.remove(syncId) ?: return
    val result = NativeTokenSyncResult(
      success = success,
      address = address,
      generation = generation,
      stage = stage,
      chainCount = chainCount,
      sourceTokenCount = sourceTokenCount,
      filteredTokenCount = filteredTokenCount,
      committedRowCount = committedRowCount,
      committedAtMs = committedAtMs,
      durationMs = durationMs,
      error = error,
    )
    mainHandler.post { callback.onComplete(result) }
  }

  @JvmStatic
  private fun onAddressAssetSyncCompleted(
    syncId: Long,
    kind: String,
    success: Boolean,
    address: String,
    generation: Long,
    stage: String,
    sourceItemCount: Long,
    committedRowCount: Long,
    committedAtMs: Long,
    durationMs: Long,
    error: String,
  ) {
    val callback = addressAssetSyncCallbacks.remove(syncId) ?: return
    val result = NativeAddressAssetSyncResult(
      kind = kind,
      success = success,
      address = address,
      generation = generation,
      stage = stage,
      sourceItemCount = sourceItemCount,
      committedRowCount = committedRowCount,
      committedAtMs = committedAtMs,
      durationMs = durationMs,
      error = error,
    )
    mainHandler.post { callback.onComplete(result) }
  }
}
