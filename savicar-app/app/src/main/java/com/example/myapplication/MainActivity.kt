package com.example.myapplication

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint as AndroidPaint
import android.graphics.Path as AndroidPath
import android.net.Uri
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
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Url
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private const val PREFS_NAME = "savicar_prefs"
private const val DEFAULT_SERVER_URL = "http://10.0.2.2:8080"
private const val BIOMETRIC_KEY_ALIAS = "savicar_biometric_key"
private const val BIOMETRIC_TRANSFORMATION = "AES/GCM/NoPadding"

private sealed class Screen {
    data object Home : Screen()
    data object Scanner : Screen()
    data object ServiceOrders : Screen()
    data class ServiceOrderImages(val order: ServiceOrderSummary) : Screen()
}

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
            var screen by remember { mutableStateOf<Screen>(Screen.Home) }

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
                                onSelectOrder = { order -> screen = Screen.ServiceOrderImages(order) },
                            )
                            is Screen.ServiceOrderImages -> ServiceOrderImagesScreen(
                                serverUrl = serverUrl,
                                token = token!!,
                                order = s.order,
                                onBack = { screen = Screen.ServiceOrders },
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
    }

    @Composable
    private fun HomeScreen(onSelectScanner: () -> Unit, onSelectServiceOrders: () -> Unit, onLogout: () -> Unit) {
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
            ) {
                gridItems(
                    listOf(
                        Triple("📷", "Ler Código de Barras", onSelectScanner),
                        Triple("🔧", "Ordens de Serviço", onSelectServiceOrders),
                    ),
                ) { (icon, label, onClick) ->
                    HomeMenuCard(icon = icon, label = label, onClick = onClick)
                }
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
        var loading by remember { mutableStateOf(false) }
        var showRegisterDialog by remember { mutableStateOf(false) }
        var registerError by remember { mutableStateOf<String?>(null) }

        fun resetLookupState() {
            product = null
            externalSuggestion = null
            notFoundAnywhere = false
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
                    .onFailure {
                        val externalResult = withContext(Dispatchers.IO) { lookupExternal(serverUrl, token, code) }
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

            product?.let { p ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(text = p.name ?: "(sem nome)", style = MaterialTheme.typography.titleMedium)
                        Text(text = "Código interno: ${p.code ?: "-"}")
                        Text(text = "Estoque atual: ${p.current_quantity ?: 0}")
                        Text(text = "Preço de venda: ${p.sales_price?.let { "R$ %.2f".format(it) } ?: "-"}")
                    }
                }
            }

            externalSuggestion?.let { ext ->
                Text(
                    text = "Este código não está cadastrado no estoque.",
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
                Button(onClick = { registerError = null; showRegisterDialog = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Cadastrar produto")
                }
            }

            if (notFoundAnywhere) {
                Text(
                    text = "Produto não encontrado no estoque nem na internet.",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
                Button(onClick = { registerError = null; showRegisterDialog = true }, modifier = Modifier.fillMaxWidth()) {
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
        var pendingCameraUri by remember { mutableStateOf<Uri?>(null) }
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

        val cameraLauncher = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val uri = pendingCameraUri
            if (success && uri != null) {
                lifecycleScope.launch {
                    val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    if (bytes != null) pendingAnnotationBytes = bytes
                }
            }
        }

        fun launchCamera() {
            val dir = File(context.cacheDir, "images").apply { mkdirs() }
            val file = File(dir, "IMG_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            pendingCameraUri = uri
            cameraLauncher.launch(uri)
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

interface SavicarApi {
    @POST
    suspend fun login(@Url url: String, @Body body: LoginRequest): Response<LoginResponse>

    @GET
    suspend fun getByBarcode(@Url url: String, @Header("Authorization") auth: String): Response<InventoryProduct>

    @GET
    suspend fun getExternalLookup(@Url url: String, @Header("Authorization") auth: String): Response<ExternalProduct>

    @POST
    suspend fun createProduct(@Url url: String, @Header("Authorization") auth: String, @Body body: NewProductRequest): Response<InventoryProduct>

    @GET
    suspend fun getServiceOrders(@Url url: String, @Header("Authorization") auth: String): Response<List<ServiceOrderSummary>>

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
}
