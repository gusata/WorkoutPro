package com.workoutpro.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONObject;

/**
 * "Descanso terminado" alert for rests started or changed from the notification buttons
 * (the web layer may be paused, so it cannot schedule its own alert).
 *
 * Uses the same notification id and channel as lib/notifications.ts, so a stale alert
 * scheduled by the web layer and this one replace each other instead of stacking.
 */
public class RestAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "WorkoutProRestAlarm";
    static final String ACTION_REST_END = "com.workoutpro.app.REST_END";
    static final String EXTRA_TOKEN = "rest_end_ms";
    /** Same id/channel as REST_NOTIF_ID / ALERT_CHANNEL_ID in lib/notifications.ts. */
    private static final int REST_NOTIF_ID = 1001;
    private static final String ALERT_CHANNEL = "workoutpro_alert";
    private static final int REQUEST_CODE = 4101;

    private static long lastAlertToken = 0;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_REST_END.equals(intent.getAction())) return;
        fire(context, intent.getLongExtra(EXTRA_TOKEN, 0L));
    }

    /** Posts the alert once per rest (identified by its end time). */
    static synchronized void fire(Context context, long token) {
        try {
            if (token <= 0 || token == lastAlertToken) return;
            JSONObject state = NativeStore.timerState(context);
            if (state.optLong("restEndMs", 0L) != token || !state.optBoolean("nativeAlert", false)) return;
            lastAlertToken = token;
            if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return;
            ensureChannel(context);

            Intent open = DeepLinks.intent(context, DeepLinks.EXECUTE);
            PendingIntent content = PendingIntent.getActivity(context, REQUEST_CODE, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, ALERT_CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_workoutpro)
                .setContentTitle("Descanso terminado")
                .setContentText("Hora da próxima série")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
                .setAutoCancel(true)
                .setContentIntent(content);
            NotificationManagerCompat.from(context).notify(REST_NOTIF_ID, builder.build());
        } catch (SecurityException error) {
            Log.w(TAG, "Sem permissao para notificar o fim do descanso", error);
        } catch (Exception error) {
            Log.e(TAG, "Falha ao avisar o fim do descanso", error);
        }
    }

    static void schedule(Context context, long restEndMs) {
        try {
            AlarmManager alarms = context.getSystemService(AlarmManager.class);
            if (alarms == null) return;
            PendingIntent pending = pendingIntent(context, restEndMs);
            // Exact only when allowed (no SCHEDULE_EXACT_ALARM requested); the service's own
            // handler covers the common case of a device that is not dozing.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarms.canScheduleExactAlarms()) {
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, restEndMs, pending);
            } else {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, restEndMs, pending);
            }
        } catch (Exception error) {
            Log.w(TAG, "Nao foi possivel agendar o fim do descanso", error);
        }
    }

    static void cancel(Context context) {
        try {
            AlarmManager alarms = context.getSystemService(AlarmManager.class);
            if (alarms != null) alarms.cancel(pendingIntent(context, 0L));
        } catch (Exception error) {
            Log.w(TAG, "Nao foi possivel cancelar o fim do descanso", error);
        }
    }

    private static PendingIntent pendingIntent(Context context, long token) {
        Intent intent = new Intent(context, RestAlarmReceiver.class).setAction(ACTION_REST_END);
        intent.putExtra(EXTRA_TOKEN, token);
        // Fixed request code + UPDATE_CURRENT: there is only ever one pending rest alarm.
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(ALERT_CHANNEL) != null) return;
        NotificationChannel channel = new NotificationChannel(ALERT_CHANNEL, "Avisos de treino", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Fim do descanso e lembretes de treino");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }
}
