package com.debank.rabbymobile

import android.util.Log

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class UserAgentClientFactory : OkHttpClientFactory {
    override fun createNewNetworkModuleClient(): OkHttpClient {
        val dispatcher = Dispatcher().apply {
            if (BuildConfig.DEBUG) {
              maxRequests = 10
              maxRequestsPerHost = 5
            } else {
              maxRequests = 100
              maxRequestsPerHost = 100
            }
        }

        Log.d("UserAgentClientFactory", "create")

        return OkHttpClient.Builder()
            .dispatcher(dispatcher)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .cookieJar(ReactCookieJarContainer())
            .addInterceptor(UserAgentInterceptor())
            .build()
    }
}
