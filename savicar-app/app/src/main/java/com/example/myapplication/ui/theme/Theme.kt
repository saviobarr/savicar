package com.example.myapplication.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// savicar-web forces color-scheme: dark unconditionally (see index.css) —
// mirror that here instead of following the device's light/dark setting or
// Material You dynamic color, so the app always looks like the web app.
private val SavicarColorScheme = darkColorScheme(
    primary = SavicarOrange,
    onPrimary = Color.White,
    primaryContainer = SavicarOrangeDark,
    onPrimaryContainer = Color.White,
    secondary = SavicarBlue,
    onSecondary = Color.White,
    tertiary = SavicarGreen,
    onTertiary = Color.White,
    background = SavicarBackground,
    onBackground = SavicarTextPrimary,
    surface = SavicarSurface,
    onSurface = SavicarTextPrimary,
    surfaceVariant = SavicarSurfaceVariant,
    onSurfaceVariant = SavicarTextMuted,
    outline = SavicarOutline,
    outlineVariant = SavicarSurfaceVariant,
    error = SavicarError,
    onError = Color.White,
    errorContainer = SavicarErrorLight,
    onErrorContainer = SavicarBackground,
)

@Composable
fun SavicarTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SavicarColorScheme,
        typography = Typography,
        content = content,
    )
}
