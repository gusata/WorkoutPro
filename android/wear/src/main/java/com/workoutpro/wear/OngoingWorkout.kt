package com.workoutpro.wear

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.wear.ongoing.OngoingActivity
import androidx.wear.ongoing.Status

/**
 * Ongoing Activity: while a workout runs on the phone, the watch face / recents show an icon
 * with "Supino · 2/4 · 12:34" (or the rest countdown) and tapping it opens the watch app.
 * Backed by a plain ongoing notification (no foreground service needed: nothing runs in it).
 */
object OngoingWorkout {
    private const val CHANNEL_ID = "workoutpro_ongoing"
    private const val NOTIFICATION_ID = 1001

    fun update(context: Context, state: WorkoutState) {
        val manager = NotificationManagerCompat.from(context)
        if (!state.active) {
            manager.cancel(NOTIFICATION_ID)
            return
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        ensureChannel(context)

        val now = System.currentTimeMillis()
        val resting = state.isResting(now)
        val open = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val title = state.workoutName.ifEmpty { context.getString(R.string.app_name) }
        val text = when {
            resting -> context.getString(R.string.rest)
            state.allDone -> context.getString(R.string.all_done)
            else -> "${state.exerciseName} · ${state.setIndex + 1}/${state.setCount}"
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_monochrome)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open)

        // Status time parts use the elapsedRealtime clock; the phone sends wall-clock times.
        val status = if (resting) {
            Status.Builder()
                .addTemplate(context.getString(R.string.ongoing_rest_template))
                .addPart("timer", Status.TimerPart(toElapsed(state.restEndAt!!, now)))
                .build()
        } else {
            val builderStatus = Status.Builder()
                .addTemplate("#text# · #clock#")
                .addTemplate("#text#")
                .addPart("text", Status.TextPart(text))
            state.startedAt?.let { builderStatus.addPart("clock", Status.StopwatchPart(toElapsed(it, now))) }
            builderStatus.build()
        }

        OngoingActivity.Builder(context, NOTIFICATION_ID, builder)
            .setStaticIcon(R.drawable.ic_launcher_monochrome)
            .setTouchIntent(open)
            .setStatus(status)
            .setTitle(title)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
            .apply(context)

        try {
            manager.notify(NOTIFICATION_ID, builder.build())
        } catch (error: SecurityException) {
            // Notification permission revoked.
        }
    }

    private fun toElapsed(wallClockMs: Long, now: Long): Long =
        SystemClock.elapsedRealtime() + (wallClockMs - now)

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, context.getString(R.string.channel_ongoing), NotificationManager.IMPORTANCE_DEFAULT).apply {
                setSound(null, null)
                enableVibration(false)
            }
        )
    }
}
