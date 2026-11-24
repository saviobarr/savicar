package com.example.myapplication.sync

import android.content.Context
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Detects a 401 from the API and routes it through SessionManager so the app
 * drops back to LoginScreen instead of silently failing every screen with a
 * stale token. /auth/login itself is excluded — a wrong password there also
 * returns 401 and must surface as "usuário ou senha inválidos", not as a
 * session-expired bounce.
 */
class SessionExpiryInterceptor(private val context: Context) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        if (response.code == 401 && !request.url.encodedPath.endsWith("/auth/login")) {
            SessionManager.onUnauthorized(context)
        }
        return response
    }
}
