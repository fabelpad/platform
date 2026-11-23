package nl.fabelpad.billing

import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface PlayBillingBridge {
  fun products(productIds: List<String>, promise: Promise)
  fun purchase(productId: String, basePlanId: String, accountId: String, offerToken: String, promise: Promise)
  fun restore(promise: Promise)
  fun destroy()
}

/** The local app can load this module without loading any billing SDK. */
class FabelpadPlayBillingModule : Module() {
  private var billing: PlayBillingBridge? = null
  private val cacheKey = "fabelpad.connected.content.v1"
  @Synchronized private fun contentKey(alias: String = cacheKey): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    return (store.getKey(alias, null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun seal(text: String, alias: String): String {
    require(metadata("nl.fabelpad.variant") == "connected" && text.length <= 2_000_000)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, contentKey(alias)) }
    return Base64.encodeToString(cipher.iv + cipher.doFinal(text.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
  }
  private fun open(sealed: String, alias: String): String {
    require(metadata("nl.fabelpad.variant") == "connected" && sealed.length <= 3_000_000)
    val bytes = Base64.decode(sealed, Base64.NO_WRAP)
    require(bytes.size > 28)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, contentKey(alias), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
    return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
  }
  @Suppress("DEPRECATION")
  private fun metadata(key: String): String {
    val context = appContext.reactContext ?: return ""
    return context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData?.getString(key).orEmpty()
  }
  private fun bridge(promise: Promise): PlayBillingBridge? {
    if (metadata("nl.fabelpad.variant") != "connected") {
      promise.reject("ERR_BILLING_DISABLED", "Deze lokale app heeft geen betalingen of gezinskoppeling.", null)
      return null
    }
    return try {
      billing ?: run {
        val context = appContext.reactContext ?: throw IllegalStateException()
        val activity: () -> Activity? = { appContext.currentActivity }
        val event: (List<Map<String, Any?>>) -> Unit = { sendEvent("onPurchasesUpdated", mapOf("purchases" to it)) }
        val type = Class.forName("nl.fabelpad.billing.ConnectedPlayBillingBridge")
        (type.getConstructor(Context::class.java, Function0::class.java, Function1::class.java).newInstance(context, activity, event) as PlayBillingBridge).also { billing = it }
      }
    } catch (_: Throwable) {
      promise.reject("ERR_BILLING_UNAVAILABLE", "Google Play-betaling is niet beschikbaar in deze build.", null)
      null
    }
  }
  override fun definition() = ModuleDefinition {
    Name("FabelpadPlayBilling")
    Events("onPurchasesUpdated")
    Constant("connected") { metadata("nl.fabelpad.variant") == "connected" }
    Constant("backendOrigin") { metadata("nl.fabelpad.backendOrigin") }
    Constant("environment") { metadata("nl.fabelpad.environment") }
    Constant("deleteAccountUrl") { metadata("nl.fabelpad.deleteAccountUrl") }
    Constant("supabaseUrl") { metadata("nl.fabelpad.supabaseUrl") }
    Constant("supabaseKey") { metadata("nl.fabelpad.supabaseKey") }
    AsyncFunction("requestId") { java.util.UUID.randomUUID().toString() }
    AsyncFunction("sealContent") { text: String -> seal(text, cacheKey) }
    AsyncFunction("openContent") { sealed: String -> open(sealed, cacheKey) }
    AsyncFunction("sealProgress") { text: String -> seal(text, "$cacheKey.progress") }
    AsyncFunction("openProgress") { sealed: String -> open(sealed, "$cacheKey.progress") }
    AsyncFunction("clearContentKey") { KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(cacheKey) } }
    AsyncFunction("clearProgressKey") { KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry("$cacheKey.progress") } }
    AsyncFunction("products") { productIds: List<String>, promise: Promise -> bridge(promise)?.products(productIds, promise) }
    AsyncFunction("purchase") { productId: String, basePlanId: String, accountId: String, offerToken: String, promise: Promise -> bridge(promise)?.purchase(productId, basePlanId, accountId, offerToken, promise) }
    AsyncFunction("restore") { promise: Promise -> bridge(promise)?.restore(promise) }
    AsyncFunction("disconnect") { billing?.destroy(); billing = null }
    OnDestroy { billing?.destroy(); billing = null }
  }
}
