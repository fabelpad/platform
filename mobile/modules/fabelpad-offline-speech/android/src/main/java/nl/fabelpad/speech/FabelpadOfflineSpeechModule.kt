package nl.fabelpad.speech

import android.os.Bundle
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/** Only an installed Dutch voice that reports offline synthesis may receive text. */
class FabelpadOfflineSpeechModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var engine: TextToSpeech? = null
  private var ready = false
  private var destroyed = false
  private var request: Promise? = null
  private var generation = 0L
  private var engineGeneration = 0L
  private var finalUtterance: String? = null

  override fun definition() = ModuleDefinition {
    Name("FabelpadOfflineSpeech")
    Constant("variant") { metadata("nl.fabelpad.variant") ?: "demo" }
    Constant("privacyUrl") { metadata("nl.fabelpad.privacyUrl") ?: "" }
    Constant("supportUrl") { metadata("nl.fabelpad.supportUrl") ?: "" }

    AsyncFunction("speak") { text: String, promise: Promise ->
      main.post { runCatching { speak(text, promise) }.onFailure { fail("Voorlezen is nu niet beschikbaar. Je kunt wel verder lezen.") } }
    }
    AsyncFunction("stop") { promise: Promise ->
      main.post { stopSpeech(); promise.resolve(null) }
    }
    OnDestroy {
      main.post {
        destroyed = true
        stopSpeech()
        engine?.shutdown()
        engineGeneration += 1
        engine = null
        ready = false
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun metadata(key: String): String? {
    val context = appContext.reactContext ?: return null
    return context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData?.getString(key)
  }

  private fun stopSpeech() {
    generation += 1
    finalUtterance = null
    runCatching { engine?.stop() } // Never construct a TTS engine just to stop it.
    request?.resolve("stopped")
    request = null
  }

  private fun fail(message: String) {
    runCatching { engine?.stop() }
    finalUtterance = null
    request?.reject("ERR_OFFLINE_VOICE", message, null)
    request = null
  }

  private fun allowed(voice: Voice): Boolean =
    voice.locale.language == "nl" && !voice.isNetworkConnectionRequired &&
      voice.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true

  private fun speak(text: String, promise: Promise) {
    if (destroyed) {
      promise.reject("ERR_SPEECH_CLOSED", "Voorlezen is niet beschikbaar.", null)
      return
    }
    stopSpeech()
    request = promise
    val token = generation
    if (text.isBlank() || text.length > 100_000) {
      fail("Deze tekst kan niet worden voorgelezen.")
      return
    }
    if (ready) {
      enqueue(text, token)
      return
    }
    // Initialization is caused only by an explicit user request, never app startup.
    if (engine == null) {
      val engineToken = ++engineGeneration
      engine = TextToSpeech(appContext.reactContext) { status ->
        main.post {
          if (destroyed || engineToken != engineGeneration) return@post
          ready = status == TextToSpeech.SUCCESS
          if (!ready) {
            engine?.shutdown()
            engine = null
            if (token == generation) fail("De Nederlandse offline apparaatstem is niet beschikbaar.")
          }
          else if (token == generation) runCatching { enqueue(text, token) }.onFailure { fail("Voorlezen is nu niet beschikbaar. Je kunt wel verder lezen.") }
        }
      }
      main.postDelayed({
        if (token == generation && request != null && !ready) {
          engine?.shutdown()
          engine = null
          engineGeneration += 1
          fail("De apparaatstem kon niet worden gestart. Je kunt wel verder lezen.")
        }
      }, 30_000)
    } else {
      // No text is submitted while an earlier initialization is pending.
      fail("De apparaatstem wordt nog gestart. Probeer opnieuw.")
    }
  }

  private fun enqueue(text: String, token: Long) {
    val tts = engine ?: return fail("De apparaatstem is niet beschikbaar.")
    if (token != generation || request == null) return
    val voice = tts.voices.orEmpty().filter(::allowed)
      .sortedWith(compareByDescending<Voice> { it.quality }.thenBy { it.latency }.thenBy { it.name })
      .firstOrNull()
      ?: return fail("Installeer via de Android-instellingen een Nederlandse offline stem. Je kunt wel verder lezen.")
    if (tts.setVoice(voice) != TextToSpeech.SUCCESS || tts.voice?.let { it.name == voice.name && allowed(it) } != true) {
      fail("Er is geen Nederlandse offline stem geselecteerd. Je kunt wel verder lezen.")
      return
    }
    tts.setSpeechRate(0.86f)
    val prefix = UUID.randomUUID().toString()
    val chunks = text.chunked(minOf(1500, TextToSpeech.getMaxSpeechInputLength() - 1))
    finalUtterance = "$prefix-${chunks.lastIndex}"
    tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(utteranceId: String) = Unit
      override fun onDone(utteranceId: String) {
        main.post {
          if (token == generation && utteranceId == finalUtterance) {
            finalUtterance = null
            request?.resolve("done")
            request = null
          }
        }
      }
      @Deprecated("Required by Android's listener interface")
      override fun onError(utteranceId: String) {
        main.post { if (token == generation) fail("Voorlezen is nu niet beschikbaar. Je kunt wel verder lezen.") }
      }
      override fun onError(utteranceId: String, errorCode: Int) = onError(utteranceId)
    })
    for ((index, chunk) in chunks.withIndex()) {
      // No language/default-voice fallback, voice download, or network voice is used.
      if (tts.voice?.let { it.name == voice.name && allowed(it) } != true ||
        tts.speak(chunk, TextToSpeech.QUEUE_ADD, Bundle(), "$prefix-$index") != TextToSpeech.SUCCESS) {
        fail("Voorlezen is nu niet beschikbaar. Je kunt wel verder lezen.")
        return
      }
    }
  }
}
