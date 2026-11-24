package com.example.myapplication.sync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Cheap reachability check against the configured Savicar server, used to
 * gate features (like WhatsApp send) that need it live before letting the
 * user try. Short timeouts so a dead/unreachable server (common case for
 * this check) fails fast instead of blocking the UI.
 */
object Connectivity {
    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .build()

    suspend fun isServerReachable(serverUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder().url("$serverUrl/health").get().build()
            client.newCall(request).execute().use { it.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }
}
