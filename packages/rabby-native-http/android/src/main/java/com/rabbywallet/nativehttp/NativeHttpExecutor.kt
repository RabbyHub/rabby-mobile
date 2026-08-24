package com.rabbywallet.nativehttp

import java.io.IOException
import java.io.InterruptedIOException
import java.net.ConnectException
import java.net.UnknownHostException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLException
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.Callback
import okhttp3.CookieJar
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.Buffer

internal object NativeHttpExecutor {
  private data class RequestState(
    val call: Call,
    val startedAtNs: Long,
    val completed: AtomicBoolean = AtomicBoolean(false),
  )

  private val client by lazy {
    okhttp3.OkHttpClient.Builder()
      .cache(null)
      .cookieJar(CookieJar.NO_COOKIES)
      .authenticator(Authenticator.NONE)
      .proxyAuthenticator(Authenticator.NONE)
      .followRedirects(false)
      .followSslRedirects(false)
      .retryOnConnectionFailure(false)
      .build()
  }

  private val requests = ConcurrentHashMap<Long, RequestState>()

  @JvmStatic
  fun execute(
    requestId: Long,
    url: String,
    method: String,
    headerNames: Array<String>,
    headerValues: Array<String>,
    body: ByteArray,
    timeoutMs: Long,
    maxResponseBytes: Long,
  ) {
    var state: RequestState? = null
    try {
      val requestBody = when (method) {
        "GET", "HEAD" -> null
        "DELETE" -> body.takeIf { it.isNotEmpty() }?.toRequestBody(null)
        else -> body.toRequestBody(null)
      }
      val builder = Request.Builder().url(url).method(method, requestBody)
      headerNames.indices.forEach { index ->
        builder.header(headerNames[index], headerValues[index])
      }

      val call = client.newCall(builder.build())
      call.timeout().timeout(timeoutMs, TimeUnit.MILLISECONDS)
      val requestState = RequestState(call = call, startedAtNs = System.nanoTime())
      state = requestState
      requests[requestId] = requestState
      call.enqueue(object : Callback {
        override fun onFailure(call: Call, exception: IOException) {
          finishIOException(requestId, requestState, call, exception)
        }

        override fun onResponse(call: Call, response: Response) {
          try {
            response.use {
              val responseBody = response.body
              val declaredLength = responseBody?.contentLength() ?: 0L
              if (declaredLength > maxResponseBytes) {
                finishFailure(
                  requestId,
                  requestState,
                  "response_too_large",
                  "response body exceeds configured limit",
                )
                return
              }

              val buffer = Buffer()
              val source = responseBody?.source()
              var totalBytes = 0L
              while (source != null) {
                val read = source.read(buffer, 16L * 1024L)
                if (read == -1L) {
                  break
                }
                totalBytes += read
                if (totalBytes > maxResponseBytes) {
                  finishFailure(
                    requestId,
                    requestState,
                    "response_too_large",
                    "response body exceeds configured limit",
                  )
                  call.cancel()
                  return
                }
              }

              val names = Array(response.headers.size) { index -> response.headers.name(index) }
              val values = Array(response.headers.size) { index -> response.headers.value(index) }
              finishResponse(
                requestId = requestId,
                state = requestState,
                statusCode = response.code,
                finalUrl = response.request.url.toString(),
                headerNames = names,
                headerValues = values,
                body = buffer.readByteArray(),
              )
            }
          } catch (exception: IOException) {
            finishIOException(requestId, requestState, call, exception)
          } catch (exception: Throwable) {
            finishFailure(
              requestId,
              requestState,
              "transport",
              exception.javaClass.simpleName,
            )
          }
        }
      })
    } catch (exception: Throwable) {
      val requestState = state
      if (requestState == null) {
        RabbyNativeHttpRuntime.onPlatformFailure(
          requestId,
          "transport",
          exception.javaClass.simpleName,
          0,
        )
      } else {
        requestState.call.cancel()
        finishFailure(
          requestId,
          requestState,
          "transport",
          exception.javaClass.simpleName,
        )
      }
    }
  }

  @JvmStatic
  fun cancel(requestId: Long) {
    requests[requestId]?.call?.cancel()
  }

  private fun finishResponse(
    requestId: Long,
    state: RequestState,
    statusCode: Int,
    finalUrl: String,
    headerNames: Array<String>,
    headerValues: Array<String>,
    body: ByteArray,
  ) {
    if (!state.completed.compareAndSet(false, true)) {
      return
    }
    requests.remove(requestId, state)
    RabbyNativeHttpRuntime.onPlatformResponse(
      requestId,
      statusCode,
      finalUrl,
      headerNames,
      headerValues,
      body,
      elapsedMs(state),
    )
  }

  private fun finishFailure(
    requestId: Long,
    state: RequestState,
    code: String,
    message: String,
  ) {
    if (!state.completed.compareAndSet(false, true)) {
      return
    }
    requests.remove(requestId, state)
    RabbyNativeHttpRuntime.onPlatformFailure(requestId, code, message, elapsedMs(state))
  }

  private fun finishIOException(
    requestId: Long,
    state: RequestState,
    call: Call,
    exception: IOException,
  ) {
    val code = when {
      exception is InterruptedIOException -> "timeout"
      call.isCanceled() -> "cancelled"
      exception is UnknownHostException ||
        exception is ConnectException ||
        exception is SSLException -> "network"
      else -> "network"
    }
    finishFailure(requestId, state, code, exception.javaClass.simpleName)
  }

  private fun elapsedMs(state: RequestState): Long =
    TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - state.startedAtNs)
}
