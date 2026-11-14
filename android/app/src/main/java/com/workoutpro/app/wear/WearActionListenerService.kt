package com.workoutpro.app.wear

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.workoutpro.app.MainActivity
import com.workoutpro.app.R

/**
 * Receives /workout/... messages from the watch even when the phone app is not running.
 * Every message goes to the durable queue first; a live WebView is then poked to drain it.
 */
class WearActionListenerService : WearableListenerService() {

    override fun onMessageReceived(event: MessageEvent) {
        val type = WearActionStore.typeForPath(event.path) ?: return
        val payload = event.data?.let { String(it, Charsets.UTF_8) } ?: ""
        WearActionStore.enqueue(applicationContext, type, payload)
        val delivered = WearBridgePlugin.notifyIfAlive()
        // The app can't be launched from the background; ask the user to open it instead.
        if (!delivered && type == "start") showOpenAppNotification()
    }

    private fun showOpenAppNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Pedidos do relógio", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Avisa quando o relógio pede para iniciar um treino"
                }
            )
        }
        val open = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle("Iniciar treino de hoje")
            .setContentText("Toque para abrir o WorkoutPro e começar o treino pedido no relógio.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            // Already on the watch screen; don't bounce it back there.
            .setLocalOnly(true)
            .setContentIntent(open)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, notification)
        } catch (error: SecurityException) {
            // Permission revoked between the check and the call.
        }
    }

    companion object {
        private const val CHANNEL_ID = "workoutpro_wear_requests"
        private const val NOTIFICATION_ID = 4242
    }
}
