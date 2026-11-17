package expo.modules.masrofy.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.telephony.SmsMessage

class MasrofySmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val extras = intent.extras ?: return
    @Suppress("DEPRECATION")
    val pdus = extras.get("pdus") as? Array<*> ?: return
    val format = extras.getString("format")
    val parsedMessages = pdus.mapNotNull { pdu ->
      val bytes = pdu as? ByteArray ?: return@mapNotNull null
      try {
        if (format != null) SmsMessage.createFromPdu(bytes, format) else SmsMessage.createFromPdu(bytes)
      } catch (_: Exception) {
        null
      }
    }
    if (parsedMessages.isEmpty()) return
    val sender = parsedMessages.firstNotNullOfOrNull { it.originatingAddress } ?: return
    // Reject unselected senders before joining/processing the message body.
    val source = NotificationQueue.sourceForSmsSender(context, sender) ?: return
    val timestamp = parsedMessages.maxOfOrNull { it.timestampMillis }?.takeIf { it > 0L } ?: return
    val text = parsedMessages.joinToString(separator = "") { it.messageBody.orEmpty() }.take(MAX_SMS_LENGTH)
    if (text.isBlank()) return
    val parsed = try {
      NotificationParser.parseOutgoingSuccessfulTransaction(text)
    } catch (_: Exception) {
      null
    } ?: return
    // The full body is used only as an ephemeral hash seed to recognize a repeated broadcast.
    // It is never stored or sent; only bounded transaction fields enter the local queue.
    val eventSeed = "$sender|$timestamp|$text"
    NotificationQueue.enqueue(
      context.applicationContext,
      source,
      parsed.amountPiasters,
      parsed.description,
      timestamp,
      "sms",
      eventSeed
    )
  }

  private companion object {
    const val MAX_SMS_LENGTH = 4_000
  }
}
