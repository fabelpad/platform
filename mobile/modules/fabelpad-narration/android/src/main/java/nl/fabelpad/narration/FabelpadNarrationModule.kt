package nl.fabelpad.narration

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONArray
import org.json.JSONObject

/** Private, checksum-verified audio. No profile names, analytics, uploads, or
 * microphone permission requests occur in this module. The parent UI requests
 * RECORD_AUDIO only after its explicit recording action. */
class FabelpadNarrationModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private val storageEpoch = AtomicLong(0)
  private val storageLock = Any()
  private val paused = ConcurrentHashMap.newKeySet<String>()
  private val running = ConcurrentHashMap.newKeySet<String>()
  private var playbackGeneration = 0L
  private var player: MediaPlayer? = null
  private var nextPlayer: MediaPlayer? = null
  private var nextPrepared = false
  private var currentPrepared = false
  private var desiredPaused = false
  private var playback: Promise? = null
  private var playbackItems = listOf<JSONObject>()
  private var playbackIndex = 0
  private var focus: AudioFocusRequest? = null
  private val legacyFocusListener = AudioManager.OnAudioFocusChangeListener { change -> if (change <= 0) main.post { stopPlayback("interrupted") } }
  private var recorder: MediaRecorder? = null
  private var recordingFile: File? = null
  private var recordingDestination: File? = null
  private var noisyRegistered = false
  private var destroyed = false
  private val attributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
  private val noisy = object : BroadcastReceiver() { override fun onReceive(context: Context?, intent: Intent?) { main.post { stopPlayback("interrupted") } } }
  private val root: File get() = File(context().noBackupFilesDir, "fabelpad-narration-v1").apply { mkdirs() }
  private fun context(): Context = appContext.reactContext ?: throw IllegalStateException("Audio is nu niet beschikbaar.")
  private fun identifier(value: String): String { require(Regex("[a-zA-Z0-9_-]{1,160}").matches(value)); return value }
  private fun scope(value: String): String { require(value == "public" || Regex("[a-f0-9]{64}").matches(value)); return value }
  private fun digest(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
  private fun safeFile(parent: File, name: String): File { require(Regex("[a-zA-Z0-9_.-]{1,240}").matches(name)); return File(parent, name).also { require(it.canonicalFile.parentFile == parent.canonicalFile) } }
  private fun packFolder(owner: String, key: String): File = safeFile(safeFile(File(root, "packages").apply { mkdirs() }, scope(owner)).apply { mkdirs() }, key)
  private fun cacheFolder(owner: String): File = safeFile(File(root, "cache").apply { mkdirs() }, scope(owner)).apply { mkdirs() }
  private fun recordingFolder(owner: String): File = safeFile(File(root, "recordings").apply { mkdirs() }, scope(owner)).apply { mkdirs() }
  @Suppress("DEPRECATION") private fun metadata(key: String): String = context().packageManager.getApplicationInfo(context().packageName, PackageManager.GET_META_DATA).metaData?.getString(key).orEmpty()
  private fun origin(): String = metadata("nl.fabelpad.audioOrigin").also { require(it == "https://staging.fabelpad.nl" || it == "https://fabelpad.nl") }
  private fun validUntil(value: String): Long = if (value.isBlank()) Long.MAX_VALUE else (
    if (Build.VERSION.SDK_INT >= 26) Instant.parse(value).toEpochMilli()
    else {
      val normalized = value.replace(Regex("\\.(\\d{3})\\d+"), ".$1").let { if (!it.substringBeforeLast('Z').contains('.')) it.replace("Z", ".000Z") else it }
      SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.ROOT).apply { isLenient = false; timeZone = TimeZone.getTimeZone("UTC") }.parse(normalized)?.time ?: throw IllegalArgumentException()
    }
  ).also { require(it > System.currentTimeMillis() && it <= System.currentTimeMillis() + 24 * 60 * 60_000L + 60_000) }
  private fun unexpired(value: JSONObject): Boolean = value.optLong("expiresAt", Long.MAX_VALUE) > System.currentTimeMillis()
  private fun atomic(file: File, bytes: ByteArray) {
    file.parentFile?.mkdirs()
    val temporary = File(file.parentFile, file.name + ".part")
    temporary.outputStream().use { it.write(bytes); it.flush() }
    check(temporary.renameTo(file)) { "De audio kon niet veilig worden bewaard." }
  }
  @Synchronized private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    return (store.getKey("fabelpad.narration.protected.v1", null) as? SecretKey) ?: KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder("fabelpad.narration.protected.v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
    }.generateKey()
  }
  private fun encode(bytes: ByteArray, owner: String): ByteArray {
    if (owner == "public") return bytes
    val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
    return cipher.iv + cipher.doFinal(bytes)
  }
  private fun decode(bytes: ByteArray, owner: String): ByteArray {
    if (owner == "public") return bytes
    require(bytes.size > 28)
    return Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }.doFinal(bytes.copyOfRange(12, bytes.size))
  }
  private fun readRecord(file: File, owner: String): JSONObject = JSONObject(String(decode(file.readBytes(), owner), Charsets.UTF_8))
  private fun writeRecord(file: File, value: JSONObject, owner: String) { atomic(file, encode(value.toString().toByteArray(), owner)) }
  private fun checked(bytes: ByteArray, asset: JSONObject): ByteArray {
    require(asset.getLong("byteLength") in 1..50_000_000 && bytes.size.toLong() == asset.getLong("byteLength"))
    require(Regex("[a-f0-9]{64}").matches(asset.getString("sha256")) && digest(bytes) == asset.getString("sha256"))
    return bytes
  }
  private fun assetName(asset: JSONObject): String = identifier(asset.getString("id")) + "-" + asset.getString("sha256").also { require(Regex("[a-f0-9]{64}").matches(it)) }
  private fun fetch(asset: JSONObject, authorization: String, epoch: Long, downloadKey: String?): ByteArray {
    val url = URL(asset.getString("url"))
    require(url.protocol == "https" && url.userInfo == null && url.port == -1 && "https://${url.host}" == origin() && url.path.startsWith("/api/voorlezen/"))
    val connection = url.openConnection() as HttpURLConnection
    connection.instanceFollowRedirects = false; connection.connectTimeout = 15_000; connection.readTimeout = 30_000
    if (authorization.isNotEmpty()) { require(authorization.startsWith("Bearer ") && authorization.length < 12_000); connection.setRequestProperty("Authorization", authorization) }
    try {
      require(connection.responseCode == 200) { "De opname is niet beschikbaar. Controleer je toegang en probeer opnieuw." }
      val expected = asset.getLong("byteLength"); require(expected in 1..50_000_000)
      if (connection.contentLengthLong >= 0) require(connection.contentLengthLong == expected)
      val output = java.io.ByteArrayOutputStream()
      connection.inputStream.use { input ->
        val buffer = ByteArray(32_768)
        while (true) {
          check(storageEpoch.get() == epoch && (downloadKey == null || !paused.contains(downloadKey))) { "paused" }
          val count = input.read(buffer); if (count < 0) break
          output.write(buffer, 0, count); require(output.size().toLong() <= expected)
        }
      }
      return checked(output.toByteArray(), asset)
    } finally { connection.disconnect() }
  }
  private fun storeAsset(folder: File, owner: String, asset: JSONObject, authorization: String, epoch: Long, downloadKey: String?, expires: Long): Long {
    val file = safeFile(folder, assetName(asset))
    val reusable = runCatching { checked(decode(file.readBytes(), owner), asset); true }.getOrDefault(false)
    val data = if (reusable) null else if (asset.has("base64")) checked(Base64.decode(asset.getString("base64"), Base64.DEFAULT), asset) else fetch(asset, authorization, epoch, downloadKey)
    synchronized(storageLock) {
      check(storageEpoch.get() == epoch && (downloadKey == null || !paused.contains(downloadKey))) { "paused" }
      if (data != null) atomic(file, encode(data, owner))
      writeRecord(File(folder, file.name + ".json"), JSONObject().put("asset", asset.let { JSONObject(it.toString()).apply { remove("url"); remove("base64") } }).put("expiresAt", expires), owner)
    }
    return asset.getLong("byteLength")
  }
  override fun definition() = ModuleDefinition {
    Name("FabelpadNarration")
    Events("onPlayback", "onDownload")
    Constant("audioOrigin") { metadata("nl.fabelpad.audioOrigin") }
    Constant("fixtureEnabled") { metadata("nl.fabelpad.audioFixtureEnabled") == "enabled" }
    AsyncFunction("fixtureAsset") {
      require(metadata("nl.fabelpad.audioFixtureEnabled") == "enabled")
      val sampleCount = 24_000 * 20; val bytes = ByteBuffer.allocate(44 + sampleCount * 2).order(ByteOrder.LITTLE_ENDIAN)
      bytes.put("RIFF".toByteArray()).putInt(36 + sampleCount * 2).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(24_000).putInt(48_000).putShort(2).putShort(16).put("data".toByteArray()).putInt(sampleCount * 2)
      for (index in 0 until sampleCount) bytes.putShort((kotlin.math.sin(index * 2.0 * Math.PI * 440.0 / 24_000) * 1000).toInt().toShort())
      val wav = bytes.array(); JSONObject().put("id", "ci-audio-tone").put("sha256", digest(wav)).put("byteLength", wav.size).put("durationMs", 20000).put("base64", Base64.encodeToString(wav, Base64.NO_WRAP)).toString()
    }
    AsyncFunction("fixtureCorrupt") { owner: String, key: String ->
      require(metadata("nl.fabelpad.audioFixtureEnabled") == "enabled")
      val folder = packFolder(scope(owner), identifier(key)); val envelope = readRecord(File(folder, "complete.json"), owner)
      val asset = envelope.getJSONArray("assetChecks").getJSONObject(0); synchronized(storageLock) { atomic(safeFile(folder, assetName(asset)), byteArrayOf(0, 1, 2)) }; true
    }
    AsyncFunction("fixtureExpire") { owner: String, key: String ->
      require(metadata("nl.fabelpad.audioFixtureEnabled") == "enabled")
      val folder = packFolder(scope(owner), identifier(key)); val file = File(folder, "complete.json")
      synchronized(storageLock) { val value = readRecord(file, owner); writeRecord(file, value.put("expiresAt", System.currentTimeMillis() - 1), owner) }; true
    }
    AsyncFunction("hash") { value: String -> digest(value.toByteArray()) }
    AsyncFunction("storageGeneration") { storageEpoch.get().toDouble() }
    AsyncFunction("hasAssets") { owner: String, request: String ->
      val folder = cacheFolder(scope(owner)); val assets = JSONArray(request)
      (0 until assets.length()).all { index -> runCatching { val asset = assets.getJSONObject(index); val file = safeFile(folder, assetName(asset)); require(unexpired(readRecord(File(folder, file.name + ".json"), owner))); checked(decode(file.readBytes(), owner), asset); true }.getOrDefault(false) }
    }
    AsyncFunction("prepareAssets") { request: String, authorization: String ->
      val value = JSONObject(request); val owner = scope(value.getString("scope")); val epoch = storageEpoch.get()
      if (owner != "public") require(value.getLong("storageGeneration") == epoch)
      val expires = validUntil(value.optString("offlineUntil")); require(owner == "public" || expires != Long.MAX_VALUE)
      val assets = value.getJSONArray("assets"); require(assets.length() in 1..1000)
      for (index in 0 until assets.length()) storeAsset(cacheFolder(owner), owner, assets.getJSONObject(index), authorization, epoch, null, expires)
      true
    }
    AsyncFunction("download") { request: String, authorization: String, promise: Promise ->
      val value = runCatching { JSONObject(request) }.getOrElse { promise.reject("ERR_AUDIO_DOWNLOAD", "Dit audiopakket is ongeldig.", null); return@AsyncFunction Unit }
      val downloadKey = value.optString("key")
      if (!running.add(downloadKey)) { promise.reject("ERR_AUDIO_DOWNLOAD_BUSY", "Dit pakket wordt al opgehaald.", null); return@AsyncFunction Unit }
      paused.remove(downloadKey)
      val epoch = storageEpoch.get()
      worker.execute {
        try {
          val owner = scope(value.getString("scope")); val folder = packFolder(owner, identifier(downloadKey)).apply { mkdirs() }
          if (owner != "public") require(value.getLong("storageGeneration") == epoch && storageEpoch.get() == epoch)
          val expires = validUntil(value.optString("offlineUntil")); require(owner == "public" || expires != Long.MAX_VALUE)
          val assets = value.getJSONArray("assets"); require(assets.length() in 1..15_000)
          val total = (0 until assets.length()).sumOf { assets.getJSONObject(it).getLong("byteLength") }
          require(total in 1..2_000_000_000L)
          require(root.usableSpace >= minOf(total + 16_000_000, 100_000_000)) { "Er is te weinig opslagruimte. Verwijder een audiopakket en probeer opnieuw." }
          val checks = JSONArray(); for (index in 0 until assets.length()) checks.put(JSONObject(assets.getJSONObject(index).toString()).apply { remove("url"); remove("base64") })
          val envelope = JSONObject().put("key", downloadKey).put("scope", owner).put("manifest", value.getJSONObject("manifest")).put("expiresAt", expires).put("byteLength", total).put("assetChecks", checks)
          synchronized(storageLock) { check(storageEpoch.get() == epoch); writeRecord(File(folder, "pending.json"), envelope, owner) }
          var done = 0L
          for (index in 0 until assets.length()) {
            check(storageEpoch.get() == epoch && !paused.contains(downloadKey)) { "paused" }
            done += storeAsset(folder, owner, assets.getJSONObject(index), authorization, epoch, downloadKey, expires)
            emit("onDownload", mapOf("key" to downloadKey, "status" to "downloading", "completedBytes" to done.toDouble(), "totalBytes" to total.toDouble(), "completedItems" to index + 1, "totalItems" to assets.length()))
            if (value.optBoolean("fixtureDelay")) { require(metadata("nl.fabelpad.audioFixtureEnabled") == "enabled"); Thread.sleep(100) }
          }
          check(storageEpoch.get() == epoch && !paused.contains(downloadKey)) { "paused" }
          // Only this final atomic pointer makes the complete set visible after a cold start.
          synchronized(storageLock) {
            check(storageEpoch.get() == epoch && !paused.contains(downloadKey)) { "paused" }
            writeRecord(File(folder, "complete.json"), envelope, owner)
            File(folder, "pending.json").delete()
          }
          emit("onDownload", mapOf("key" to downloadKey, "status" to "complete", "completedBytes" to total.toDouble(), "totalBytes" to total.toDouble()))
          promise.resolve(envelope.toString())
        } catch (error: Throwable) {
          val isPaused = paused.contains(downloadKey) || storageEpoch.get() != epoch
          emit("onDownload", mapOf("key" to downloadKey, "status" to if (isPaused) "paused" else "error"))
          promise.reject(if (isPaused) "ERR_AUDIO_PAUSED" else "ERR_AUDIO_DOWNLOAD", if (isPaused) "Download gepauzeerd. Gecontroleerde fragmenten blijven bewaard." else "De download kon niet worden voltooid. Controleer toegang, verbinding en opslagruimte. Je eerdere pakket blijft beschikbaar.", null)
        } finally { running.remove(downloadKey) }
      }
    }
    AsyncFunction("pauseDownload") { key: String -> paused.add(identifier(key)); true }
    AsyncFunction("downloads") { owner: String ->
      val folder = safeFile(File(root, "packages").apply { mkdirs() }, scope(owner))
      JSONArray().apply {
        folder.listFiles().orEmpty().filter { it.isDirectory }.forEach { pack ->
          val complete = File(pack, "complete.json"); val pending = File(pack, "pending.json")
          val file = if (complete.exists()) complete else pending
          runCatching {
            val value = readRecord(file, owner)
            if (unexpired(value)) {
              if (complete.exists()) {
                val checks = value.getJSONArray("assetChecks")
                val intact = (0 until checks.length()).all { index -> runCatching { val asset = checks.getJSONObject(index); checked(decode(safeFile(pack, assetName(asset)).readBytes(), owner), asset); true }.getOrDefault(false) }
                if (!intact) synchronized(storageLock) { writeRecord(pending, value, owner); complete.delete() }
              }
              put(value.put("complete", complete.exists()))
            } else synchronized(storageLock) { pack.deleteRecursively() }
          }
        }
      }.toString()
    }
    AsyncFunction("removeDownload") { owner: String, key: String ->
      paused.add(identifier(key)); main.post { stopPlayback("stopped") }
      storageEpoch.incrementAndGet()
      worker.submit<Boolean> { synchronized(storageLock) { packFolder(scope(owner), identifier(key)).deleteRecursively() } }.get()
    }
    AsyncFunction("play") { items: String, promise: Promise -> main.post {
      runCatching {
        stopPlayback("stopped"); if (recorder != null) cancelRecording()
        val values = JSONArray(items); require(values.length() in 1..1000)
        playbackItems = (0 until values.length()).map { values.getJSONObject(it) }; playbackIndex = 0; playback = promise
        if (!requestFocus()) throw IllegalStateException()
        playNext(playbackGeneration)
      }.onFailure { stopPlayback("error") }
    } }
    AsyncFunction("pause") { main.post { runCatching { desiredPaused = true; if (currentPrepared) player?.pause(); event("paused") } }; true }
    AsyncFunction("resume") { main.post { runCatching { if (requestFocus()) { desiredPaused = false; if (currentPrepared) { player?.start(); event("playing") } } else stopPlayback("interrupted") }.onFailure { stopPlayback("error") } }; true }
    AsyncFunction("stop") { main.post { stopPlayback("stopped") }; true }
    AsyncFunction("startRecording") { owner: String, cueId: String, promise: Promise -> main.post {
      runCatching {
        require(!destroyed)
        require(context().checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED)
        require(metadata("nl.fabelpad.localRecording") == "enabled")
        stopPlayback("stopped"); cancelRecording()
        val folder = recordingFolder(scope(owner)); val destination = safeFile(folder, identifier(cueId) + ".m4a")
        val temporary = File(folder, destination.name + ".pending")
        @Suppress("DEPRECATION") val next = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context()) else MediaRecorder()
        next.setAudioSource(MediaRecorder.AudioSource.MIC); next.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        next.setAudioEncoder(MediaRecorder.AudioEncoder.AAC); next.setAudioSamplingRate(24_000); next.setAudioChannels(1); next.setAudioEncodingBitRate(64_000)
        next.setMaxDuration(30_000); next.setMaxFileSize(2_000_000); next.setOutputFile(temporary.absolutePath)
        next.setOnInfoListener { _, _, _ -> main.post { cancelRecording(); event("recording_limit") } }
        recorder = next; recordingFile = temporary; recordingDestination = destination
        next.prepare(); next.start(); promise.resolve(true)
      }.onFailure { cancelRecording(); promise.reject("ERR_LOCAL_RECORDING", "De microfoon is niet beschikbaar. Je vorige opname blijft bewaard.", null) }
    } }
    AsyncFunction("stopRecording") { promise: Promise -> main.post {
      runCatching {
        val active = recorder ?: throw IllegalStateException(); val temporary = recordingFile ?: throw IllegalStateException()
        active.stop(); active.release(); recorder = null
        require(temporary.length() in 100..2_000_000)
        // Remains pending until the parent explicitly saves after listening back.
        promise.resolve(true)
      }.onFailure { cancelRecording(); promise.reject("ERR_LOCAL_RECORDING", "Neem de hele zin opnieuw op. Je vorige opname blijft bewaard.", null) }
    } }
    AsyncFunction("saveRecording") { promise: Promise -> main.post {
      runCatching { require(recorder == null); val file = recordingFile ?: throw IllegalStateException(); val destination = recordingDestination ?: throw IllegalStateException(); require(file.length() in 100..2_000_000); check(file.renameTo(destination)); recordingFile = null; recordingDestination = null; promise.resolve(true) }
        .onFailure { promise.reject("ERR_LOCAL_RECORDING", "De opname kon niet worden bewaard.", null) }
    } }
    AsyncFunction("cancelRecording") { main.post { cancelRecording() }; true }
    AsyncFunction("recordings") { owner: String -> recordingFolder(scope(owner)).listFiles().orEmpty().filter { it.extension == "m4a" }.map { it.nameWithoutExtension } }
    AsyncFunction("deleteRecording") { owner: String, cueId: String -> main.post { stopPlayback("stopped"); cancelRecording() }; safeFile(recordingFolder(scope(owner)), identifier(cueId) + ".m4a").delete() }
    AsyncFunction("clearProfile") { owner: String -> storageEpoch.incrementAndGet(); main.post { stopPlayback("stopped"); cancelRecording() }; worker.submit<Boolean> { synchronized(storageLock) { recordingFolder(scope(owner)).deleteRecursively() } }.get() }
    AsyncFunction("clearProtected") { storageEpoch.incrementAndGet(); main.post { stopPlayback("stopped"); cancelRecording() }; worker.submit<Boolean> {
      synchronized(storageLock) {
      for (area in listOf("packages", "cache")) File(root, area).listFiles().orEmpty().filter { it.name != "public" }.forEach { it.deleteRecursively() }
      File(root, "playback").deleteRecursively()
      // Connected recording scopes are registered separately; local recordings survive logout.
      File(root, "connected-recording-scopes").takeIf { it.exists() }?.readLines()?.forEach { if (Regex("[a-f0-9]{64}").matches(it)) recordingFolder(it).deleteRecursively() }
      File(root, "connected-recording-scopes").delete()
      KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry("fabelpad.narration.protected.v1") }; true
      }
    }.get() }
    AsyncFunction("registerConnectedProfile") { owner: String ->
      val id = scope(owner); require(id != "public"); val file = File(root, "connected-recording-scopes")
      val values = file.takeIf { it.exists() }?.readLines().orEmpty().toSet() + id; atomic(file, values.joinToString("\n").toByteArray()); true
    }
    AsyncFunction("clearAll") { storageEpoch.incrementAndGet(); main.post { stopPlayback("stopped"); cancelRecording() }; worker.submit<Boolean> { synchronized(storageLock) { root.deleteRecursively() } }.get() }
    OnActivityEntersBackground { main.post { stopPlayback("interrupted"); cancelRecording() } }
    OnDestroy { destroyed = true; storageEpoch.incrementAndGet(); main.post { stopPlayback("stopped"); cancelRecording() }; worker.shutdown() }
  }
  private fun emit(name: String, value: Map<String, Any?>) { if (!destroyed) runCatching { sendEvent(name, value) } }
  private fun event(status: String) { emit("onPlayback", mapOf("status" to status, "index" to playbackIndex)) }
  private fun audioManager(): AudioManager = context().getSystemService(Context.AUDIO_SERVICE) as AudioManager
  @Suppress("DEPRECATION") private fun requestFocus(): Boolean {
    if (destroyed || appContext.currentActivity == null) return false
    val manager = audioManager()
    val result = if (Build.VERSION.SDK_INT >= 26) {
      if (focus == null) focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attributes).setWillPauseWhenDucked(true).setOnAudioFocusChangeListener(legacyFocusListener, main).build()
      manager.requestAudioFocus(focus!!)
    } else manager.requestAudioFocus(legacyFocusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) return false
    if (!noisyRegistered) {
      if (Build.VERSION.SDK_INT >= 33) context().registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), Context.RECEIVER_NOT_EXPORTED)
      else { @Suppress("DEPRECATION") context().registerReceiver(noisy, IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)) }
      noisyRegistered = true
    }
    return true
  }
  @Suppress("DEPRECATION") private fun releaseFocus() { runCatching { if (Build.VERSION.SDK_INT >= 26) focus?.let { audioManager().abandonAudioFocusRequest(it) } else audioManager().abandonAudioFocus(legacyFocusListener) }; if (noisyRegistered) { runCatching { context().unregisterReceiver(noisy) }; noisyRegistered = false } }
  private fun stopPlayback(status: String) {
    playbackGeneration++; player?.let { runCatching { it.stop() }; it.release() }; player = null
    nextPlayer?.release(); nextPlayer = null; nextPrepared = false; currentPrepared = false; desiredPaused = false
    playback?.resolve(if (status == "done") "done" else if (status == "error") "error" else "stopped"); playback = null; playbackItems = emptyList(); playbackIndex = 0
    releaseFocus(); runCatching { File(root, "playback").deleteRecursively() }; event(status)
  }
  private fun playable(item: JSONObject, index: Int = playbackIndex): File {
    if (item.getString("kind") == "recording") {
      val folder = recordingFolder(scope(item.getString("scope")))
      val file = if (item.optBoolean("pending")) recordingFile?.takeIf { it.parentFile?.canonicalFile == folder.canonicalFile } else safeFile(folder, identifier(item.getString("cueId")) + ".m4a")
      require(file != null && file.exists()); return file
    }
    val owner = scope(item.getString("scope")); val asset = item.getJSONObject("asset")
    val folder = if (item.has("key")) packFolder(owner, item.getString("key")) else cacheFolder(owner)
    if (item.has("key")) { val envelope = readRecord(File(folder, "complete.json"), owner); require(unexpired(envelope)); armExpiry(playbackGeneration, envelope.optLong("expiresAt", Long.MAX_VALUE)) }
    val file = safeFile(folder, assetName(asset)); val info = readRecord(File(folder, file.name + ".json"), owner); require(unexpired(info))
    armExpiry(playbackGeneration, info.optLong("expiresAt", Long.MAX_VALUE))
    val bytes = checked(decode(file.readBytes(), owner), asset)
    val temporary = safeFile(File(root, "playback").apply { mkdirs() }, "clip-$playbackGeneration-$index.wav")
    atomic(temporary, bytes); return temporary
  }
  private fun playNext(generation: Long) {
    if (generation != playbackGeneration || playback == null) return
    if (playbackIndex >= playbackItems.size) { stopPlayback("done"); return }
    player = preparedPlayer(playbackIndex, generation)
  }
  private fun preparedPlayer(index: Int, generation: Long): MediaPlayer {
    val file = playable(playbackItems[index], index); val next = MediaPlayer()
    next.setAudioAttributes(attributes); next.setDataSource(file.absolutePath)
    next.setOnPreparedListener {
      if (destroyed || generation != playbackGeneration) { runCatching { it.release() } }
      else if (player === it && index == playbackIndex) {
        currentPrepared = true
        if (desiredPaused) event("paused") else { it.start(); event("playing") }
        runCatching { prebuffer(generation) }.onFailure { stopPlayback("error") }
      } else if (nextPlayer === it && index == playbackIndex + 1) {
        nextPrepared = true; runCatching { player?.setNextMediaPlayer(it) }.onFailure { stopPlayback("error") }
      } else runCatching { it.release() }
    }
    next.setOnCompletionListener {
      if (generation == playbackGeneration && player === it) {
        it.release(); player = null; playbackIndex++
        if (playbackIndex >= playbackItems.size) stopPlayback("done")
        else {
          player = nextPlayer; currentPrepared = nextPrepared; nextPlayer = null; nextPrepared = false
          runCatching {
            if (player == null) playNext(generation)
            else if (currentPrepared) {
              if (desiredPaused) { player?.pause(); event("paused") } else { if (player?.isPlaying != true) player?.start(); event("playing") }
              prebuffer(generation)
            }
          }.onFailure { stopPlayback("error") }
        }
      }
    }
    next.setOnErrorListener { _, _, _ -> if (generation == playbackGeneration) stopPlayback("error"); true }
    next.prepareAsync(); return next
  }
  private fun prebuffer(generation: Long) {
    if (generation == playbackGeneration && playbackIndex + 1 < playbackItems.size && nextPlayer == null) nextPlayer = preparedPlayer(playbackIndex + 1, generation)
  }
  private fun armExpiry(generation: Long, expiresAt: Long) {
    if (expiresAt == Long.MAX_VALUE) return
    main.postDelayed({ if (generation == playbackGeneration) { if (expiresAt <= System.currentTimeMillis()) stopPlayback("interrupted") else armExpiry(generation, expiresAt) } }, maxOf(1, minOf(24 * 60 * 60_000L, expiresAt - System.currentTimeMillis())))
  }
  private fun cancelRecording() { recorder?.let { runCatching { it.stop() }; it.release() }; recorder = null; recordingFile?.delete(); recordingFile = null; recordingDestination = null }
}
