package expo.modules.masrofy.notifications

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

internal enum class PaymentSource(val value: String, val packageName: String) {
  INSTAPAY("instapay", "com.egyptianbanks.instapay"),
  VODAFONE("vodafone", "com.emeint.android.myservices"),
  FAWRY("fawry", "com.fawry.myfawry");

  companion object {
    fun fromPackage(packageName: String): PaymentSource? =
      values().firstOrNull { it.packageName == packageName }

    fun fromValue(value: String): PaymentSource? =
      values().firstOrNull { it.value == value }
  }
}

internal object NotificationQueue {
  private const val PREFS_NAME = "masrofy_notification_listener"
  private const val KEY_SOURCES = "enabled_sources"
  private const val KEY_PENDING = "pending_candidates"
  private const val KEY_SEEN_IDS = "seen_candidate_ids"
  private const val MAX_SEEN_IDS = 600
  private const val MAX_DESCRIPTION_LENGTH = 48
  private val descriptionControlCharacters = Regex("[\\p{Cntrl}\\p{Cf}]")
  private val descriptionWhitespace = Regex("\\s+")
  private val safeDescriptionPattern = Regex("[\\p{L}\\p{M}\\s&'’.-]+")
  private val lock = Any()

  private fun preferences(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun setSources(context: Context, sources: List<String>) {
    val selected = sources.asSequence()
      .mapNotNull { PaymentSource.fromValue(it) }
      .map { it.value }
      .toSet()
    preferences(context).edit().putStringSet(KEY_SOURCES, selected).apply()
  }

  fun isSourceEnabled(context: Context, source: String): Boolean =
    preferences(context).getStringSet(KEY_SOURCES, emptySet())?.contains(source) == true

  fun enqueue(
    context: Context,
    source: PaymentSource,
    amountPiasters: Int,
    description: String?,
    timestamp: Long,
    packageName: String,
    notificationKey: String,
    notificationId: Int
  ) {
    if (amountPiasters <= 0 || timestamp <= 0L) return
    val id = stableCandidateId(
      "$packageName|$notificationKey|$notificationId|${source.value}|$amountPiasters|$timestamp"
    )

    synchronized(lock) {
      val prefs = preferences(context)
      val pending = readArray(prefs.getString(KEY_PENDING, null))
      val seen = readArray(prefs.getString(KEY_SEEN_IDS, null))
      val alreadySeen = (0 until seen.length()).any { seen.optString(it) == id }
      if (alreadySeen || (0 until pending.length()).any { pending.optJSONObject(it)?.optString("id") == id }) {
        return
      }

      val candidate = JSONObject()
        .put("id", id)
        .put("source", source.value)
        .put("amountPiasters", amountPiasters)
        .put("timestamp", timestamp)
      sanitizeDescription(description)?.let { candidate.put("description", it) }
      pending.put(candidate)
      // Pending candidates are not evicted; the app removes them only after local persistence.

      seen.put(id)
      while (seen.length() > MAX_SEEN_IDS) seen.remove(0)
      prefs.edit()
        .putString(KEY_PENDING, pending.toString())
        .putString(KEY_SEEN_IDS, seen.toString())
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
        if (id.length == 64 && PaymentSource.fromValue(source) != null && amount > 0 && timestamp > 0L) {
          val description = if (item.has("description") && !item.isNull("description")) {
            sanitizeDescription(item.optString("description"))
          } else {
            null
          }
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
    if (!safeDescriptionPattern.matches(cleaned) || cleaned.any(Char::isDigit) || !cleaned.any(Char::isLetter)) {
      return null
    }
    return cleaned
  }

  private fun stableCandidateId(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }
}
