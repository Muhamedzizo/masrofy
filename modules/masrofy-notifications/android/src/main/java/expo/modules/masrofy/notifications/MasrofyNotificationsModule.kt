package expo.modules.masrofy.notifications

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import expo.modules.interfaces.permissions.Permissions
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

    AsyncFunction("setConfiguredNotificationApps") { encoded: String ->
      NotificationQueue.setConfiguredNotificationApps(context, encoded)
    }

    AsyncFunction("setSmsSenderSources") { encoded: String ->
      NotificationQueue.setSmsSenderSources(context, encoded)
    }

    AsyncFunction("listLaunchableApps") {
      listLaunchableApps(context)
    }

    AsyncFunction("getSmsPermissionGranted") {
      context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("requestSmsPermission") { promise: expo.modules.kotlin.Promise ->
      val permissions = appContext.permissions ?: throw Exceptions.PermissionsModuleNotFound()
      Permissions.askForPermissionsWithPermissionsManager(
        permissions,
        promise,
        Manifest.permission.RECEIVE_SMS
      )
    }

    AsyncFunction("drainPendingCandidates") {
      NotificationQueue.readPending(context)
    }

    AsyncFunction("acknowledgeCandidates") { ids: List<String> ->
      NotificationQueue.acknowledge(context, ids)
    }
  }

  private fun listLaunchableApps(context: Context): List<Map<String, String>> {
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    @Suppress("DEPRECATION")
    val matches = context.packageManager.queryIntentActivities(intent, 0)
    return matches.asSequence()
      .mapNotNull { info ->
        val activity = info.activityInfo ?: return@mapNotNull null
        val packageName = activity.packageName
        if (packageName == context.packageName) return@mapNotNull null
        val label = try {
          info.loadLabel(context.packageManager)?.toString()?.trim()
        } catch (_: Exception) {
          null
        }
        if (label.isNullOrBlank()) null else mapOf("packageName" to packageName, "label" to label)
      }
      .distinctBy { it["packageName"] }
      .sortedBy { it["label"]?.lowercase() }
      .toList()
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
