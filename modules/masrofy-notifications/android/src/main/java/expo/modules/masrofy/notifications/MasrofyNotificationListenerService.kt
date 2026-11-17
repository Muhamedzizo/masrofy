package expo.modules.masrofy.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class MasrofyNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val source = NotificationQueue.sourceForPackage(applicationContext, sbn.packageName) ?: return
    val extras = sbn.notification?.extras ?: return
    val transientText = StringBuilder()
    val parsed = try {
      appendTransient(transientText, extras.getCharSequence(Notification.EXTRA_TITLE))
      appendTransient(transientText, extras.getCharSequence(Notification.EXTRA_TEXT))
      appendTransient(transientText, extras.getCharSequence(Notification.EXTRA_BIG_TEXT))
      extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.forEach {
        appendTransient(transientText, it)
      }
      NotificationParser.parseOutgoingSuccessfulTransaction(transientText.toString())
    } catch (_: Exception) {
      null
    } finally {
      transientText.setLength(0)
    }
    if (parsed == null) return
    val postedAt = sbn.postTime.takeIf { it > 0L } ?: return
    NotificationQueue.enqueue(
      applicationContext,
      source,
      parsed.amountPiasters,
      parsed.description,
      postedAt,
      "notification",
      "${sbn.packageName}|${sbn.key}|${sbn.id}"
    )
  }

  private fun appendTransient(target: StringBuilder, value: CharSequence?) {
    if (value == null || target.length >= MAX_TRANSIENT_TEXT) return
    val remaining = MAX_TRANSIENT_TEXT - target.length
    target.append(value, 0, minOf(value.length, remaining)).append('\n')
  }

  private companion object {
    const val MAX_TRANSIENT_TEXT = 4_000
  }
}
