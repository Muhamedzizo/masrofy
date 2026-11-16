package expo.modules.masrofy.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MasrofyNotificationsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MasrofyNotifications")

    AsyncFunction("getNotificationAccessEnabled") {
      hasNotificationAccess(context)
    }

    AsyncFunction("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("setNotificationSources") { sources: List<String> ->
      NotificationQueue.setSources(context, sources)
    }

    AsyncFunction("drainPendingCandidates") {
      NotificationQueue.readPending(context)
    }

    AsyncFunction("acknowledgeCandidates") { ids: List<String> ->
      NotificationQueue.acknowledge(context, ids)
    }
  }

  private fun hasNotificationAccess(context: Context): Boolean {
    val component = ComponentName(context, MasrofyNotificationListenerService::class.java)
      .flattenToString()
    val enabled = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners"
    ) ?: return false
    return enabled.split(':').any { it.equals(component, ignoreCase = true) }
  }
}
