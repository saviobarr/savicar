package com.example.myapplication.sync

import android.content.Context
import com.example.myapplication.PREFS_NAME
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * The JWT is valid for 12h (see auth_handler.go) — a session left open across
 * a shift routinely outlives it. Without this, the app kept showing the
 * logged-in UI with a dead token: every screen just failed with a generic
 * "erro ao buscar" and biometric re-login was never offered again, since
 * LoginScreen only renders when there's no cached token. SessionExpiryInterceptor
 * calls [onUnauthorized] on any 401 (except /auth/login itself) so MainActivity
 * can drop back to LoginScreen — which still has the saved biometric credentials.
 */
object SessionManager {
    private val _expired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val expired = _expired.asSharedFlow()

    fun onUnauthorized(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove("token").apply()
        _expired.tryEmit(Unit)
    }
}
