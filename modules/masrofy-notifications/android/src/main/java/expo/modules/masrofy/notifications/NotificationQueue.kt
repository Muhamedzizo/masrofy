package expo.modules.masrofy.notifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Locale
import kotlin.math.abs

internal object NotificationQueue {
  private const val PREFS_NAME = "masrofy_notification_listener"
  private const val KEY_SOURCES = "enabled_sources"
  private const val KEY_APP_SOURCES = "enabled_app_sources"
  private const val KEY_SMS_SOURCES = "enabled_sms_sources"
  private const val KEY_PENDING = "pending_candidates"
  private const val KEY_SEEN_IDS = "seen_candidate_ids"
  private const val KEY_EVENT_HISTORY = "recent_event_signatures"
  private const val MAX_SEEN_IDS = 900
  private const val MAX_EVENT_HISTORY = 1200
  private const val MAX_DESCRIPTION_LENGTH = 48
  private const val MAX_SOURCE_ID_LENGTH = 80
  private val descriptionControlCharacters = Regex("[\\p{Cntrl}\\p{Cf}]")
  private val descriptionWhitespace = Regex("\\s+")
  private val safeDescriptionPattern = Regex("[\\p{L}\\p{M}\\s&'’.-]+")
  private val sourceIdPattern = Regex("[A-Za-z0-9_.:-]{1,$MAX_SOURCE_ID_LENGTH}")
  private val lock = Any()

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun setSources(context: Context, sources: List<String>) {
    val selected = sources.asSequence().filter(::isValidSourceId).toSet()
    preferences(context).edit().putStringSet(KEY_SOURCES, selected).apply()
  }

  fun isSourceEnabled(context: Context, source: String): Boolean =
    preferences(context).getStringSet(KEY_SOURCES, emptySet())?.contains(source) == true

  fun setConfiguredNotificationApps(context: Context, encoded: String) {
    val input = JSONArray(encoded)
    val output = JSONArray()
    val seenPackages = HashSet<String>()
    for (index in 0 until input.length()) {
      val item = input.optJSONObject(index) ?: continue
      val packageName = item.optString("packageName").trim()
      val source = item.optString("source").trim()
      if (packageName.length !in 3..220 || packageName.any { !(it.isLetterOrDigit() || it == '.' || it == '_') }) continue
      if (!isValidSourceId(source) || !seenPackages.add(packageName)) continue
      output.put(JSONObject().put("packageName", packageName).put("source", source))
    }
    preferences(context).edit().putString(KEY_APP_SOURCES, output.toString()).apply()
  }

  fun sourceForPackage(context: Context, packageName: String): String? {
    val configured = readArray(preferences(context).getString(KEY_APP_SOURCES, null))
    for (index in 0 until configured.length()) {
      val item = configured.optJSONObject(index) ?: continue
      if (item.optString("packageName") == packageName) {
        return item.optString("source").takeIf(::isValidSourceId)
      }
    }
    // Compatibility with the initial build's three source switches.
    val legacy = when (packageName) {
      "com.egyptianbanks.instapay" -> "instapay"
      "com.emeint.android.myservices" -> "vodafone"
      "com.fawry.myfawry" -> "fawry"
      else -> return null
    }
    return legacy.takeIf { isSourceEnabled(context, it) }
  }

  fun setSmsSenderSources(context: Context, encoded: String) {
    val input = JSONArray(encoded)
    val output = JSONArray()
    val seenSenders = HashSet<String>()
    for (index in 0 until input.length()) {
      val item = input.optJSONObject(index) ?: continue
      val sender = item.optString("sender").trim().lowercase(Locale.ROOT)
      val source = item.optString("source").trim()
      if (sender.isBlank() || sender.length > 80 || sender.any(Char::isISOControl)) continue
      if (!isValidSourceId(source) || !seenSenders.add(sender)) continue
      output.put(JSONObject().put("sender", sender).put("source", source))
    }
    preferences(context).edit().putString(KEY_SMS_SOURCES, output.toString()).apply()
  }

  fun sourceForSmsSender(context: Context, sender: String?): String? {
    val normalized = sender?.trim()?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() } ?: return null
    val configured = readArray(preferences(context).getString(KEY_SMS_SOURCES, null))
    for (index in 0 until configured.length()) {
      val item = configured.optJSONObject(index) ?: continue
      if (item.optString("sender") == normalized) {
        return item.optString("source").takeIf(::isValidSourceId)
      }
    }
    return null
  }

  fun enqueue(
    context: Context,
    source: String,
    amountPiasters: Int,
    description: String?,
    timestamp: Long,
    channel: String,
    eventIdSeed: String
  ) {
    if (!isValidSourceId(source) || amountPiasters <= 0 || timestamp <= 0L) return
    if (channel != "notification" && channel != "sms") return
    val id = stableCandidateId("$channel|$eventIdSeed|$source|$amountPiasters|$timestamp")
    val safeDescription = sanitizeDescription(description)
    synchronized(lock) {
      val prefs = preferences(context)
      val pending = readArray(prefs.getString(KEY_PENDING, null))
      val seen = readArray(prefs.getString(KEY_SEEN_IDS, null))
      val alreadySeen = (0 until seen.length()).any { seen.optString(it) == id } ||
        (0 until pending.length()).any { pending.optJSONObject(it)?.optString("id") == id }
      if (alreadySeen) return

      val history = readArray(prefs.getString(KEY_EVENT_HISTORY, null))
      val duplicate = (0 until history.length()).any { index ->
        val item = history.optJSONObject(index) ?: return@any false
        val sameFields = item.optString("source") == source &&
          item.optInt("amountPiasters") == amountPiasters &&
          item.optString("channel") != channel
        val elapsed = abs(item.optLong("timestamp") - timestamp)
        val previousDescription = item.optString("description").takeIf { it.isNotEmpty() }
        val descriptionsAgree = when {
          previousDescription != null && safeDescription != null -> previousDescription.equals(safeDescription, ignoreCase = true)
          previousDescription == null && safeDescription == null -> elapsed <= DESCRIPTIONLESS_WINDOW_MS
          else -> false
        }
        sameFields && elapsed <= CROSS_CHANNEL_WINDOW_MS && descriptionsAgree
      }

      val signature = JSONObject()
        .put("source", source)
        .put("amountPiasters", amountPiasters)
        .put("timestamp", timestamp)
        .put("channel", channel)
      safeDescription?.let { signature.put("description", it) }
      history.put(signature)
      while (history.length() > MAX_EVENT_HISTORY) history.remove(0)
      seen.put(id)
      while (seen.length() > MAX_SEEN_IDS) seen.remove(0)

      if (duplicate) {
        prefs.edit()
          .putString(KEY_SEEN_IDS, seen.toString())
          .putString(KEY_EVENT_HISTORY, history.toString())
          .apply()
        return
      }

      val candidate = JSONObject()
        .put("id", id)
        .put("source", source)
        .put("amountPiasters", amountPiasters)
        .put("timestamp", timestamp)
      safeDescription?.let { candidate.put("description", it) }
      pending.put(candidate)
      // Pending candidates are not evicted; the app acknowledges only after local persistence.
      prefs.edit()
        .putString(KEY_PENDING, pending.toString())
        .putString(KEY_SEEN_IDS, seen.toString())
        .putString(KEY_EVENT_HISTORY, history.toString())
        .apply()
    }
  }

  fun readPending(context: Context): List<Map<String, Any>> = synchronized(lock) {
    val pending = readArray(preferences(context).getString(KEY_PENDING, null))
    buildList {
      for (index in 0 until pending.length()) {
        val item = pending.optJSONObject(index) ?: continue
        val id = item.optString("id")
        val source = item.optString("source")
        val amount = item.optInt("amountPiasters", 0)
        val timestamp = item.optLong("timestamp", 0L)
        if (id.length == 64 && isValidSourceId(source) && amount > 0 && timestamp > 0L) {
          val description = if (item.has("description") && !item.isNull("description")) {
            sanitizeDescription(item.optString("description"))
          } else null
          val candidate = mutableMapOf<String, Any>(
            "id" to id,
            "source" to source,
            "amountPiasters" to amount,
            "timestamp" to timestamp
          )
          description?.let { candidate["description"] = it }
          add(candidate)
        }
      }
    }
  }

  fun acknowledge(context: Context, ids: List<String>) {
    val removeIds = ids.filter { it.length == 64 }.toHashSet()
    if (removeIds.isEmpty()) return
    synchronized(lock) {
      val prefs = preferences(context)
      val pending = readArray(prefs.getString(KEY_PENDING, null))
      val retained = JSONArray()
      for (index in 0 until pending.length()) {
        val item = pending.optJSONObject(index) ?: continue
        if (!removeIds.contains(item.optString("id"))) retained.put(item)
      }
      prefs.edit().putString(KEY_PENDING, retained.toString()).apply()
    }
  }

  private fun isValidSourceId(value: String): Boolean =
    value.length <= MAX_SOURCE_ID_LENGTH && sourceIdPattern.matches(value)

  private fun readArray(encoded: String?): JSONArray = try {
    if (encoded.isNullOrBlank()) JSONArray() else JSONArray(encoded)
  } catch (_: Exception) {
    JSONArray()
  }

  private fun sanitizeDescription(value: String?): String? {
    val cleaned = value
      ?.replace(descriptionControlCharacters, " ")
      ?.replace(descriptionWhitespace, " ")
      ?.trim()
      ?.takeIf { it.isNotEmpty() && it.length <= MAX_DESCRIPTION_LENGTH }
      ?: return null
    if (!safeDescriptionPattern.matches(cleaned) || cleaned.any(Char::isDigit) || !cleaned.any(Char::isLetter)) return null
    return cleaned
  }

  private fun stableCandidateId(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }

  private val sourceIdPattern = Regex("[A-Za-z0-9_.:-]{1,$MAX_SOURCE_ID_LENGTH}")
  private val CROSS_CHANNEL_WINDOW_MS = 2 * 60 * 1000L
  private val DESCRIPTIONLESS_WINDOW_MS = 20 * 1000L
}
