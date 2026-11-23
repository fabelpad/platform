package nl.fabelpad.speech

import android.os.Bundle
import android.app.DatePickerDialog
import android.content.res.Configuration
import android.content.pm.PackageManager
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.view.ContextThemeWrapper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale

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
  private var dateDialog: DatePickerDialog? = null
  private var focus: AudioFocusRequest? = null
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change -> if (change <= 0) main.post { stopSpeech() } }
  private var noisyRegistered = false
  private val noisy = object : BroadcastReceiver() { override fun onReceive(context: Context?, intent: Intent?) { main.post { stopSpeech() } } }

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
    AsyncFunction("pickBirthDate") { initialDate: String, latestDate: String, promise: Promise ->
      main.post {
        runCatching { pickBirthDate(initialDate, latestDate, promise) }.onFailure {
          promise.reject("ERR_BIRTH_DATE_PICKER", "De datumkiezer kon niet worden geopend.", null)
        }
      }
    }
    AsyncFunction("closeBirthDatePicker") { promise: Promise ->
      main.post { dateDialog?.dismiss(); dateDialog = null; promise.resolve(null) }
    }
    OnActivityEntersBackground { main.post { dateDialog?.dismiss(); dateDialog = null; stopSpeech() } }
    OnDestroy {
      main.post {
        destroyed = true
        dateDialog?.dismiss()
        dateDialog = null
        stopSpeech()
        engine?.shutdown()
        engineGeneration += 1
        engine = null
        ready = false
      }
    }
  }

  /** A local calendar picker: date strings have no UTC conversion or network destination. */
  private fun pickBirthDate(initialDate: String, latestDate: String, promise: Promise) {
    val activity = appContext.currentActivity
    if (destroyed || activity == null || activity.isFinishing || dateDialog != null) {
      promise.reject("ERR_BIRTH_DATE_PICKER", "De datumkiezer is nu niet beschikbaar.", null)
      return
    }
    fun calendar(value: String): Calendar {
      require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(value))
      val parts = value.split('-').map(String::toInt)
      return GregorianCalendar().apply {
        isLenient = false
        set(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
        set(Calendar.MILLISECOND, 0)
        timeInMillis // Validate, without logging or returning an instant to JavaScript.
      }
    }
    val latest = calendar(latestDate)
    val selected = calendar(initialDate.ifEmpty { latestDate })
    val context = ContextThemeWrapper(activity, android.R.style.Theme_DeviceDefault_Light_Dialog).apply {
      applyOverrideConfiguration(Configuration(activity.resources.configuration).apply { setLocale(Locale.forLanguageTag("nl-NL")) })
    }
    var delivered = false
    val dialog = DatePickerDialog(context, { _, year, month, day ->
      if (!delivered) {
        delivered = true
        promise.resolve(String.format(Locale.ROOT, "%04d-%02d-%02d", year, month + 1, day))
      }
    }, selected.get(Calendar.YEAR), selected.get(Calendar.MONTH), selected.get(Calendar.DAY_OF_MONTH))
    dialog.setTitle("Geboortedatum")
    dialog.datePicker.maxDate = latest.timeInMillis
    dialog.setOnDismissListener {
      dateDialog = null
      if (!delivered) { delivered = true; promise.resolve(null) }
    }
    dateDialog = dialog
    dialog.show()
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
    releaseFocus()
  }

  private fun fail(message: String) {
    runCatching { engine?.stop() }
    finalUtterance = null
    request?.reject("ERR_OFFLINE_VOICE", message, null)
    request = null
    releaseFocus()
  }
  @Suppress("DEPRECATION") private fun releaseFocus() {
    val context = appContext.reactContext
    runCatching { val manager = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager; if (Build.VERSION.SDK_INT >= 26) focus?.let { manager?.abandonAudioFocusRequest(it) } else manager?.abandonAudioFocus(focusListener) }; focus = null
    if (noisyRegistered) { runCatching { context?.unregisterReceiver(noisy) }; noisyRegistered = false }
  }
  @Suppress("DEPRECATION") private fun requestFocus(): Boolean {
    val manager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
    val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
    engine?.setAudioAttributes(attributes)
    val result = if (Build.VERSION.SDK_INT >= 26) {
      val next = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(focusListener, main).build()
      focus = next; manager.requestAudioFocus(next)
    } else manager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return false
    if (!noisyRegistered) {
      val context = appContext.reactContext ?: return false
      if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED)
      else context.registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY))
      noisyRegistered = true
    }
    return true
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
    if (!requestFocus()) { fail("Een andere app gebruikt het geluid. Probeer zelf opnieuw."); return }
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
            releaseFocus()
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
