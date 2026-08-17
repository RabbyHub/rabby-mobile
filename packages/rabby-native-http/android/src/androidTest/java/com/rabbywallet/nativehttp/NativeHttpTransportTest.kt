package com.rabbywallet.nativehttp

import java.util.concurrent.TimeUnit
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class NativeHttpTransportTest {
  private lateinit var server: MockWebServer

  @Before
  fun setUp() {
    server = MockWebServer()
    server.start()
  }

  @After
  fun tearDown() {
    server.shutdown()
  }

  @Test
  fun executesThroughCppAndTreatsHttpErrorsAsResponses() {
    server.enqueue(MockResponse().setResponseCode(200).setBody("native-ok"))
    server.enqueue(MockResponse().setResponseCode(404).setBody("missing"))

    assertEquals("success|200|9|1", probe("/ok"))
    assertEquals("success|404|7|1", probe("/missing"))
  }

  @Test
  fun enforcesResponseLimitAndExactlyOnceCancellation() {
    server.enqueue(MockResponse().setBody("x".repeat(1024)))
    assertEquals("error|response_too_large|1", probe("/large", maxBytes = 32))

    server.enqueue(
      MockResponse()
        .setBody("slow")
        .setBodyDelay(500, TimeUnit.MILLISECONDS),
    )
    assertEquals("error|cancelled|1", probe("/slow", cancel = true))
  }

  @Test
  fun preservesRawPostBodyAndAppliesTimeout() {
    val body = byteArrayOf(0, 1, 2, 3, -1)
    server.enqueue(MockResponse().setResponseCode(201).setBody(Buffer().write(body)))
    assertEquals("success|201|5|1", probe("/echo", method = "POST", body = body))

    server.enqueue(
      MockResponse()
        .setBody("slow")
        .setBodyDelay(500, TimeUnit.MILLISECONDS),
    )
    assertEquals("error|timeout|1", probe("/timeout", timeoutMs = 50))
  }

  @Test
  fun returnsRedirectWithoutFollowingIt() {
    server.enqueue(
      MockResponse()
        .setResponseCode(302)
        .addHeader("Location", server.url("/ok")),
    )
    server.enqueue(MockResponse().setResponseCode(200).setBody("native-ok"))

    assertEquals("success|302|0|1", probe("/redirect"))
    assertEquals(1, server.requestCount)
  }

  private fun probe(
    path: String,
    method: String = "GET",
    body: ByteArray = byteArrayOf(),
    timeoutMs: Long = 1_000,
    maxBytes: Long = 1024,
    cancel: Boolean = false,
  ): String = NativeHttpTestHarness.runProbe(
    url = server.url(path).toString(),
    method = method,
    body = body,
    timeoutMs = timeoutMs,
    maxResponseBytes = maxBytes,
    cancelImmediately = cancel,
  )
}
