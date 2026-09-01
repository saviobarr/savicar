package com.example.myapplication

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint as AndroidPaint
import android.graphics.Path as AndroidPath
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import coil.ImageLoader
import coil.compose.AsyncImage
import com.example.myapplication.ui.theme.SavicarTheme
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Url
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val PREFS_NAME = "savicar_prefs"
private const val DEFAULT_SERVER_URL = "http://10.0.2.2:8080"
private const val BIOMETRIC_KEY_ALIAS = "savicar_biometric_key"
private const val BIOMETRIC_TRANSFORMATION = "AES/GCM/NoPadding"
private const val COSMOS_TOKEN = "aAQz9k94OoCAcIIffX-HHg"
private const val DISCOVERY_PORT = 9999
private const val DISCOVERY_MSG = "SAVICAR_DISCOVER"
private const val DISCOVERY_RESPONSE_PREFIX = "SAVICAR_HERE:"

private sealed class Screen {
    data object Home : Screen()
    data object Scanner : Screen()
    data object ServiceOrders : Screen()
    data object NewServiceOrder : Screen()
    data class ServiceOrderDetail(val order: ServiceOrderSummary) : Screen()
    data class ServiceOrderImages(val order: ServiceOrderSummary) : Screen()
    data object Settings : Screen()
}

// Abrir a câmera do sistema (para escanear placa ou fotografar a OS) manda a Activity
// para segundo plano; se o Android matar o processo por pressão de memória nesse meio
// tempo, sem isso a tela reabriria sempre em Screen.Home, "esquecendo" onde o usuário
// estava (ex.: no meio da OS #42).
private fun screenSaveState(screen: Screen): List<Any?> = when (screen) {
    is Screen.Home -> listOf("Home")
    is Screen.Scanner -> listOf("Scanner")
    is Screen.ServiceOrders -> listOf("ServiceOrders")
    is Screen.NewServiceOrder -> listOf("NewServiceOrder")
    is Screen.Settings -> listOf("Settings")
    is Screen.ServiceOrderDetail -> listOf(
        "ServiceOrderDetail", screen.order.id_order, screen.order.customer_name,
        screen.order.model_name, screen.order.plate_number, screen.order.status,
    )
    is Screen.ServiceOrderImages -> listOf(
        "ServiceOrderImages", screen.order.id_order, screen.order.customer_name,
        screen.order.model_name, screen.order.plate_number, screen.order.status,
    )
}

private fun screenRestoreState(saved: List<Any?>): Screen {
    fun order() = ServiceOrderSummary(
        id_order = saved[1] as Int,
        customer_name = saved[2] as String?,
        model_name = saved[3] as String?,
        plate_number = saved[4] as String?,
        status = saved[5] as Int?,
    )
    return when (saved[0] as String) {
        "Scanner" -> Screen.Scanner
        "ServiceOrders" -> Screen.ServiceOrders
        "NewServiceOrder" -> Screen.NewServiceOrder
        "Settings" -> Screen.Settings
        "ServiceOrderDetail" -> Screen.ServiceOrderDetail(order())
        "ServiceOrderImages" -> Screen.ServiceOrderImages(order())
        else -> Screen.Home
    }
}

private val ScreenSaver = listSaver(save = { screen: Screen -> screenSaveState(screen) }, restore = ::screenRestoreState)

class MainActivity : FragmentActivity() {

    private val prefs by lazy { getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE) }
    private val api: SavicarApi by lazy {
        Retrofit.Builder()
            .baseUrl("http://localhost/") // unused: every call supplies an absolute @Url
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SavicarApi::class.java)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var serverUrl by remember { mutableStateOf(prefs.getString("server_url", DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL) }
            var token by remember { mutableStateOf(prefs.getString("token", null)) }
            var hasSavedBiometricLogin by remember { mutableStateOf(hasSavedBiometricCredentials()) }
            var screen by rememberSaveable(stateSaver = ScreenSaver) { mutableStateOf<Screen>(Screen.Home) }

            SavicarTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    if (token == null) {
                        LoginScreen(
                            initialServerUrl = serverUrl,
                            biometricAvailable = biometricAvailable(),
                            hasSavedBiometricLogin = hasSavedBiometricLogin,
                            onLogin = { url, userName, password, remember, onError ->
                                lifecycleScope.launch {
                                    val result = withContext(Dispatchers.IO) { doLogin(url, userName, password) }
                                    result
                                        .onSuccess { newToken ->
                                            serverUrl = url
                                            token = newToken
                                            prefs.edit()
                                                .putString("server_url", url)
                                                .putString("token", newToken)
                                                .apply()
                                            if (remember) {
                                                saveBiometricCredentials(userName, password) {
                                                    hasSavedBiometricLogin = true
                                                }
                                            }
                                        }
                                        .onFailure { onError(it.message ?: "Erro ao entrar") }
                                }
                            },
                            onBiometricLogin = { onError ->
                                unlockBiometricCredentials(
                                    onSuccess = { userName, password ->
                                        lifecycleScope.launch {
                                            val result = withContext(Dispatchers.IO) { doLogin(serverUrl, userName, password) }
                                            result
                                                .onSuccess { newToken ->
                                                    token = newToken
                                                    prefs.edit().putString("token", newToken).apply()
                                                }
                                                .onFailure { onError(it.message ?: "Erro ao entrar") }
                                        }
                                    },
                                    onError = onError,
                                )
                            },
                            onForgetBiometricLogin = {
                                clearBiometricCredentials()
                                hasSavedBiometricLogin = false
                            },
                        )
                    } else {
                        when (val s = screen) {
                            is Screen.Home -> HomeScreen(
                                onSelectScanner = { screen = Screen.Scanner },
                                onSelectServiceOrders = { screen = Screen.ServiceOrders },
                                onSelectSettings = { screen = Screen.Settings },
                                onLogout = {
                                    token = null
                                    screen = Screen.Home
                                    prefs.edit().remove("token").apply()
                                },
                            )
                            is Screen.Scanner -> ScannerScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                onBack = { screen = Screen.Home },
                            )
                            is Screen.ServiceOrders -> ServiceOrderListScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                onBack = { screen = Screen.Home },
                                onSelectOrder = { order -> screen = Screen.ServiceOrderDetail(order) },
                                onSelectNewOrder = { screen = Screen.NewServiceOrder },
                            )
                            is Screen.NewServiceOrder -> NewServiceOrderScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                onBack = { screen = Screen.ServiceOrders },
                                onCreated = { order -> screen = Screen.ServiceOrderImages(order) },
                            )
                            is Screen.ServiceOrderDetail -> ServiceOrderEditScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                order = s.order,
                                onBack = { screen = Screen.ServiceOrders },
                                onOpenImages = { order -> screen = Screen.ServiceOrderImages(order) },
                            )
                            is Screen.ServiceOrderImages -> ServiceOrderImagesScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                order = s.order,
                                onBack = { screen = Screen.ServiceOrderDetail(s.order) },
                            )
                            is Screen.Settings -> SettingsScreen(
                                initialServerUrl = serverUrl,
                                onBack = { screen = Screen.Home },
                                onSave = { newUrl ->
                                    serverUrl = newUrl
                                    prefs.edit().putString("server_url", newUrl).apply()
                                    screen = Screen.Home
                                },
                            )
                        }
                    }
                }
            }
        }
    }

    private suspend fun doLogin(serverUrl: String, userName: String, password: String): Result<String> {
        return try {
            val response = api.login("$serverUrl/auth/login", LoginRequest(userName, password))
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body.token)
            } else {
                Result.failure(Exception("Usuário ou senha inválidos"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    // ── Discovery ──────────────────────────────────────────────────────────
    // Envia um broadcast UDP na rede local perguntando por um backend Savicar
    // (ver savicar-api/internal/infrastructure/discovery) e usa o IP/porta de
    // quem responder primeiro, evitando digitar o endereço do servidor manualmente.

    private suspend fun discoverServer(): Result<String> = withContext(Dispatchers.IO) {
        try {
            DatagramSocket().use { socket ->
                socket.broadcast = true
                socket.soTimeout = 2000

                val message = DISCOVERY_MSG.toByteArray()
                val targets = mutableListOf(InetAddress.getByName("255.255.255.255"))
                wifiSubnetBroadcastAddress()?.let { targets.add(it) }

                for (target in targets) {
                    try {
                        socket.send(DatagramPacket(message, message.size, target, DISCOVERY_PORT))
                    } catch (_: Exception) {
                        // ignora endereço que falhar ao enviar, tenta os demais
                    }
                }

                val buf = ByteArray(1024)
                val packet = DatagramPacket(buf, buf.size)
                socket.receive(packet)

                val response = String(packet.data, 0, packet.length)
                val port = response.removePrefix(DISCOVERY_RESPONSE_PREFIX).trim()
                if (!response.startsWith(DISCOVERY_RESPONSE_PREFIX) || port.toIntOrNull() == null) {
                    return@withContext Result.failure(Exception("Resposta inválida do servidor"))
                }

                Result.success("http://${packet.address.hostAddress}:$port")
            }
        } catch (e: SocketTimeoutException) {
            Result.failure(Exception("Nenhum servidor Savicar encontrado na rede"))
        } catch (e: Exception) {
            Result.failure(Exception("Erro ao buscar servidor: ${e.message}"))
        }
    }

    private fun wifiSubnetBroadcastAddress(): InetAddress? {
        return try {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val dhcp = wifiManager?.dhcpInfo ?: return null
            if (dhcp.ipAddress == 0 || dhcp.netmask == 0) return null
            val broadcast = (dhcp.ipAddress and dhcp.netmask) or dhcp.netmask.inv()
            val bytes = byteArrayOf(
                (broadcast and 0xff).toByte(),
                (broadcast shr 8 and 0xff).toByte(),
                (broadcast shr 16 and 0xff).toByte(),
                (broadcast shr 24 and 0xff).toByte(),
            )
            InetAddress.getByAddress(bytes)
        } catch (_: Exception) {
            null
        }
    }

    // ── Biometric credential storage ──────────────────────────────────────
    // Username+password are encrypted with a key stored in the Android Keystore.
    // The key requires a fresh biometric authentication for every encrypt/decrypt,
    // so the fingerprint gates access to the credential, which is then replayed
    // through the normal /auth/login flow to obtain a real server token.

    private fun biometricAvailable(): Boolean {
        val manager = BiometricManager.from(this)
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun hasSavedBiometricCredentials(): Boolean {
        return prefs.getString("biometric_data", null) != null && prefs.getString("biometric_iv", null) != null
    }

    private fun clearBiometricCredentials() {
        prefs.edit().remove("biometric_data").remove("biometric_iv").apply()
        try {
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(BIOMETRIC_KEY_ALIAS)
        } catch (_: Exception) { /* nothing to delete */ }
    }

    private fun getOrCreateBiometricKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(BIOMETRIC_KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        val spec = KeyGenParameterSpec.Builder(
            BIOMETRIC_KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)
            .setUserAuthenticationValidityDurationSeconds(-1) // require a fresh biometric check every use
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    private fun saveBiometricCredentials(userName: String, password: String, onSaved: () -> Unit) {
        val cipher = try {
            Cipher.getInstance(BIOMETRIC_TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, getOrCreateBiometricKey()) }
        } catch (e: Exception) {
            Toast.makeText(this, "Não foi possível habilitar login por digital: ${e.message}", Toast.LENGTH_LONG).show()
            return
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Habilitar login por digital")
            .setSubtitle("Confirme sua digital para salvar este login")
            .setNegativeButtonText("Agora não")
            .build()

        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val authedCipher = result.cryptoObject?.cipher ?: return
                val payload = "$userName\n$password".toByteArray(Charsets.UTF_8)
                val encrypted = authedCipher.doFinal(payload)
                prefs.edit()
                    .putString("biometric_data", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                    .putString("biometric_iv", Base64.encodeToString(authedCipher.iv, Base64.NO_WRAP))
                    .apply()
                onSaved()
            }
        })
        prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
    }

    private fun unlockBiometricCredentials(onSuccess: (userName: String, password: String) -> Unit, onError: (String) -> Unit) {
        val ivB64 = prefs.getString("biometric_iv", null)
        val dataB64 = prefs.getString("biometric_data", null)
        if (ivB64 == null || dataB64 == null) {
            onError("Nenhum login salvo neste aparelho")
            return
        }

        val cipher = try {
            Cipher.getInstance(BIOMETRIC_TRANSFORMATION).apply {
                init(Cipher.DECRYPT_MODE, getOrCreateBiometricKey(), GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)))
            }
        } catch (e: Exception) {
            clearBiometricCredentials()
            onError("Login salvo inválido, use usuário e senha")
            return
        }

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Entrar no Savicar")
            .setSubtitle("Use sua digital para continuar")
            .setNegativeButtonText("Usar usuário e senha")
            .build()

        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                val authedCipher = result.cryptoObject?.cipher ?: run { onError("Erro de biometria"); return }
                try {
                    val decrypted = authedCipher.doFinal(Base64.decode(dataB64, Base64.NO_WRAP))
                    val parts = String(decrypted, Charsets.UTF_8).split("\n", limit = 2)
                    if (parts.size == 2) onSuccess(parts[0], parts[1]) else onError("Login salvo corrompido")
                } catch (e: Exception) {
                    onError("Erro ao ler login salvo: ${e.message}")
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                onError(errString.toString())
            }
        })
        prompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
    }

    @Composable
    private fun LoginScreen(
        initialServerUrl: String,
        biometricAvailable: Boolean,
        hasSavedBiometricLogin: Boolean,
        onLogin: (serverUrl: String, userName: String, password: String, remember: Boolean, onError: (String) -> Unit) -> Unit,
        onBiometricLogin: (onError: (String) -> Unit) -> Unit,
        onForgetBiometricLogin: () -> Unit,
    ) {
        var serverUrl by remember { mutableStateOf(initialServerUrl) }
        var userName by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var rememberBiometric by remember { mutableStateOf(false) }
        var loading by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var showPasswordForm by remember { mutableStateOf(!(biometricAvailable && hasSavedBiometricLogin)) }
        var discovering by remember { mutableStateOf(false) }
        var discoverError by remember { mutableStateOf<String?>(null) }

        Box(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
            ) {
            Text(text = "Savicar — Leitor de Código de Barras", style = MaterialTheme.typography.headlineSmall)
            Spacer(modifier = Modifier.height(24.dp))

            if (error != null) {
                Text(text = error!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 12.dp))
            }

            if (!showPasswordForm) {
                Text(text = "Login salvo neste aparelho.", modifier = Modifier.padding(bottom = 20.dp))
                if (loading) {
                    CircularProgressIndicator()
                } else {
                    Button(
                        onClick = {
                            error = null
                            loading = true
                            onBiometricLogin { message ->
                                loading = false
                                error = message
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Entrar com digital")
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    TextButton(onClick = { showPasswordForm = true }, modifier = Modifier.fillMaxWidth()) {
                        Text("Usar usuário e senha")
                    }
                    TextButton(
                        onClick = {
                            onForgetBiometricLogin()
                            showPasswordForm = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Esquecer login salvo")
                    }
                }
                return@Column
            }

            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Servidor (ex: http://192.168.0.10:8080)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(
                onClick = {
                    discoverError = null
                    discovering = true
                    lifecycleScope.launch {
                        val result = discoverServer()
                        discovering = false
                        result
                            .onSuccess { serverUrl = it }
                            .onFailure { discoverError = it.message }
                    }
                },
                enabled = !discovering,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (discovering) "Buscando na rede..." else "Buscar servidor na rede")
            }
            if (discoverError != null) {
                Text(
                    text = discoverError!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = userName,
                onValueChange = { userName = it },
                label = { Text("Usuário") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Senha") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
            )

            if (biometricAvailable) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Checkbox(checked = rememberBiometric, onCheckedChange = { rememberBiometric = it })
                    Text("Salvar login com digital neste aparelho")
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (loading) {
                CircularProgressIndicator()
            } else {
                Button(
                    onClick = {
                        error = null
                        loading = true
                        onLogin(serverUrl.trimEnd('/'), userName, password, rememberBiometric) { message ->
                            loading = false
                            error = message
                        }
                    },
                    enabled = serverUrl.isNotBlank() && userName.isNotBlank() && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Entrar")
                }
                if (hasSavedBiometricLogin) {
                    TextButton(onClick = { showPasswordForm = false }, modifier = Modifier.fillMaxWidth()) {
                        Text("Cancelar")
                    }
                }
            }
            }
            Text(
                text = "v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp),
            )
        }
    }

    @Composable
    private fun HomeScreen(
        onSelectScanner: () -> Unit,
        onSelectServiceOrders: () -> Unit,
        onSelectSettings: () -> Unit,
        onLogout: () -> Unit,
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(text = "Savicar", style = MaterialTheme.typography.headlineSmall)
                    TextButton(onClick = onLogout) { Text("Sair") }
                }

                Spacer(modifier = Modifier.height(32.dp))

                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    gridItems(
                        listOf(
                            Triple("📷", "Ler Código de Barras", onSelectScanner),
                            Triple("🔧", "Ordens de Serviço", onSelectServiceOrders),
                            Triple("⚙️", "Configurações", onSelectSettings),
                        ),
                    ) { (icon, label, onClick) ->
                        HomeMenuCard(icon = icon, label = label, onClick = onClick)
                    }
                }
            }
            Text(
                text = "v${BuildConfig.VERSION_NAME}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 16.dp),
            )
        }
    }

    @Composable
    private fun SettingsScreen(
        initialServerUrl: String,
        onBack: () -> Unit,
        onSave: (String) -> Unit,
    ) {
        var serverUrl by remember { mutableStateOf(initialServerUrl) }
        var discovering by remember { mutableStateOf(false) }
        var discoverError by remember { mutableStateOf<String?>(null) }

        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Configurações", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }

            Spacer(modifier = Modifier.height(32.dp))

            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Servidor (ex: http://192.168.0.10:8080)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "Endereço IP e porta do backend Savicar usado por este aparelho.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )

            Spacer(modifier = Modifier.height(12.dp))

            TextButton(
                onClick = {
                    discoverError = null
                    discovering = true
                    lifecycleScope.launch {
                        val result = discoverServer()
                        discovering = false
                        result
                            .onSuccess { serverUrl = it }
                            .onFailure { discoverError = it.message }
                    }
                },
                enabled = !discovering,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (discovering) "Buscando na rede..." else "Buscar servidor na rede")
            }
            if (discoverError != null) {
                Text(
                    text = discoverError!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { onSave(serverUrl.trimEnd('/')) },
                enabled = serverUrl.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Salvar")
            }
        }
    }

    @Composable
    private fun HomeMenuCard(icon: String, label: String, onClick: () -> Unit) {
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(text = icon, fontSize = 40.sp)
                Spacer(modifier = Modifier.height(12.dp))
                Text(text = label, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
            }
        }
    }

    @Composable
    private fun ScannerScreen(serverUrl: String, token: String, onBack: () -> Unit) {
        var barcode by remember { mutableStateOf<String?>(null) }
        var product by remember { mutableStateOf<InventoryProduct?>(null) }
        var externalSuggestion by remember { mutableStateOf<ExternalProduct?>(null) }
        var notFoundAnywhere by remember { mutableStateOf(false) }
        var serverUnreachable by remember { mutableStateOf(false) }
        var loading by remember { mutableStateOf(false) }
        var showRegisterDialog by remember { mutableStateOf(false) }
        var registerError by remember { mutableStateOf<String?>(null) }
        var showStockEntryDialog by remember { mutableStateOf(false) }
        var stockEntrySaving by remember { mutableStateOf(false) }
        var stockEntryError by remember { mutableStateOf<String?>(null) }

        fun resetLookupState() {
            product = null
            externalSuggestion = null
            notFoundAnywhere = false
            serverUnreachable = false
        }

        fun runLookup(code: String) {
            barcode = code
            resetLookupState()
            loading = true
            lifecycleScope.launch {
                val localResult = withContext(Dispatchers.IO) { lookupProduct(serverUrl, token, code) }
                localResult
                    .onSuccess {
                        loading = false
                        product = it
                    }
                    .onFailure { localError ->
                        // IOException = falha de conexão (servidor fora do ar), diferente de um 404
                        // "não encontrado" vindo de uma resposta HTTP válida. Nesse caso a busca na
                        // internet não pode passar pelo backend (ele é o proxy dela), então vai direto.
                        val backendDown = localError is IOException
                        serverUnreachable = backendDown
                        val externalResult = withContext(Dispatchers.IO) {
                            if (backendDown) lookupExternalDirect(code) else lookupExternal(serverUrl, token, code)
                        }
                        loading = false
                        externalResult
                            .onSuccess { externalSuggestion = it }
                            .onFailure { notFoundAnywhere = true }
                    }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Leitor de Código de Barras", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }

            Spacer(modifier = Modifier.height(32.dp))

            if (loading) {
                CircularProgressIndicator()
            } else {
                Button(onClick = { startBarcodeScanner { code -> runLookup(code) } }) {
                    Text("Escanear Código")
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            barcode?.let { code ->
                Text(text = "Código lido: $code", style = MaterialTheme.typography.bodyLarge)
                Spacer(modifier = Modifier.height(16.dp))
            }

            if (serverUnreachable) {
                Text(
                    text = "Servidor Savicar indisponível. Não foi possível consultar o estoque — buscando direto na internet.",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
            }

            product?.let { p ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = p.name ?: "(sem nome)", style = MaterialTheme.typography.titleMedium)
                        Text(text = "Código interno: ${p.code ?: "-"}")
                        Text(text = "Estoque atual: ${p.current_quantity ?: 0}")
                        Text(text = "Preço de venda: ${p.sales_price?.let { "R$ %.2f".format(it) } ?: "-"}")
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { stockEntryError = null; showStockEntryDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Entrada Estoque")
                }
            }

            externalSuggestion?.let { ext ->
                Text(
                    text = if (serverUnreachable) {
                        "Servidor Savicar indisponível — não é possível cadastrar o produto agora."
                    } else {
                        "Este código não está cadastrado no estoque."
                    },
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = "Encontrado na internet:", style = MaterialTheme.typography.labelMedium)
                        Text(text = ext.name ?: "(sem nome)", style = MaterialTheme.typography.titleMedium)
                        if (!ext.brand.isNullOrBlank()) Text(text = "Marca: ${ext.brand}")
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = { registerError = null; showRegisterDialog = true },
                    enabled = !serverUnreachable,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Cadastrar produto")
                }
            }

            if (notFoundAnywhere) {
                Text(
                    text = if (serverUnreachable) {
                        "Servidor indisponível e produto não encontrado na internet. Não é possível cadastrar o produto agora."
                    } else {
                        "Produto não encontrado no estoque nem na internet."
                    },
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
                Button(
                    onClick = { registerError = null; showRegisterDialog = true },
                    enabled = !serverUnreachable,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Cadastrar produto manualmente")
                }
            }
        }

        if (showRegisterDialog && barcode != null) {
            var registering by remember { mutableStateOf(false) }
            RegisterProductDialog(
                barcode = barcode!!,
                suggestedName = externalSuggestion?.name,
                error = registerError,
                saving = registering,
                onDismiss = { showRegisterDialog = false },
                onConfirm = { request ->
                    registering = true
                    lifecycleScope.launch {
                        val result = withContext(Dispatchers.IO) { registerProduct(serverUrl, token, request) }
                        registering = false
                        result
                            .onSuccess {
                                showRegisterDialog = false
                                resetLookupState()
                                product = it
                            }
                            .onFailure { registerError = it.message ?: "Erro ao cadastrar produto" }
                    }
                },
            )
        }

        if (showStockEntryDialog && product != null) {
            StockEntryDialog(
                productName = product?.name ?: "(sem nome)",
                currentQuantity = product?.current_quantity ?: 0,
                saving = stockEntrySaving,
                error = stockEntryError,
                onDismiss = { showStockEntryDialog = false },
                onConfirm = { quantity ->
                    val p = product ?: return@StockEntryDialog
                    stockEntrySaving = true
                    stockEntryError = null
                    lifecycleScope.launch {
                        val result = withContext(Dispatchers.IO) { adjustInventoryQuantity(serverUrl, token, p.id_product, quantity) }
                        stockEntrySaving = false
                        result
                            .onSuccess {
                                product = p.copy(current_quantity = (p.current_quantity ?: 0) + quantity)
                                showStockEntryDialog = false
                            }
                            .onFailure { stockEntryError = it.message ?: "Erro ao registrar entrada de estoque" }
                    }
                },
            )
        }
    }

    @Composable
    private fun StockEntryDialog(
        productName: String,
        currentQuantity: Int,
        saving: Boolean,
        error: String?,
        onDismiss: () -> Unit,
        onConfirm: (Int) -> Unit,
    ) {
        var quantity by remember { mutableStateOf("") }
        val quantityValue = quantity.toIntOrNull()

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Entrada Estoque") },
            text = {
                Column {
                    Text(text = productName, style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Estoque atual: $currentQuantity",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it },
                        label = { Text("Quantidade a adicionar") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (quantityValue != null && quantityValue > 0) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Novo estoque: ${currentQuantity + quantityValue}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = quantityValue != null && quantityValue > 0,
                        onClick = { onConfirm(quantityValue!!) },
                    ) { Text("Confirmar") }
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )
    }

    @Composable
    private fun RegisterProductDialog(
        barcode: String,
        suggestedName: String?,
        error: String?,
        saving: Boolean,
        onDismiss: () -> Unit,
        onConfirm: (NewProductRequest) -> Unit,
    ) {
        var name by remember { mutableStateOf(suggestedName ?: "") }
        var internalCode by remember { mutableStateOf("") }
        var salesPrice by remember { mutableStateOf("") }
        var costPrice by remember { mutableStateOf("") }
        var quantity by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Cadastrar produto") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text(text = "Código: $barcode", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Nome do produto") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = internalCode,
                        onValueChange = { internalCode = it },
                        label = { Text("Código interno (opcional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = salesPrice,
                        onValueChange = { salesPrice = it },
                        label = { Text("Preço de venda") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = costPrice,
                        onValueChange = { costPrice = it },
                        label = { Text("Preço de custo") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it },
                        label = { Text("Quantidade em estoque") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = name.isNotBlank(),
                        onClick = {
                            onConfirm(
                                NewProductRequest(
                                    name = name,
                                    code = internalCode.ifBlank { null },
                                    gtin_ean_code = barcode,
                                    sales_price = salesPrice.replace(",", ".").toDoubleOrNull(),
                                    cost_price = costPrice.replace(",", ".").toDoubleOrNull(),
                                    current_quantity = quantity.toIntOrNull(),
                                ),
                            )
                        },
                    ) { Text("Salvar") }
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) { Text("Cancelar") }
            },
        )
    }

    // ── Service Orders: pick an order, view/upload its images ──────────────

    @Composable
    private fun ServiceOrderListScreen(
        serverUrl: String,
        token: String,
        onBack: () -> Unit,
        onSelectOrder: (ServiceOrderSummary) -> Unit,
        onSelectNewOrder: () -> Unit,
    ) {
        var orders by remember { mutableStateOf<List<ServiceOrderSummary>>(emptyList()) }
        var loading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var query by remember { mutableStateOf("") }

        LaunchedEffect(Unit) {
            val result = withContext(Dispatchers.IO) { fetchServiceOrders(serverUrl, token) }
            loading = false
            result.onSuccess { orders = it.sortedByDescending { o -> o.id_order } }.onFailure { error = it.message }
        }

        val filtered = remember(orders, query) {
            if (query.isBlank()) {
                orders
            } else {
                orders.filter { o ->
                    (o.customer_name?.contains(query, ignoreCase = true) == true) ||
                        (o.plate_number?.contains(query, ignoreCase = true) == true) ||
                        (o.model_name?.contains(query, ignoreCase = true) == true) ||
                        o.id_order.toString().contains(query)
                }
            }
        }

        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Ordens de Serviço", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }
            Spacer(modifier = Modifier.height(16.dp))
            Button(onClick = onSelectNewOrder, modifier = Modifier.fillMaxWidth()) {
                Text("+ Abrir OS")
            }
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Buscar por OS, cliente, placa ou modelo") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(modifier = Modifier.height(16.dp))

            when {
                loading -> CircularProgressIndicator()
                error != null -> Text(text = error!!, color = MaterialTheme.colorScheme.error)
                filtered.isEmpty() -> Text(text = "Nenhuma OS encontrada.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(filtered) { order ->
                        Card(onClick = { onSelectOrder(order) }, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "OS #${order.id_order} — ${order.customer_name ?: "sem cliente"}",
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    text = "${order.model_name ?: "-"} · ${order.plate_number ?: "-"}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = statusLabel(order.status),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Service Order Edit: full OS info, editable core fields (status,
    // técnico, datas, hodômetro, observações, diagnóstico) + WhatsApp send.
    // Mirrors the web's ServiceOrderDetailFull/ServiceOrderForm
    // (savicar-web/src/pages/ServiceOrderPage.jsx), but only exposes the
    // fields listed above for editing on mobile — services/products/payments
    // stay read-only here and are managed on the web.

    @Composable
    private fun DetailRow(label: String, value: String?) {
        if (value.isNullOrBlank()) return
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(150.dp),
            )
            Text(text = value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        }
    }

    private fun pickDateTime(context: Context, initial: String?, onPicked: (String) -> Unit) {
        val cal = java.util.Calendar.getInstance()
        if (!initial.isNullOrBlank()) {
            try {
                java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
                    .parse(initial.replace("T", " ").take(19))
                    ?.let { cal.time = it }
            } catch (_: Exception) { /* keep "now" if the stored value can't be parsed */ }
        }
        android.app.DatePickerDialog(
            context,
            { _, year, month, day ->
                cal.set(year, month, day)
                android.app.TimePickerDialog(
                    context,
                    { _, hour, minute ->
                        cal.set(java.util.Calendar.HOUR_OF_DAY, hour)
                        cal.set(java.util.Calendar.MINUTE, minute)
                        cal.set(java.util.Calendar.SECOND, 0)
                        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
                        onPicked(fmt.format(cal.time))
                    },
                    cal.get(java.util.Calendar.HOUR_OF_DAY),
                    cal.get(java.util.Calendar.MINUTE),
                    true,
                ).show()
            },
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH),
            cal.get(java.util.Calendar.DAY_OF_MONTH),
        ).show()
    }

    @Composable
    private fun EditableDateTimeRow(label: String, value: String?, clearable: Boolean, onChange: (String?) -> Unit) {
        val context = LocalContext.current
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(150.dp),
            )
            Text(
                text = fmtDatetimeBR(value) ?: "—",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = { pickDateTime(context, value) { onChange(it) } }) { Text("Alterar") }
            if (clearable && !value.isNullOrBlank()) {
                TextButton(onClick = { onChange(null) }) { Text("Limpar") }
            }
        }
    }

    @Composable
    private fun ServiceOrderEditScreen(
        serverUrl: String,
        token: String,
        order: ServiceOrderSummary,
        onBack: () -> Unit,
        onOpenImages: (ServiceOrderSummary) -> Unit,
    ) {
        var detail by remember { mutableStateOf<ServiceOrderFull?>(null) }
        var services by remember { mutableStateOf<List<ServiceItem>>(emptyList()) }
        var products by remember { mutableStateOf<List<ServiceOrderProductItem>>(emptyList()) }
        var payments by remember { mutableStateOf<List<PaymentItem>>(emptyList()) }
        var inventory by remember { mutableStateOf<List<InventoryProduct>>(emptyList()) }
        var technicians by remember { mutableStateOf<List<TechnicianBrief>>(emptyList()) }
        var customerModels by remember { mutableStateOf<List<CustomerModelBrief>>(emptyList()) }
        var vehicleMakes by remember { mutableStateOf<List<VehicleMakeBrief>>(emptyList()) }
        var vehicleModels by remember { mutableStateOf<List<VehicleModelBrief>>(emptyList()) }
        var sendWppEnabled by remember { mutableStateOf(false) }
        var loading by remember { mutableStateOf(true) }
        var error by remember { mutableStateOf<String?>(null) }
        var showWppDialog by remember { mutableStateOf(false) }

        // Editable fields, seeded from `detail` once it loads (see the `seeded`
        // LaunchedEffect below) so later recompositions don't clobber user edits.
        var seeded by remember { mutableStateOf(false) }
        var statusEdit by remember { mutableStateOf(0) }
        var idTechnicianEdit by remember { mutableStateOf<Int?>(null) }
        var idCustomerModelEdit by remember { mutableStateOf<Int?>(null) }
        var dateTimeInEdit by remember { mutableStateOf<String?>(null) }
        var dateTimeOutEdit by remember { mutableStateOf<String?>(null) }
        var odometerEdit by remember { mutableStateOf("") }
        var customerNotesEdit by remember { mutableStateOf("") }
        var internalNotesEdit by remember { mutableStateOf("") }
        var diagnosisNotesEdit by remember { mutableStateOf("") }
        var showStatusPicker by remember { mutableStateOf(false) }
        var showTechnicianPicker by remember { mutableStateOf(false) }
        var showVehiclePicker by remember { mutableStateOf(false) }
        var showNewVehicleDialog by remember { mutableStateOf(false) }
        var newVehicleSaving by remember { mutableStateOf(false) }
        var newVehicleError by remember { mutableStateOf<String?>(null) }
        var saving by remember { mutableStateOf(false) }
        var saveError by remember { mutableStateOf<String?>(null) }

        // Adding/editing service and product lines never shows unit_value/total_value/
        // sales_price — technicians pick parts+quantity or type a service+hours+técnico only.
        var showServiceDialog by remember { mutableStateOf(false) }
        var editingService by remember { mutableStateOf<ServiceItem?>(null) }
        var serviceLineSaving by remember { mutableStateOf(false) }
        var serviceLineError by remember { mutableStateOf<String?>(null) }
        var showProductDialog by remember { mutableStateOf(false) }
        var editingProduct by remember { mutableStateOf<ServiceOrderProductItem?>(null) }
        var productLineSaving by remember { mutableStateOf(false) }
        var productLineError by remember { mutableStateOf<String?>(null) }

        fun refreshServices() {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) { fetchServicesByOrder(serverUrl, token, order.id_order) }
                    .onSuccess { services = it }
            }
        }

        fun refreshProducts() {
            lifecycleScope.launch {
                withContext(Dispatchers.IO) { fetchServiceOrderProductsForOrder(serverUrl, token, order.id_order) }
                    .onSuccess { products = it }
            }
        }

        fun saveServiceLine(description: String, hours: Double?, idTechnician: Int?) {
            serviceLineSaving = true
            serviceLineError = null
            val current = editingService
            lifecycleScope.launch {
                val result = if (current == null) {
                    withContext(Dispatchers.IO) {
                        createService(serverUrl, token, NewServiceRequest(order.id_order, description, hours, idTechnician))
                    }
                } else {
                    val payload = current.copy(description = description, hours_quantity = hours, id_technician = idTechnician)
                    withContext(Dispatchers.IO) { updateService(serverUrl, token, current.id_service, payload) }
                }
                serviceLineSaving = false
                result
                    .onSuccess {
                        showServiceDialog = false
                        editingService = null
                        refreshServices()
                    }
                    .onFailure { serviceLineError = it.message ?: "Erro ao salvar serviço" }
            }
        }

        fun saveProductLine(idProduct: Int, quantity: Double) {
            productLineSaving = true
            productLineError = null
            val current = editingProduct
            lifecycleScope.launch {
                val result = if (current == null) {
                    withContext(Dispatchers.IO) {
                        createServiceOrderProduct(serverUrl, token, NewServiceOrderProductRequest(order.id_order, idProduct, quantity))
                    }
                } else {
                    val payload = current.copy(id_product = idProduct, quantity = quantity)
                    withContext(Dispatchers.IO) { updateServiceOrderProduct(serverUrl, token, current.id_service_order_product, payload) }
                }
                productLineSaving = false
                result
                    .onSuccess {
                        showProductDialog = false
                        editingProduct = null
                        refreshProducts()
                    }
                    .onFailure { productLineError = it.message ?: "Erro ao salvar peça" }
            }
        }

        LaunchedEffect(order.id_order) {
            loading = true
            error = null
            val detailResult = withContext(Dispatchers.IO) { fetchServiceOrderDetail(serverUrl, token, order.id_order) }
            val servicesResult = withContext(Dispatchers.IO) { fetchServicesByOrder(serverUrl, token, order.id_order) }
            val productsResult = withContext(Dispatchers.IO) { fetchServiceOrderProductsForOrder(serverUrl, token, order.id_order) }
            val paymentsResult = withContext(Dispatchers.IO) { fetchPaymentsForOrder(serverUrl, token, order.id_order) }
            val inventoryResult = withContext(Dispatchers.IO) { fetchInventoryList(serverUrl, token) }
            val techResult = withContext(Dispatchers.IO) { fetchTechnicians(serverUrl, token) }
            val modelsResult = withContext(Dispatchers.IO) { fetchCustomerModels(serverUrl, token) }
            val makesResult = withContext(Dispatchers.IO) { fetchVehicleMakes(serverUrl, token) }
            val vehicleModelsResult = withContext(Dispatchers.IO) { fetchVehicleModels(serverUrl, token) }
            sendWppEnabled = withContext(Dispatchers.IO) { fetchSendWppEnabled(serverUrl, token) }
            loading = false
            detailResult.onSuccess { detail = it }.onFailure { error = it.message }
            services = servicesResult.getOrDefault(emptyList())
            products = productsResult.getOrDefault(emptyList())
            payments = paymentsResult.getOrDefault(emptyList())
            inventory = inventoryResult.getOrDefault(emptyList())
            technicians = techResult.getOrDefault(emptyList())
            customerModels = modelsResult.getOrDefault(emptyList())
            vehicleMakes = makesResult.getOrDefault(emptyList())
            vehicleModels = vehicleModelsResult.getOrDefault(emptyList())
        }

        LaunchedEffect(detail) {
            val d = detail
            if (d != null && !seeded) {
                seeded = true
                statusEdit = d.status ?: 0
                idTechnicianEdit = d.id_technician
                idCustomerModelEdit = d.id_customer_model
                dateTimeInEdit = d.date_time_in
                dateTimeOutEdit = d.date_time_out
                odometerEdit = d.odometer_reading?.toString() ?: ""
                customerNotesEdit = d.customer_notes ?: ""
                internalNotesEdit = d.internal_notes ?: ""
                diagnosisNotesEdit = d.diagnosis_notes ?: ""
            }
        }

        fun save() {
            val d = detail ?: return
            saving = true
            saveError = null
            val payload = d.copy(
                status = statusEdit,
                id_technician = idTechnicianEdit,
                id_customer_model = idCustomerModelEdit,
                date_time_in = dateTimeInEdit,
                date_time_out = dateTimeOutEdit,
                odometer_reading = odometerEdit.toIntOrNull(),
                customer_notes = customerNotesEdit.ifBlank { null },
                internal_notes = internalNotesEdit.ifBlank { null },
                diagnosis_notes = diagnosisNotesEdit.ifBlank { null },
            )
            lifecycleScope.launch {
                val result = withContext(Dispatchers.IO) { updateServiceOrder(serverUrl, token, order.id_order, payload) }
                saving = false
                result
                    .onSuccess { onBack() }
                    .onFailure { saveError = it.message ?: "Erro ao salvar OS" }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Editar OS #${order.id_order}", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }
            Spacer(modifier = Modifier.height(16.dp))

            when {
                loading -> CircularProgressIndicator()
                error != null -> Text(text = error!!, color = MaterialTheme.colorScheme.error)
                detail != null -> {
                    val d = detail!!
                    DetailRow("Cliente", d.customer_name)
                    DetailRow("Chassi (VIN)", d.vin)

                    Text(text = "Veículo", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(onClick = { showVehiclePicker = true }, modifier = Modifier.weight(1f)) {
                            Text(
                                customerModels.find { it.id_customer_model == idCustomerModelEdit }?.let { modelLabel(it) }
                                    ?: "${d.model_name ?: "-"} · ${d.plate_number ?: "-"}",
                            )
                        }
                        OutlinedButton(onClick = { newVehicleError = null; showNewVehicleDialog = true }) {
                            Text("+ Novo")
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    Text(text = "Status", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedButton(onClick = { showStatusPicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(statusLabel(statusEdit))
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    Text(text = "Técnico", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedButton(onClick = { showTechnicianPicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            technicians.find { it.id_technician == idTechnicianEdit }?.let { technicianLabel(it) }
                                ?: d.technician_name
                                ?: "Selecionar técnico",
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    EditableDateTimeRow("Data/Hora Entrada", dateTimeInEdit, clearable = false) { dateTimeInEdit = it }
                    EditableDateTimeRow("Data/Hora Saída", dateTimeOutEdit, clearable = true) { dateTimeOutEdit = it }

                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = odometerEdit,
                        onValueChange = { odometerEdit = it.filter { c -> c.isDigit() } },
                        label = { Text("Hodômetro (km)") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = customerNotesEdit,
                        onValueChange = { customerNotesEdit = it },
                        label = { Text("Obs. do Cliente") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = internalNotesEdit,
                        onValueChange = { internalNotesEdit = it },
                        label = { Text("Obs. Internas") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = diagnosisNotesEdit,
                        onValueChange = { diagnosisNotesEdit = it },
                        label = { Text("Diagnóstico") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(text = "Serviços", style = MaterialTheme.typography.titleSmall)
                        TextButton(onClick = { editingService = null; serviceLineError = null; showServiceDialog = true }) {
                            Text("+ Adicionar")
                        }
                    }
                    if (services.isEmpty()) {
                        Text(text = "Nenhum serviço adicionado.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    services.forEach { s ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { editingService = s; serviceLineError = null; showServiceDialog = true }
                                .padding(vertical = 8.dp),
                        ) {
                            Text(text = s.description ?: "-", style = MaterialTheme.typography.bodyMedium)
                            Text(
                                text = "${s.hours_quantity ?: 0} h · ${s.technician_name ?: "sem técnico"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(text = "Produtos", style = MaterialTheme.typography.titleSmall)
                        TextButton(onClick = { editingProduct = null; productLineError = null; showProductDialog = true }) {
                            Text("+ Adicionar")
                        }
                    }
                    if (products.isEmpty()) {
                        Text(text = "Nenhuma peça adicionada.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    products.forEach { p ->
                        val inv = inventory.find { it.id_product == p.id_product }
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { editingProduct = p; productLineError = null; showProductDialog = true }
                                .padding(vertical = 8.dp),
                        ) {
                            Text(text = p.product_name ?: inv?.name ?: "Produto #${p.id_product}", style = MaterialTheme.typography.bodyMedium)
                            Text(
                                text = "Quantidade: ${p.quantity ?: 0}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    if (payments.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(text = "Pagamentos", style = MaterialTheme.typography.titleSmall)
                        payments.forEach { p ->
                            Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                                Text(text = p.payment_method_description ?: "-", style = MaterialTheme.typography.bodyMedium)
                                Text(
                                    text = "Venc: ${fmtDateOnlyBR(p.due_date)} · Pago: ${fmtDateOnlyBR(p.payment_date)} · ${fmtBRL(p.value)}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    val totalAmount = d.total_amount ?: 0.0
                    val discount = d.discount ?: 0.0
                    val finalAmount = d.final_amount ?: (totalAmount - discount)
                    val totalPago = payments.filter { !it.payment_date.isNullOrBlank() }.sumOf { it.value ?: 0.0 }
                    val totalAberto = finalAmount - totalPago

                    Spacer(modifier = Modifier.height(16.dp))
                    DetailRow("Total OS", fmtBRL(totalAmount))
                    if (discount != 0.0) DetailRow("Desconto", fmtBRL(discount))
                    DetailRow("Valor Final", fmtBRL(finalAmount))
                    DetailRow("Total Pago", fmtBRL(totalPago))
                    DetailRow("Total Aberto", fmtBRL(totalAberto))

                    Spacer(modifier = Modifier.height(20.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { onOpenImages(order) }) { Text("Fotos") }
                        if (sendWppEnabled) {
                            Button(onClick = { showWppDialog = true }) { Text("WhatsApp") }
                        }
                    }

                    if (saveError != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(text = saveError!!, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { save() }, enabled = !saving, modifier = Modifier.fillMaxWidth()) {
                        if (saving) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Text("Salvar Alterações")
                        }
                    }
                }
            }
        }

        if (showWppDialog) {
            WppSendDialog(
                serverUrl = serverUrl,
                token = token,
                orderId = order.id_order,
                customerName = detail?.customer_name,
                onDismiss = { showWppDialog = false },
            )
        }

        if (showStatusPicker) {
            PickerDialog(
                title = "Selecionar status",
                options = listOf(0, 1, 2, 3, 4, 5),
                labelOf = { statusLabel(it) },
                onSelect = {
                    statusEdit = it
                    showStatusPicker = false
                },
                onDismiss = { showStatusPicker = false },
            )
        }

        if (showTechnicianPicker) {
            PickerDialog(
                title = "Selecionar técnico",
                options = technicians,
                labelOf = { technicianLabel(it) },
                onSelect = {
                    idTechnicianEdit = it.id_technician
                    showTechnicianPicker = false
                },
                onDismiss = { showTechnicianPicker = false },
            )
        }

        if (showVehiclePicker) {
            PickerDialog(
                title = "Selecionar veículo",
                options = customerModels.filter { it.id_customer == detail?.id_customer },
                labelOf = { modelLabel(it) },
                onSelect = {
                    idCustomerModelEdit = it.id_customer_model
                    showVehiclePicker = false
                },
                onDismiss = { showVehiclePicker = false },
            )
        }

        if (showNewVehicleDialog && detail?.id_customer != null) {
            NewVehicleDialog(
                idCustomer = detail!!.id_customer!!,
                makes = vehicleMakes,
                models = vehicleModels,
                saving = newVehicleSaving,
                error = newVehicleError,
                serverUrl = serverUrl,
                token = token,
                onDismiss = { showNewVehicleDialog = false },
                onConfirm = { request, modelName ->
                    newVehicleSaving = true
                    newVehicleError = null
                    lifecycleScope.launch {
                        val result = withContext(Dispatchers.IO) { createCustomerModel(serverUrl, token, request) }
                        newVehicleSaving = false
                        result
                            .onSuccess { created ->
                                val newModel = CustomerModelBrief(
                                    id_customer_model = created.id_customer_model,
                                    id_customer = request.id_customer,
                                    model_name = modelName,
                                    plate = request.plate,
                                )
                                customerModels = customerModels + newModel
                                idCustomerModelEdit = newModel.id_customer_model
                                showNewVehicleDialog = false
                            }
                            .onFailure { newVehicleError = it.message ?: "Erro ao cadastrar veículo" }
                    }
                },
            )
        }

        if (showServiceDialog) {
            ServiceLineDialog(
                editing = editingService,
                technicians = technicians,
                saving = serviceLineSaving,
                error = serviceLineError,
                onDismiss = { showServiceDialog = false; editingService = null },
                onConfirm = { description, hours, idTechnician -> saveServiceLine(description, hours, idTechnician) },
            )
        }

        if (showProductDialog) {
            ProductLineDialog(
                editing = editingProduct,
                inventory = inventory,
                saving = productLineSaving,
                error = productLineError,
                onDismiss = { showProductDialog = false; editingProduct = null },
                onConfirm = { idProduct, quantity -> saveProductLine(idProduct, quantity) },
            )
        }
    }

    @Composable
    private fun ServiceLineDialog(
        editing: ServiceItem?,
        technicians: List<TechnicianBrief>,
        saving: Boolean,
        error: String?,
        onDismiss: () -> Unit,
        onConfirm: (description: String, hours: Double?, idTechnician: Int?) -> Unit,
    ) {
        var description by remember { mutableStateOf(editing?.description ?: "") }
        var hours by remember { mutableStateOf(editing?.hours_quantity?.toString() ?: "") }
        var idTechnician by remember { mutableStateOf(editing?.id_technician) }
        var showTechnicianPicker by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(if (editing == null) "Adicionar Serviço" else "Editar Serviço") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Serviço") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 2,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = hours,
                        onValueChange = { hours = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Total de horas") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Técnico", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedButton(onClick = { showTechnicianPicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(
                            technicians.find { it.id_technician == idTechnician }?.let { technicianLabel(it) }
                                ?: editing?.technician_name
                                ?: "Selecionar técnico",
                        )
                    }
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = description.isNotBlank(),
                        onClick = { onConfirm(description, hours.replace(",", ".").toDoubleOrNull(), idTechnician) },
                    ) { Text("Salvar") }
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )

        if (showTechnicianPicker) {
            PickerDialog(
                title = "Selecionar técnico",
                options = technicians,
                labelOf = { technicianLabel(it) },
                onSelect = {
                    idTechnician = it.id_technician
                    showTechnicianPicker = false
                },
                onDismiss = { showTechnicianPicker = false },
            )
        }
    }

    @Composable
    private fun ProductLineDialog(
        editing: ServiceOrderProductItem?,
        inventory: List<InventoryProduct>,
        saving: Boolean,
        error: String?,
        onDismiss: () -> Unit,
        onConfirm: (idProduct: Int, quantity: Double) -> Unit,
    ) {
        var idProduct by remember { mutableStateOf(editing?.id_product) }
        var productLabel by remember {
            mutableStateOf(
                editing?.let { e -> inventory.find { it.id_product == e.id_product }?.name ?: e.product_name } ?: "",
            )
        }
        var quantity by remember { mutableStateOf(editing?.quantity?.toString() ?: "") }
        var showProductPicker by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(if (editing == null) "Adicionar Peça" else "Editar Peça") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text(text = "Peça", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    OutlinedButton(onClick = { showProductPicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(productLabel.ifBlank { "Selecionar peça" })
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = quantity,
                        onValueChange = { quantity = it.filter { c -> c.isDigit() || c == '.' || c == ',' } },
                        label = { Text("Quantidade") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = idProduct != null && quantity.replace(",", ".").toDoubleOrNull() != null,
                        onClick = { onConfirm(idProduct!!, quantity.replace(",", ".").toDouble()) },
                    ) { Text("Salvar") }
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )

        if (showProductPicker) {
            PickerDialog(
                title = "Selecionar peça",
                options = inventory,
                labelOf = { p -> "${p.name ?: "Produto #${p.id_product}"} (${p.current_quantity ?: 0} em estoque)" },
                onSelect = {
                    idProduct = it.id_product
                    productLabel = it.name ?: "Produto #${it.id_product}"
                    showProductPicker = false
                },
                onDismiss = { showProductPicker = false },
            )
        }
    }

    @Composable
    private fun WppSendDialog(
        serverUrl: String,
        token: String,
        orderId: Int,
        customerName: String?,
        onDismiss: () -> Unit,
    ) {
        var sending by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var noPhone by remember { mutableStateOf(false) }
        var manualPhone by remember { mutableStateOf("") }
        var sent by remember { mutableStateOf(false) }

        fun send(phoneOverride: String) {
            sending = true
            error = null
            lifecycleScope.launch {
                val result = withContext(Dispatchers.IO) { sendServiceOrderWhatsApp(serverUrl, token, orderId, phoneOverride) }
                sending = false
                when (result) {
                    is WppSendResult.Success -> sent = true
                    is WppSendResult.NoPhone -> noPhone = true
                    is WppSendResult.Error -> error = result.message
                }
            }
        }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Enviar OS #$orderId via WhatsApp") },
            text = {
                when {
                    sent -> Text("PDF enviado com sucesso!", color = MaterialTheme.colorScheme.primary)
                    noPhone -> Column {
                        Text(
                            text = "O cliente não possui número de WhatsApp cadastrado. Informe o número abaixo:",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = manualPhone,
                            onValueChange = { manualPhone = it },
                            label = { Text("Número (com DDI e DDD)") },
                            placeholder = { Text("Ex: 5511999999999") },
                            singleLine = true,
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth(),
                        )
                        if (error != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = error!!, color = MaterialTheme.colorScheme.error)
                        }
                    }
                    else -> Column {
                        Text(
                            text = "O PDF da OS #$orderId será enviado para o WhatsApp cadastrado" +
                                (if (!customerName.isNullOrBlank()) " do cliente $customerName." else "."),
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (error != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(text = error!!, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            },
            confirmButton = {
                when {
                    sent -> TextButton(onClick = onDismiss) { Text("Fechar") }
                    noPhone -> TextButton(onClick = { send(manualPhone) }, enabled = !sending && manualPhone.isNotBlank()) {
                        Text(if (sending) "Enviando..." else "Enviar")
                    }
                    else -> TextButton(onClick = { send("") }, enabled = !sending) {
                        Text(if (sending) "Enviando..." else "Confirmar Envio")
                    }
                }
            },
            dismissButton = {
                if (!sent) TextButton(onClick = onDismiss) { Text("Cancelar") }
            },
        )
    }

    // ── New Service Order: "Abrir OS", mirrors the web ServiceOrderForm's
    // customer/vehicle/technician selection for a quick-open flow on mobile.

    @Composable
    private fun NewServiceOrderScreen(
        serverUrl: String,
        token: String,
        onBack: () -> Unit,
        onCreated: (ServiceOrderSummary) -> Unit,
    ) {
        var customers by remember { mutableStateOf<List<CustomerBrief>>(emptyList()) }
        var models by remember { mutableStateOf<List<CustomerModelBrief>>(emptyList()) }
        var technicians by remember { mutableStateOf<List<TechnicianBrief>>(emptyList()) }
        var vehicleMakes by remember { mutableStateOf<List<VehicleMakeBrief>>(emptyList()) }
        var vehicleModels by remember { mutableStateOf<List<VehicleModelBrief>>(emptyList()) }
        var loadingLists by remember { mutableStateOf(true) }
        var loadError by remember { mutableStateOf<String?>(null) }

        var selectedCustomer by remember { mutableStateOf<CustomerBrief?>(null) }
        var selectedModel by remember { mutableStateOf<CustomerModelBrief?>(null) }
        var selectedTechnician by remember { mutableStateOf<TechnicianBrief?>(null) }
        var notes by remember { mutableStateOf("") }

        var showCustomerPicker by remember { mutableStateOf(false) }
        var showModelPicker by remember { mutableStateOf(false) }
        var showTechnicianPicker by remember { mutableStateOf(false) }
        var showNewCustomerDialog by remember { mutableStateOf(false) }
        var newCustomerSaving by remember { mutableStateOf(false) }
        var newCustomerError by remember { mutableStateOf<String?>(null) }
        var showNewVehicleDialog by remember { mutableStateOf(false) }
        var newVehicleSaving by remember { mutableStateOf(false) }
        var newVehicleError by remember { mutableStateOf<String?>(null) }

        var saving by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var errorDetail by remember { mutableStateOf<String?>(null) }
        var showErrorDetail by remember { mutableStateOf(false) }

        LaunchedEffect(Unit) {
            val customersResult = withContext(Dispatchers.IO) { fetchCustomers(serverUrl, token) }
            val modelsResult = withContext(Dispatchers.IO) { fetchCustomerModels(serverUrl, token) }
            val techResult = withContext(Dispatchers.IO) { fetchTechnicians(serverUrl, token) }
            val makesResult = withContext(Dispatchers.IO) { fetchVehicleMakes(serverUrl, token) }
            val vehicleModelsResult = withContext(Dispatchers.IO) { fetchVehicleModels(serverUrl, token) }
            loadingLists = false
            customersResult.onSuccess { customers = it }.onFailure { loadError = it.message }
            modelsResult.onFailure { loadError = loadError ?: it.message }
            models = modelsResult.getOrDefault(emptyList())
            technicians = techResult.getOrDefault(emptyList())
            vehicleMakes = makesResult.getOrDefault(emptyList())
            vehicleModels = vehicleModelsResult.getOrDefault(emptyList())
        }

        val modelsForCustomer = remember(models, selectedCustomer) {
            val customerId = selectedCustomer?.id_customer
            if (customerId == null) emptyList() else models.filter { it.id_customer == customerId }
        }

        LaunchedEffect(selectedCustomer) {
            if (selectedModel != null && selectedModel?.id_customer != selectedCustomer?.id_customer) {
                selectedModel = null
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "Abrir OS", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }
            Spacer(modifier = Modifier.height(24.dp))

            if (loadingLists) {
                CircularProgressIndicator()
            } else {
                if (loadError != null) {
                    Text(text = loadError!!, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 12.dp))
                }

                Text(text = "Cliente", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = { showCustomerPicker = true }, modifier = Modifier.weight(1f)) {
                        Text(selectedCustomer?.let { customerLabel(it) } ?: "Selecionar cliente")
                    }
                    OutlinedButton(onClick = { newCustomerError = null; showNewCustomerDialog = true }) {
                        Text("+ Novo")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(text = "Veículo", style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(
                        onClick = { showModelPicker = true },
                        enabled = selectedCustomer != null,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            selectedModel?.let { modelLabel(it) }
                                ?: if (selectedCustomer == null) "Selecione um cliente primeiro" else "Selecionar veículo",
                        )
                    }
                    OutlinedButton(
                        onClick = { newVehicleError = null; showNewVehicleDialog = true },
                        enabled = selectedCustomer != null,
                    ) {
                        Text("+ Novo")
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(text = "Técnico (opcional)", style = MaterialTheme.typography.labelLarge)
                OutlinedButton(onClick = { showTechnicianPicker = true }, modifier = Modifier.fillMaxWidth()) {
                    Text(selectedTechnician?.let { technicianLabel(it) } ?: "Selecionar técnico")
                }

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Observações do cliente") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                )

                if (error != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = error!! + if (errorDetail != null) " (toque para detalhes)" else "",
                        color = MaterialTheme.colorScheme.error,
                        modifier = if (errorDetail != null) {
                            Modifier.clickable { showErrorDetail = true }
                        } else {
                            Modifier
                        },
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        val customer = selectedCustomer
                        val model = selectedModel
                        if (customer == null || model == null) return@Button
                        error = null
                        errorDetail = null
                        saving = true
                        lifecycleScope.launch {
                            val request = NewServiceOrderRequest(
                                id_customer = customer.id_customer,
                                id_customer_model = model.id_customer_model,
                                id_technician = selectedTechnician?.id_technician,
                                date_time_in = nowSqlDateTime(),
                                customer_notes = notes.ifBlank { null },
                            )
                            val result = withContext(Dispatchers.IO) { createServiceOrder(serverUrl, token, request) }
                            saving = false
                            result
                                .onSuccess { created ->
                                    onCreated(
                                        ServiceOrderSummary(
                                            id_order = created.id_order,
                                            customer_name = customerLabel(customer),
                                            model_name = model.model_name,
                                            plate_number = model.plate,
                                            status = 0,
                                        ),
                                    )
                                }
                                .onFailure {
                                    error = it.message ?: "Erro ao abrir OS"
                                    errorDetail = (it as? ApiException)?.detail
                                }
                        }
                    },
                    enabled = selectedCustomer != null && selectedModel != null && !saving,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (saving) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    } else {
                        Text("Abrir OS")
                    }
                }
            }
        }

        if (showErrorDetail && errorDetail != null) {
            AlertDialog(
                onDismissRequest = { showErrorDetail = false },
                title = { Text("Detalhe do erro") },
                text = { Text(errorDetail!!) },
                confirmButton = {
                    TextButton(onClick = { showErrorDetail = false }) { Text("Fechar") }
                },
            )
        }

        if (showCustomerPicker) {
            PickerDialog(
                title = "Selecionar cliente",
                options = customers,
                labelOf = { customerLabel(it) },
                onSelect = {
                    selectedCustomer = it
                    showCustomerPicker = false
                },
                onDismiss = { showCustomerPicker = false },
            )
        }

        if (showModelPicker) {
            PickerDialog(
                title = "Selecionar veículo",
                options = modelsForCustomer,
                labelOf = { modelLabel(it) },
                onSelect = {
                    selectedModel = it
                    showModelPicker = false
                },
                onDismiss = { showModelPicker = false },
            )
        }

        if (showTechnicianPicker) {
            PickerDialog(
                title = "Selecionar técnico",
                options = technicians,
                labelOf = { technicianLabel(it) },
                onSelect = {
                    selectedTechnician = it
                    showTechnicianPicker = false
                },
                onDismiss = { showTechnicianPicker = false },
            )
        }

        if (showNewCustomerDialog) {
            NewCustomerDialog(
                saving = newCustomerSaving,
                error = newCustomerError,
                onDismiss = { showNewCustomerDialog = false },
                onConfirm = { request ->
                    newCustomerSaving = true
                    newCustomerError = null
                    lifecycleScope.launch {
                        val result = withContext(Dispatchers.IO) { createCustomer(serverUrl, token, request) }
                        newCustomerSaving = false
                        result
                            .onSuccess { created ->
                                val newCustomer = CustomerBrief(
                                    id_customer = created.id_customer,
                                    individual_name = request.individual_name,
                                    trade_name = request.trade_name,
                                    legal_name = request.legal_name,
                                )
                                customers = customers + newCustomer
                                selectedCustomer = newCustomer
                                showNewCustomerDialog = false
                            }
                            .onFailure { newCustomerError = it.message ?: "Erro ao cadastrar cliente" }
                    }
                },
            )
        }

        if (showNewVehicleDialog && selectedCustomer != null) {
            NewVehicleDialog(
                idCustomer = selectedCustomer!!.id_customer,
                makes = vehicleMakes,
                models = vehicleModels,
                saving = newVehicleSaving,
                error = newVehicleError,
                serverUrl = serverUrl,
                token = token,
                onDismiss = { showNewVehicleDialog = false },
                onConfirm = { request, modelName ->
                    newVehicleSaving = true
                    newVehicleError = null
                    lifecycleScope.launch {
                        val result = withContext(Dispatchers.IO) { createCustomerModel(serverUrl, token, request) }
                        newVehicleSaving = false
                        result
                            .onSuccess { created ->
                                val newModel = CustomerModelBrief(
                                    id_customer_model = created.id_customer_model,
                                    id_customer = request.id_customer,
                                    model_name = modelName,
                                    plate = request.plate,
                                )
                                models = models + newModel
                                selectedModel = newModel
                                showNewVehicleDialog = false
                            }
                            .onFailure { newVehicleError = it.message ?: "Erro ao cadastrar veículo" }
                    }
                },
            )
        }
    }

    @Composable
    private fun NewCustomerDialog(
        saving: Boolean,
        error: String?,
        onDismiss: () -> Unit,
        onConfirm: (NewCustomerRequest) -> Unit,
    ) {
        var isLegalPerson by remember { mutableStateOf(false) }
        var individualName by remember { mutableStateOf("") }
        var legalName by remember { mutableStateOf("") }
        var tradeName by remember { mutableStateOf("") }
        var taxId by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Novo Cliente") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = !isLegalPerson, onClick = { isLegalPerson = false })
                        Text(
                            text = "Pessoa Física",
                            modifier = Modifier
                                .clickable { isLegalPerson = false }
                                .padding(end = 12.dp),
                        )
                        RadioButton(selected = isLegalPerson, onClick = { isLegalPerson = true })
                        Text(
                            text = "Pessoa Jurídica",
                            modifier = Modifier.clickable { isLegalPerson = true },
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    if (isLegalPerson) {
                        OutlinedTextField(
                            value = legalName,
                            onValueChange = { legalName = it },
                            label = { Text("Razão Social") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = tradeName,
                            onValueChange = { tradeName = it },
                            label = { Text("Nome Fantasia") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        OutlinedTextField(
                            value = individualName,
                            onValueChange = { individualName = it },
                            label = { Text("Nome completo") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = taxId,
                        onValueChange = { taxId = it },
                        label = { Text(if (isLegalPerson) "CNPJ" else "CPF") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = if (isLegalPerson) legalName.isNotBlank() else individualName.isNotBlank(),
                        onClick = {
                            onConfirm(
                                NewCustomerRequest(
                                    is_legal_person = isLegalPerson,
                                    individual_name = individualName.ifBlank { null },
                                    legal_name = legalName.ifBlank { null },
                                    trade_name = tradeName.ifBlank { null },
                                    tax_id = taxId.ifBlank { null },
                                ),
                            )
                        },
                    ) { Text("Salvar") }
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )
    }

    @Composable
    private fun NewVehicleDialog(
        idCustomer: Int,
        makes: List<VehicleMakeBrief>,
        models: List<VehicleModelBrief>,
        saving: Boolean,
        error: String?,
        serverUrl: String,
        token: String,
        onDismiss: () -> Unit,
        onConfirm: (NewCustomerModelRequest, modelName: String?) -> Unit,
    ) {
        val context = LocalContext.current
        var selectedMake by remember { mutableStateOf<VehicleMakeBrief?>(null) }
        var selectedModel by remember { mutableStateOf<VehicleModelBrief?>(null) }
        var plate by remember { mutableStateOf("") }
        var yearMake by remember { mutableStateOf("") }
        var yearModel by remember { mutableStateOf("") }
        var color by remember { mutableStateOf("") }
        var chassis by remember { mutableStateOf("") }
        var showMakePicker by remember { mutableStateOf(false) }
        var showModelPicker by remember { mutableStateOf(false) }
        var scanning by remember { mutableStateOf(false) }
        var scanError by remember { mutableStateOf<String?>(null) }
        var showPlateCamera by remember { mutableStateOf(false) }

        val modelsForMake = remember(models, selectedMake) {
            val makeId = selectedMake?.id_make
            if (makeId == null) emptyList() else models.filter { it.id_make == makeId }
        }

        LaunchedEffect(selectedMake) {
            if (selectedModel != null && selectedModel?.id_make != selectedMake?.id_make) {
                selectedModel = null
            }
        }

        fun applyLookupResult(result: VehicleLookupResponse) {
            if (!result.plate.isNullOrBlank()) plate = result.plate
            if (!result.year_make.isNullOrBlank()) yearMake = result.year_make
            if (!result.year_model.isNullOrBlank()) yearModel = result.year_model
            if (!result.color.isNullOrBlank()) color = result.color
            if (!result.chassis.isNullOrBlank()) chassis = result.chassis
            val matchedMake = findMatchingMake(makes, result.brand)
            selectedMake = matchedMake
            selectedModel = findMatchingModel(models, matchedMake?.id_make, result.model, result.sub_model)
        }

        fun runPlateLookup(plateValue: String) {
            lifecycleScope.launch {
                val result = withContext(Dispatchers.IO) { lookupVehicleByPlate(serverUrl, token, plateValue) }
                scanning = false
                result
                    .onSuccess { applyLookupResult(it) }
                    .onFailure { scanError = it.message ?: "Erro ao consultar placa" }
            }
        }

        fun recognizePlate(uri: Uri) {
            try {
                val image = InputImage.fromFilePath(context, uri)
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                recognizer.process(image)
                    .addOnSuccessListener { visionText ->
                        val plateFound = extractPlateFromText(visionText.text)
                        if (plateFound != null) {
                            runPlateLookup(plateFound)
                        } else {
                            scanning = false
                            scanError = "Não foi possível ler a placa na foto. Tente novamente."
                        }
                    }
                    .addOnFailureListener {
                        scanning = false
                        scanError = "Erro ao processar a imagem: ${it.message}"
                    }
                    .addOnCompleteListener {
                        recognizer.close()
                    }
            } catch (e: Exception) {
                scanning = false
                scanError = "Erro ao processar a imagem: ${e.message}"
            }
        }

        fun launchPlateCamera() {
            scanError = null
            scanning = true
            showPlateCamera = true
        }

        if (showPlateCamera) {
            CameraCaptureScreen(
                outputFile = {
                    val dir = File(context.cacheDir, "plates").apply { mkdirs() }
                    File(dir, "PLATE_${System.currentTimeMillis()}.jpg")
                },
                onCaptured = { uri ->
                    showPlateCamera = false
                    recognizePlate(uri)
                },
                onCancel = {
                    showPlateCamera = false
                    scanning = false
                },
            )
        } else {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Novo Veículo do Cliente") },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Button(
                        onClick = { launchPlateCamera() },
                        enabled = !scanning,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (scanning) {
                            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Consultando...")
                        } else {
                            Text("📷 Escanear Placa")
                        }
                    }
                    if (scanError != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(text = scanError ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "Marca", style = MaterialTheme.typography.labelMedium)
                    OutlinedButton(onClick = { showMakePicker = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(selectedMake?.name ?: "Selecionar marca")
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Modelo", style = MaterialTheme.typography.labelMedium)
                    OutlinedButton(
                        onClick = { showModelPicker = true },
                        enabled = selectedMake != null,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            selectedModel?.let { vehicleModelLabel(it) }
                                ?: if (selectedMake == null) "Selecione uma marca primeiro" else "Selecionar modelo",
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = plate,
                        onValueChange = { plate = it },
                        label = { Text("Placa") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = yearMake,
                        onValueChange = { yearMake = it },
                        label = { Text("Ano Fabricação") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = yearModel,
                        onValueChange = { yearModel = it },
                        label = { Text("Ano Modelo") },
                        singleLine = true,
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = color,
                        onValueChange = { color = it },
                        label = { Text("Cor") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = chassis,
                        onValueChange = { chassis = it },
                        label = { Text("Chassi") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (error != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = error, color = MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                if (saving) {
                    CircularProgressIndicator(modifier = Modifier.padding(8.dp))
                } else {
                    TextButton(
                        enabled = selectedModel != null,
                        onClick = {
                            val model = selectedModel ?: return@TextButton
                            onConfirm(
                                NewCustomerModelRequest(
                                    id_customer = idCustomer,
                                    id_model = model.id_model,
                                    plate = plate.ifBlank { null },
                                    year_make = yearMake.toIntOrNull(),
                                    year_model = yearModel.toIntOrNull(),
                                    color = color.ifBlank { null },
                                    vin = chassis.ifBlank { null },
                                ),
                                vehicleModelLabel(model),
                            )
                        },
                    ) { Text("Salvar") }
                }
            },
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )
        }

        if (showMakePicker) {
            PickerDialog(
                title = "Selecionar marca",
                options = makes,
                labelOf = { it.name ?: "Marca #${it.id_make}" },
                onSelect = {
                    selectedMake = it
                    showMakePicker = false
                },
                onDismiss = { showMakePicker = false },
            )
        }

        if (showModelPicker) {
            PickerDialog(
                title = "Selecionar modelo",
                options = modelsForMake,
                labelOf = { vehicleModelLabel(it) },
                onSelect = {
                    selectedModel = it
                    showModelPicker = false
                },
                onDismiss = { showModelPicker = false },
            )
        }
    }

    @Composable
    private fun <T> PickerDialog(
        title: String,
        options: List<T>,
        labelOf: (T) -> String,
        onSelect: (T) -> Unit,
        onDismiss: () -> Unit,
    ) {
        var query by remember { mutableStateOf("") }
        val filtered = remember(options, query) {
            if (query.isBlank()) options else options.filter { labelOf(it).contains(query, ignoreCase = true) }
        }

        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text(title) },
            text = {
                Column {
                    OutlinedTextField(
                        value = query,
                        onValueChange = { query = it },
                        label = { Text("Buscar") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    LazyColumn(modifier = Modifier.heightIn(max = 320.dp)) {
                        if (filtered.isEmpty()) {
                            item { Text(text = "Nenhum resultado", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                        items(filtered) { option ->
                            Text(
                                text = labelOf(option),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect(option) }
                                    .padding(vertical = 12.dp),
                            )
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
        )
    }

    private suspend fun fetchCustomers(serverUrl: String, token: String): Result<List<CustomerBrief>> {
        return try {
            val response = api.getCustomers("$serverUrl/customers", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar clientes"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchCustomerModels(serverUrl: String, token: String): Result<List<CustomerModelBrief>> {
        return try {
            val response = api.getCustomerModels("$serverUrl/customer-models", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar veículos"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchTechnicians(serverUrl: String, token: String): Result<List<TechnicianBrief>> {
        return try {
            val response = api.getTechnicians("$serverUrl/technicians", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar técnicos"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun createServiceOrder(serverUrl: String, token: String, request: NewServiceOrderRequest): Result<ServiceOrderCreateResponse> {
        return try {
            val response = api.createServiceOrder("$serverUrl/service-orders", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao abrir OS (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível abrir OS: ${e.message}"))
        }
    }

    private fun extractErrorDetail(raw: String): String {
        return try {
            JSONObject(raw).optString("error").ifBlank { raw }
        } catch (e: Exception) {
            raw
        }
    }

    private suspend fun fetchVehicleMakes(serverUrl: String, token: String): Result<List<VehicleMakeBrief>> {
        return try {
            val response = api.getVehicleMakes("$serverUrl/makes", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar marcas"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchVehicleModels(serverUrl: String, token: String): Result<List<VehicleModelBrief>> {
        return try {
            val response = api.getVehicleModels("$serverUrl/models", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar modelos"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun lookupVehicleByPlate(serverUrl: String, token: String, plate: String): Result<VehicleLookupResponse> {
        return try {
            val response = api.getVehicleLookup("$serverUrl/vehicle-lookup/$plate", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Veículo não encontrado para esta placa (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível consultar a placa: ${e.message}"))
        }
    }

    private suspend fun createCustomer(serverUrl: String, token: String, request: NewCustomerRequest): Result<CustomerCreateResponse> {
        return try {
            val response = api.createCustomer("$serverUrl/customers", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Erro ao cadastrar cliente (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível cadastrar cliente: ${e.message}"))
        }
    }

    private suspend fun createCustomerModel(serverUrl: String, token: String, request: NewCustomerModelRequest): Result<CustomerModelCreateResponse> {
        return try {
            val response = api.createCustomerModel("$serverUrl/customer-models", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Erro ao cadastrar veículo (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível cadastrar veículo: ${e.message}"))
        }
    }

    @Composable
    private fun ServiceOrderImagesScreen(
        serverUrl: String,
        token: String,
        order: ServiceOrderSummary,
        onBack: () -> Unit,
    ) {
        val context = LocalContext.current
        var images by remember { mutableStateOf<List<ServiceOrderImageMeta>>(emptyList()) }
        var loading by remember { mutableStateOf(true) }
        var uploading by remember { mutableStateOf(false) }
        var error by remember { mutableStateOf<String?>(null) }
        var showCamera by remember { mutableStateOf(false) }
        var pendingAnnotationBytes by remember { mutableStateOf<ByteArray?>(null) }

        fun reloadImages() {
            lifecycleScope.launch {
                loading = true
                val result = withContext(Dispatchers.IO) { fetchServiceOrderImages(serverUrl, token, order.id_order) }
                loading = false
                result.onSuccess { images = it }.onFailure { error = it.message }
            }
        }

        LaunchedEffect(order.id_order) { reloadImages() }

        fun doUpload(bytes: ByteArray, fileName: String) {
            uploading = true
            error = null
            lifecycleScope.launch {
                val result = withContext(Dispatchers.IO) { uploadImage(serverUrl, token, order.id_order, bytes, fileName) }
                uploading = false
                result.onSuccess { reloadImages() }.onFailure { error = it.message ?: "Erro ao enviar imagem" }
            }
        }

        val galleryLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            if (uri != null) {
                lifecycleScope.launch {
                    val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    if (bytes != null) pendingAnnotationBytes = bytes
                }
            }
        }

        fun launchCamera() {
            showCamera = true
        }

        val imageLoader = remember(serverUrl, token) {
            ImageLoader.Builder(context)
                .okHttpClient {
                    OkHttpClient.Builder()
                        .addInterceptor { chain ->
                            chain.proceed(chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build())
                        }
                        .build()
                }
                .build()
        }

        if (showCamera) {
            CameraCaptureScreen(
                outputFile = {
                    val dir = File(context.cacheDir, "images").apply { mkdirs() }
                    File(dir, "IMG_${System.currentTimeMillis()}.jpg")
                },
                onCaptured = { uri ->
                    showCamera = false
                    lifecycleScope.launch {
                        val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                        if (bytes != null) pendingAnnotationBytes = bytes
                    }
                },
                onCancel = { showCamera = false },
            )
            return
        }

        val annotationBytes = pendingAnnotationBytes
        if (annotationBytes != null) {
            AnnotateImageScreen(
                imageBytes = annotationBytes,
                onCancel = { pendingAnnotationBytes = null },
                onConfirm = { annotated ->
                    pendingAnnotationBytes = null
                    doUpload(annotated, "anotada_${System.currentTimeMillis()}.jpg")
                },
            )
            return
        }

        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = "OS #${order.id_order}", style = MaterialTheme.typography.headlineSmall)
                TextButton(onClick = onBack) { Text("← Voltar") }
            }
            Text(
                text = "${order.customer_name ?: "-"} · ${order.model_name ?: "-"} · ${order.plate_number ?: "-"}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = { launchCamera() }, modifier = Modifier.weight(1f), enabled = !uploading) {
                    Text("Tirar Foto")
                }
                Button(onClick = { galleryLauncher.launch("image/*") }, modifier = Modifier.weight(1f), enabled = !uploading) {
                    Text("Da Galeria")
                }
            }

            if (uploading) {
                Spacer(modifier = Modifier.height(12.dp))
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }
            if (error != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(text = error!!, color = MaterialTheme.colorScheme.error)
            }

            Spacer(modifier = Modifier.height(20.dp))

            when {
                loading -> CircularProgressIndicator()
                images.isEmpty() -> Text(text = "Nenhuma imagem enviada ainda.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else -> LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    gridItems(images) { img ->
                        AsyncImage(
                            model = "$serverUrl/service-order-images/${img.id_image}/file",
                            imageLoader = imageLoader,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(8.dp)),
                        )
                    }
                }
            }
        }
    }

    @Composable
    private fun AnnotateImageScreen(
        imageBytes: ByteArray,
        onCancel: () -> Unit,
        onConfirm: (ByteArray) -> Unit,
    ) {
        val originalBitmap = remember(imageBytes) { decodeSampledBitmap(imageBytes) }
        var strokes by remember { mutableStateOf(listOf<List<Offset>>()) }
        var currentStroke by remember { mutableStateOf(listOf<Offset>()) }
        var canvasSize by remember { mutableStateOf(IntSize.Zero) }

        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Text(text = "Marque arranhões ou imperfeições", style = MaterialTheme.typography.titleMedium)
            Text(
                text = "Desenhe com o dedo sobre a imagem",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(16.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .aspectRatio(originalBitmap.width.toFloat() / originalBitmap.height.toFloat())
                    .clip(RoundedCornerShape(8.dp))
                    .onSizeChanged { canvasSize = it }
                    .pointerInput(Unit) {
                        detectDragGestures(
                            onDragStart = { offset -> currentStroke = listOf(offset) },
                            onDrag = { change, _ -> currentStroke = currentStroke + change.position },
                            onDragEnd = {
                                if (currentStroke.size > 1) strokes = strokes + listOf(currentStroke)
                                currentStroke = emptyList()
                            },
                        )
                    },
            ) {
                Image(
                    bitmap = originalBitmap.asImageBitmap(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.FillBounds,
                )
                Canvas(modifier = Modifier.fillMaxSize()) {
                    for (stroke in strokes + listOf(currentStroke)) {
                        if (stroke.size < 2) continue
                        for (i in 0 until stroke.size - 1) {
                            drawLine(
                                color = Color.Red,
                                start = stroke[i],
                                end = stroke[i + 1],
                                strokeWidth = 8f,
                                cap = StrokeCap.Round,
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedButton(
                    onClick = { strokes = strokes.dropLast(1) },
                    enabled = strokes.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Desfazer")
                }
                OutlinedButton(
                    onClick = { strokes = emptyList() },
                    enabled = strokes.isNotEmpty(),
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Limpar")
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedButton(onClick = onCancel, modifier = Modifier.weight(1f)) {
                    Text("Cancelar")
                }
                Button(
                    onClick = { onConfirm(renderAnnotatedJpeg(originalBitmap, strokes, canvasSize)) },
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Salvar")
                }
            }
        }
    }

    private fun startBarcodeScanner(onCodeScanned: (String) -> Unit) {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(
                Barcode.FORMAT_QR_CODE,
                Barcode.FORMAT_EAN_13,
                Barcode.FORMAT_EAN_8,
                Barcode.FORMAT_UPC_A,
            )
            .enableAutoZoom()
            .build()

        val scanner = GmsBarcodeScanning.getClient(this, options)

        scanner.startScan()
            .addOnSuccessListener { code ->
                val codeValue = code.rawValue
                if (codeValue != null) {
                    onCodeScanned(codeValue)
                } else {
                    Toast.makeText(this, "Não foi possível ler o código.", Toast.LENGTH_SHORT).show()
                }
            }
            .addOnFailureListener { e ->
                Toast.makeText(this, "Scanner cancelado ou erro: ${e.message}", Toast.LENGTH_SHORT).show()
            }
    }

    private suspend fun lookupProduct(serverUrl: String, token: String, code: String): Result<InventoryProduct> {
        return try {
            val response = api.getByBarcode("$serverUrl/inventory/barcode/$code", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("not found"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun lookupExternal(serverUrl: String, token: String, code: String): Result<ExternalProduct> {
        return try {
            val response = api.getExternalLookup("$serverUrl/inventory/external-lookup/$code", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("not found"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Usada quando o backend Savicar está fora do ar: replica a mesma cadeia de
    // busca (Cosmos → UPCItemDB) que normalmente roda no servidor, mas chamando
    // as APIs externas direto do aparelho, sem depender do backend como proxy.
    private suspend fun lookupExternalDirect(code: String): Result<ExternalProduct> {
        lookupCosmosDirect(code).getOrNull()?.let { return Result.success(it) }
        return lookupUpcItemDbDirect(code)
    }

    private suspend fun lookupCosmosDirect(code: String): Result<ExternalProduct> {
        return try {
            val response = api.getCosmosLookup("https://api.cosmos.bluesoft.com.br/gtins/$code", COSMOS_TOKEN)
            val body = response.body()
            if (response.isSuccessful && !body?.description.isNullOrBlank()) {
                Result.success(ExternalProduct(name = body!!.description, brand = body.brand?.name))
            } else {
                Result.failure(Exception("not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun lookupUpcItemDbDirect(code: String): Result<ExternalProduct> {
        return try {
            val response = api.getUpcItemDbLookup("https://api.upcitemdb.com/prod/trial/lookup?upc=$code")
            val item = response.body()?.items?.firstOrNull()
            if (response.isSuccessful && item != null) {
                Result.success(ExternalProduct(name = item.title, brand = item.brand))
            } else {
                Result.failure(Exception("not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun registerProduct(serverUrl: String, token: String, request: NewProductRequest): Result<InventoryProduct> {
        return try {
            val response = api.createProduct("$serverUrl/inventory", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Erro ao cadastrar produto (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível cadastrar: ${e.message}"))
        }
    }

    private suspend fun adjustInventoryQuantity(serverUrl: String, token: String, idProduct: Int, delta: Int): Result<Unit> {
        return try {
            val response = api.adjustInventoryQuantity(
                "$serverUrl/inventory/$idProduct/adjust",
                "Bearer $token",
                AdjustQuantityRequest(delta.toDouble()),
            )
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Erro ao registrar entrada (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível registrar entrada: ${e.message}"))
        }
    }

    private suspend fun fetchServiceOrders(serverUrl: String, token: String): Result<List<ServiceOrderSummary>> {
        return try {
            val response = api.getServiceOrders("$serverUrl/service-orders", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Erro ao buscar ordens de serviço"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchServiceOrderImages(serverUrl: String, token: String, orderId: Int): Result<List<ServiceOrderImageMeta>> {
        return try {
            val response = api.getServiceOrderImages("$serverUrl/service-order-images/order/$orderId", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar imagens"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun uploadImage(
        serverUrl: String,
        token: String,
        orderId: Int,
        bytes: ByteArray,
        fileName: String,
    ): Result<ServiceOrderImageMeta> {
        return try {
            val idOrderBody = orderId.toString().toRequestBody("text/plain".toMediaTypeOrNull())
            val imageBody = bytes.toRequestBody("image/jpeg".toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("image", fileName, imageBody)
            val response = api.uploadServiceOrderImage("$serverUrl/service-order-images", "Bearer $token", idOrderBody, part)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(Exception("Erro ao enviar imagem (HTTP ${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível enviar: ${e.message}"))
        }
    }

    private suspend fun fetchServiceOrderDetail(serverUrl: String, token: String, id: Int): Result<ServiceOrderFull> {
        return try {
            val response = api.getServiceOrderById("$serverUrl/service-orders/$id", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar OS"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    // The backend PUT overwrites every column (including total/discount/final amounts
    // computed elsewhere), so callers must send a full ServiceOrderFull seeded from a
    // prior GET with only the user-edited fields changed — never a partial object.
    private suspend fun updateServiceOrder(serverUrl: String, token: String, id: Int, body: ServiceOrderFull): Result<ServiceOrderFull> {
        return try {
            val response = api.updateServiceOrder("$serverUrl/service-orders/$id", "Bearer $token", body)
            val respBody = response.body()
            if (response.isSuccessful && respBody != null) {
                Result.success(respBody)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao salvar OS (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível salvar: ${e.message}"))
        }
    }

    private suspend fun fetchServicesByOrder(serverUrl: String, token: String, orderId: Int): Result<List<ServiceItem>> {
        return try {
            val response = api.getAllServices("$serverUrl/services", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body.filter { it.id_order == orderId })
            } else {
                Result.failure(Exception("Erro ao buscar serviços"))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchServiceOrderProductsForOrder(serverUrl: String, token: String, orderId: Int): Result<List<ServiceOrderProductItem>> {
        return try {
            val response = api.getServiceOrderProductsByOrder("$serverUrl/service-order-products/order/$orderId", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar produtos"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun createService(serverUrl: String, token: String, request: NewServiceRequest): Result<ServiceItem> {
        return try {
            val response = api.createService("$serverUrl/services", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao adicionar serviço (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível adicionar serviço: ${e.message}"))
        }
    }

    // The backend PUT overwrites every column, including unit_value/total_value that this
    // app never shows — callers must pass a full ServiceItem seeded from a prior GET.
    private suspend fun updateService(serverUrl: String, token: String, id: Int, body: ServiceItem): Result<ServiceItem> {
        return try {
            val response = api.updateService("$serverUrl/services/$id", "Bearer $token", body)
            val respBody = response.body()
            if (response.isSuccessful && respBody != null) {
                Result.success(respBody)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao salvar serviço (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível salvar serviço: ${e.message}"))
        }
    }

    private suspend fun createServiceOrderProduct(serverUrl: String, token: String, request: NewServiceOrderProductRequest): Result<ServiceOrderProductItem> {
        return try {
            val response = api.createServiceOrderProduct("$serverUrl/service-order-products", "Bearer $token", request)
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao adicionar peça (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível adicionar peça: ${e.message}"))
        }
    }

    private suspend fun updateServiceOrderProduct(serverUrl: String, token: String, id: Int, body: ServiceOrderProductItem): Result<ServiceOrderProductItem> {
        return try {
            val response = api.updateServiceOrderProduct("$serverUrl/service-order-products/$id", "Bearer $token", body)
            val respBody = response.body()
            if (response.isSuccessful && respBody != null) {
                Result.success(respBody)
            } else {
                val detail = response.errorBody()?.string()?.let { extractErrorDetail(it) }
                Result.failure(ApiException("Erro ao salvar peça (HTTP ${response.code()})", detail))
            }
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível salvar peça: ${e.message}"))
        }
    }

    private suspend fun fetchPaymentsForOrder(serverUrl: String, token: String, orderId: Int): Result<List<PaymentItem>> {
        return try {
            val response = api.getPaymentsByOrder("$serverUrl/payments/order/$orderId", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar pagamentos"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchInventoryList(serverUrl: String, token: String): Result<List<InventoryProduct>> {
        return try {
            val response = api.getAllInventory("$serverUrl/inventory", "Bearer $token")
            val body = response.body()
            if (response.isSuccessful && body != null) Result.success(body) else Result.failure(Exception("Erro ao buscar estoque"))
        } catch (e: Exception) {
            Result.failure(Exception("Não foi possível conectar ao servidor: ${e.message}"))
        }
    }

    private suspend fun fetchSendWppEnabled(serverUrl: String, token: String): Boolean {
        return try {
            val response = api.getTenantConfig("$serverUrl/tenant-config", "Bearer $token")
            response.body()?.send_wpp == 1
        } catch (e: Exception) {
            false
        }
    }

    private suspend fun sendServiceOrderWhatsApp(serverUrl: String, token: String, orderId: Int, phoneOverride: String): WppSendResult {
        return try {
            val response = api.sendServiceOrderWhatsApp(
                "$serverUrl/whatsapp/send-order",
                "Bearer $token",
                WppSendRequest(orderId, phoneOverride),
            )
            if (response.isSuccessful) {
                WppSendResult.Success(response.body()?.phone ?: "")
            } else {
                val raw = response.errorBody()?.string()
                val json = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
                val code = json?.optString("error")
                if (code == "no_phone") {
                    WppSendResult.NoPhone
                } else {
                    val message = json?.optString("message")?.takeIf { it.isNotBlank() }
                        ?: code?.takeIf { !it.isNullOrBlank() }
                        ?: "Erro ao enviar (HTTP ${response.code()})"
                    WppSendResult.Error(message)
                }
            }
        } catch (e: Exception) {
            WppSendResult.Error("Não foi possível enviar: ${e.message}")
        }
    }
}

private sealed class WppSendResult {
    data class Success(val phone: String) : WppSendResult()
    data object NoPhone : WppSendResult()
    data class Error(val message: String) : WppSendResult()
}

private fun statusLabel(status: Int?): String = when (status) {
    0 -> "Orçamento"
    1 -> "Aberta"
    2 -> "Em Andamento"
    3 -> "Aguardando Peças"
    4 -> "Em Teste"
    5 -> "Concluído"
    else -> "—"
}

private fun customerLabel(c: CustomerBrief): String =
    c.individual_name ?: c.trade_name ?: c.legal_name ?: "Cliente #${c.id_customer}"

private fun modelLabel(m: CustomerModelBrief): String =
    "${m.model_name ?: "-"} · ${m.plate ?: "-"}"

private fun technicianLabel(t: TechnicianBrief): String =
    t.name ?: "Técnico #${t.id_technician}"

private fun vehicleModelLabel(m: VehicleModelBrief): String =
    (m.name ?: "-") + (if (!m.version.isNullOrBlank()) " ${m.version}" else "")

// Captura a foto dentro do próprio app via CameraX, em vez de delegar para o app de câmera
// do sistema. Duas vantagens sobre a intent implícita ACTION_IMAGE_CAPTURE: a lente traseira
// fica garantida via CameraSelector.DEFAULT_BACK_CAMERA (a maioria dos apps de câmera atuais
// ignora os extras que pediam isso na intent implícita), e a Activity nunca sai do primeiro
// plano — então o Android não mata mais o processo nesse fluxo, o que antes apagava o estado
// da tela (ex.: os campos já preenchidos de uma nova OS) quando o app era recriado do zero.
@Composable
private fun CameraCaptureScreen(
    outputFile: () -> File,
    onCaptured: (Uri) -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasCameraPermission = granted
    }
    LaunchedEffect(Unit) {
        if (!hasCameraPermission) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    Dialog(onDismissRequest = onCancel, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
            if (!hasCameraPermission) {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        "É preciso permitir o acesso à câmera para tirar a foto.",
                        color = Color.White,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onCancel) { Text("Cancelar") }
                }
            } else {
                var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            val capture = ImageCapture.Builder().build()
                            imageCapture = capture
                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_BACK_CAMERA,
                                    preview,
                                    capture,
                                )
                            } catch (_: Exception) {
                                // Câmera indisponível (em uso por outro app, etc.) — o botão de
                                // captura simplesmente não fará nada até uma nova composição.
                            }
                        }, ContextCompat.getMainExecutor(ctx))
                        previewView
                    },
                )

                Button(
                    onClick = {
                        val capture = imageCapture ?: return@Button
                        val file = outputFile()
                        val options = ImageCapture.OutputFileOptions.Builder(file).build()
                        capture.takePicture(
                            options,
                            ContextCompat.getMainExecutor(context),
                            object : ImageCapture.OnImageSavedCallback {
                                override fun onImageSaved(outputResults: ImageCapture.OutputFileResults) {
                                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                                    onCaptured(uri)
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    onCancel()
                                }
                            },
                        )
                    },
                    modifier = Modifier.align(Alignment.BottomCenter).padding(32.dp),
                ) { Text("📷 Capturar") }

                TextButton(
                    onClick = onCancel,
                    modifier = Modifier.align(Alignment.TopStart).padding(16.dp),
                ) { Text("Cancelar", color = Color.White) }
            }
        }
    }
}

private val PLATE_REGEX = Regex("^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")

// Extracts a Brazilian plate (old ABC1234 or Mercosul ABC1D23 format) from
// OCR text — tries each line first, then a sliding window over the whole
// text, since the camera photo may also capture other text on the vehicle.
private fun extractPlateFromText(text: String): String? {
    val upper = text.uppercase()
    for (line in upper.lines()) {
        val cleaned = line.replace(Regex("[^A-Z0-9]"), "")
        if (cleaned.length == 7 && PLATE_REGEX.matches(cleaned)) return cleaned
    }
    val wholeCleaned = upper.replace(Regex("[^A-Z0-9]"), "")
    for (i in 0..wholeCleaned.length - 7) {
        val window = wholeCleaned.substring(i, i + 7)
        if (PLATE_REGEX.matches(window)) return window
    }
    return null
}

private fun normalizeForMatch(s: String): String =
    java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{Mn}+"), "")
        .uppercase()
        .trim()

// Best-effort match against the already-loaded make/model catalog. Returns
// null (leave the field blank for manual selection) when nothing lines up —
// the app has no way to create new makes/models on the fly.
private fun findMatchingMake(makes: List<VehicleMakeBrief>, brand: String?): VehicleMakeBrief? {
    val target = normalizeForMatch(brand ?: "")
    if (target.isBlank()) return null
    return makes.firstOrNull { normalizeForMatch(it.name ?: "") == target }
        ?: makes.firstOrNull { m ->
            val name = normalizeForMatch(m.name ?: "")
            name.isNotBlank() && (name.contains(target) || target.contains(name))
        }
}

private fun findMatchingModel(
    models: List<VehicleModelBrief>,
    makeId: Int?,
    modelText: String?,
    subModel: String?,
): VehicleModelBrief? {
    val candidates = if (makeId != null) models.filter { it.id_make == makeId } else models
    if (candidates.isEmpty()) return null
    val targetFull = normalizeForMatch(modelText ?: "")
    val targetSub = normalizeForMatch(subModel ?: "")
    candidates.firstOrNull { normalizeForMatch(vehicleModelLabel(it)) == targetFull }?.let { return it }
    if (targetSub.isNotBlank()) {
        candidates.firstOrNull { normalizeForMatch(it.name ?: "") == targetSub }?.let { return it }
    }
    return candidates.firstOrNull { c ->
        val name = normalizeForMatch(c.name ?: "")
        name.isNotBlank() && targetFull.contains(name)
    }
}

private fun nowSqlDateTime(): String {
    val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
    return fmt.format(java.util.Date())
}

private fun fmtDatetimeBR(value: String?): String? {
    if (value.isNullOrBlank()) return null
    val cleaned = value.replace("T", " ")
    if (cleaned.length < 16) return value
    val bits = cleaned.substring(0, 10).split("-")
    if (bits.size != 3) return value
    return "${bits[2]}/${bits[1]}/${bits[0]} ${cleaned.substring(11, 16)}"
}

private fun fmtDateOnlyBR(value: String?): String {
    if (value.isNullOrBlank()) return "-"
    val bits = value.take(10).split("-")
    return if (bits.size == 3) "${bits[2]}/${bits[1]}/${bits[0]}" else "-"
}

private fun fmtBRL(value: Double?): String =
    java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).format(value ?: 0.0)

// Cap the longest side so huge camera photos don't blow up memory while
// annotating/uploading — plenty of detail remains for marking scratches.
private fun decodeSampledBitmap(bytes: ByteArray, maxDimension: Int = 1600): Bitmap {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sampleSize = 1
    while (bounds.outWidth / sampleSize > maxDimension || bounds.outHeight / sampleSize > maxDimension) {
        sampleSize *= 2
    }
    val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
        ?: throw IllegalArgumentException("Não foi possível ler a imagem")
}

// Flattens the finger-drawn strokes (captured in on-screen canvas coordinates)
// onto a copy of the original bitmap, scaling from canvas space to the
// bitmap's actual pixel space, then encodes the result as JPEG bytes.
private fun renderAnnotatedJpeg(original: Bitmap, strokes: List<List<Offset>>, canvasSize: IntSize): ByteArray {
    val output = original.copy(Bitmap.Config.ARGB_8888, true)
    if (strokes.isNotEmpty() && canvasSize.width > 0 && canvasSize.height > 0) {
        val scaleX = original.width.toFloat() / canvasSize.width.toFloat()
        val scaleY = original.height.toFloat() / canvasSize.height.toFloat()
        val canvas = AndroidCanvas(output)
        val paint = AndroidPaint().apply {
            color = AndroidColor.RED
            strokeWidth = 8f * ((scaleX + scaleY) / 2f)
            style = AndroidPaint.Style.STROKE
            strokeCap = AndroidPaint.Cap.ROUND
            strokeJoin = AndroidPaint.Join.ROUND
            isAntiAlias = true
        }
        for (stroke in strokes) {
            if (stroke.size < 2) continue
            val path = AndroidPath()
            path.moveTo(stroke[0].x * scaleX, stroke[0].y * scaleY)
            for (i in 1 until stroke.size) {
                path.lineTo(stroke[i].x * scaleX, stroke[i].y * scaleY)
            }
            canvas.drawPath(path, paint)
        }
    }
    val out = ByteArrayOutputStream()
    output.compress(Bitmap.CompressFormat.JPEG, 90, out)
    return out.toByteArray()
}

data class LoginRequest(val user_name: String, val password: String)
data class LoginResponse(val token: String, val id_user: Int, val id_tenant: Int, val name: String, val profile: Int)

data class InventoryProduct(
    val id_product: Int,
    val name: String?,
    val code: String?,
    val gtin_ean_code: String?,
    val sales_price: Double?,
    val cost_price: Double?,
    val current_quantity: Int?,
)

data class ExternalProduct(val name: String?, val brand: String?)

data class CosmosLookupResponse(val description: String?, val brand: CosmosBrand?)
data class CosmosBrand(val name: String?)

data class UpcItemDbLookupResponse(val items: List<UpcItemDbItem>?)
data class UpcItemDbItem(val title: String?, val brand: String?)

data class AdjustQuantityRequest(val delta: Double)

data class NewProductRequest(
    val name: String?,
    val code: String?,
    val gtin_ean_code: String?,
    val sales_price: Double?,
    val cost_price: Double?,
    val current_quantity: Int?,
    val product_size: String = "",
)

data class ServiceOrderSummary(
    val id_order: Int,
    val customer_name: String?,
    val model_name: String?,
    val plate_number: String?,
    val status: Int?,
)

data class ServiceOrderImageMeta(
    val id_image: Int,
    val id_order: Int?,
    val image_path: String?,
)

data class ServiceOrderFull(
    val id_order: Int,
    val service_type: Int?,
    val id_customer_model: Int?,
    val date_time_in: String?,
    val date_time_out: String?,
    val plate_number: String?,
    val vin: String?,
    val customer_notes: String?,
    val internal_notes: String?,
    val id_customer: Int?,
    val diagnosis_notes: String?,
    val odometer_reading: Int?,
    val id_technician: Int?,
    val technician_name: String?,
    val customer_name: String?,
    val customer_phone: String?,
    val model_name: String?,
    val total_amount: Double?,
    val discount: Double?,
    val final_amount: Double?,
    val status: Int?,
)

data class ServiceItem(
    val id_service: Int,
    val code: String?,
    val description: String?,
    val hours_quantity: Double?,
    val unit_value: Double?,
    val total_value: Double?,
    val id_order: Int?,
    val id_technician: Int?,
    val technician_name: String?,
    val status: Int?,
)

data class ServiceOrderProductItem(
    val id_service_order_product: Int,
    val id_order: Int?,
    val id_product: Int?,
    val quantity: Double?,
    val product_name: String?,
)

// Mobile only ever sets description/hours/technician — never unit_value or
// total_value, which stay hidden from this app (see ServiceOrderEditScreen).
data class NewServiceRequest(
    val id_order: Int,
    val description: String,
    val hours_quantity: Double?,
    val id_technician: Int?,
)

data class NewServiceOrderProductRequest(
    val id_order: Int,
    val id_product: Int,
    val quantity: Double,
)

data class PaymentItem(
    val id_payment: Int,
    val id_order: Int?,
    val id_payment_method: Int?,
    val payment_method_description: String?,
    val installments_quantity: String?,
    val due_date: String?,
    val payment_date: String?,
    val value: Double?,
)

data class TenantConfigResponse(
    val send_wpp: Int?,
)

data class WppSendRequest(
    val order_id: Int,
    val phone_override: String,
)

data class WppSendResponse(
    val sent: Boolean?,
    val phone: String?,
)

data class CustomerBrief(
    val id_customer: Int,
    val individual_name: String?,
    val trade_name: String?,
    val legal_name: String?,
)

data class CustomerModelBrief(
    val id_customer_model: Int,
    val id_customer: Int,
    val model_name: String?,
    val plate: String?,
)

data class TechnicianBrief(
    val id_technician: Int,
    val name: String?,
)

data class NewServiceOrderRequest(
    val id_customer: Int?,
    val id_customer_model: Int?,
    val id_technician: Int?,
    val date_time_in: String?,
    val customer_notes: String?,
    val status: Int = 0,
)

data class ServiceOrderCreateResponse(val id_order: Int)

class ApiException(message: String, val detail: String?) : Exception(message)

data class VehicleMakeBrief(
    val id_make: Int,
    val name: String?,
)

data class VehicleModelBrief(
    val id_model: Int,
    val id_make: Int?,
    val name: String?,
    val version: String?,
)

data class NewCustomerRequest(
    val is_legal_person: Boolean,
    val is_active: Boolean = true,
    val individual_name: String?,
    val legal_name: String?,
    val trade_name: String?,
    val tax_id: String?,
)

data class CustomerCreateResponse(val id_customer: Int)

data class NewCustomerModelRequest(
    val id_customer: Int,
    val id_model: Int,
    val plate: String?,
    val year_make: Int?,
    val year_model: Int?,
    val color: String?,
    val vin: String?,
)

data class VehicleLookupResponse(
    val plate: String?,
    val brand: String?,
    val model: String?,
    val sub_model: String?,
    val version: String?,
    val year_make: String?,
    val year_model: String?,
    val color: String?,
    val chassis: String?,
)

data class CustomerModelCreateResponse(val id_customer_model: Int)

interface SavicarApi {
    @POST
    suspend fun login(@Url url: String, @Body body: LoginRequest): Response<LoginResponse>

    @GET
    suspend fun getByBarcode(@Url url: String, @Header("Authorization") auth: String): Response<InventoryProduct>

    @GET
    suspend fun getExternalLookup(@Url url: String, @Header("Authorization") auth: String): Response<ExternalProduct>

    @GET
    suspend fun getCosmosLookup(@Url url: String, @Header("X-Cosmos-Token") token: String): Response<CosmosLookupResponse>

    @GET
    suspend fun getUpcItemDbLookup(@Url url: String): Response<UpcItemDbLookupResponse>

    @POST
    suspend fun createProduct(@Url url: String, @Header("Authorization") auth: String, @Body body: NewProductRequest): Response<InventoryProduct>

    @POST
    suspend fun adjustInventoryQuantity(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: AdjustQuantityRequest,
    ): Response<Unit>

    @GET
    suspend fun getServiceOrders(@Url url: String, @Header("Authorization") auth: String): Response<List<ServiceOrderSummary>>

    @POST
    suspend fun createServiceOrder(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: NewServiceOrderRequest,
    ): Response<ServiceOrderCreateResponse>

    @GET
    suspend fun getCustomers(@Url url: String, @Header("Authorization") auth: String): Response<List<CustomerBrief>>

    @GET
    suspend fun getCustomerModels(@Url url: String, @Header("Authorization") auth: String): Response<List<CustomerModelBrief>>

    @GET
    suspend fun getTechnicians(@Url url: String, @Header("Authorization") auth: String): Response<List<TechnicianBrief>>

    @GET
    suspend fun getVehicleMakes(@Url url: String, @Header("Authorization") auth: String): Response<List<VehicleMakeBrief>>

    @GET
    suspend fun getVehicleModels(@Url url: String, @Header("Authorization") auth: String): Response<List<VehicleModelBrief>>

    @GET
    suspend fun getVehicleLookup(@Url url: String, @Header("Authorization") auth: String): Response<VehicleLookupResponse>

    @POST
    suspend fun createCustomer(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: NewCustomerRequest,
    ): Response<CustomerCreateResponse>

    @POST
    suspend fun createCustomerModel(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: NewCustomerModelRequest,
    ): Response<CustomerModelCreateResponse>

    @GET
    suspend fun getServiceOrderImages(@Url url: String, @Header("Authorization") auth: String): Response<List<ServiceOrderImageMeta>>

    @Multipart
    @POST
    suspend fun uploadServiceOrderImage(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Part("id_order") idOrder: okhttp3.RequestBody,
        @Part image: MultipartBody.Part,
    ): Response<ServiceOrderImageMeta>

    @GET
    suspend fun getServiceOrderById(@Url url: String, @Header("Authorization") auth: String): Response<ServiceOrderFull>

    @PUT
    suspend fun updateServiceOrder(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: ServiceOrderFull,
    ): Response<ServiceOrderFull>

    @GET
    suspend fun getAllServices(@Url url: String, @Header("Authorization") auth: String): Response<List<ServiceItem>>

    @POST
    suspend fun createService(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: NewServiceRequest,
    ): Response<ServiceItem>

    @PUT
    suspend fun updateService(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: ServiceItem,
    ): Response<ServiceItem>

    @GET
    suspend fun getServiceOrderProductsByOrder(@Url url: String, @Header("Authorization") auth: String): Response<List<ServiceOrderProductItem>>

    @POST
    suspend fun createServiceOrderProduct(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: NewServiceOrderProductRequest,
    ): Response<ServiceOrderProductItem>

    @PUT
    suspend fun updateServiceOrderProduct(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: ServiceOrderProductItem,
    ): Response<ServiceOrderProductItem>

    @GET
    suspend fun getPaymentsByOrder(@Url url: String, @Header("Authorization") auth: String): Response<List<PaymentItem>>

    @GET
    suspend fun getAllInventory(@Url url: String, @Header("Authorization") auth: String): Response<List<InventoryProduct>>

    @GET
    suspend fun getTenantConfig(@Url url: String, @Header("Authorization") auth: String): Response<TenantConfigResponse>

    @POST
    suspend fun sendServiceOrderWhatsApp(
        @Url url: String,
        @Header("Authorization") auth: String,
        @Body body: WppSendRequest,
    ): Response<WppSendResponse>
}
