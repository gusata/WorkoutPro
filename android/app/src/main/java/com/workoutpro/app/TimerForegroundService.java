package com.workoutpro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

public class TimerForegroundService extends Service {

    public static final String ACTION_START_WORKOUT = "com.workoutpro.app.START_WORKOUT";
    public static final String ACTION_STOP_WORKOUT  = "com.workoutpro.app.STOP_WORKOUT";
    public static final String ACTION_START_TIMER   = "com.workoutpro.app.START_TIMER";
    public static final String ACTION_CANCEL_REST   = "com.workoutpro.app.CANCEL_REST";

    // Legacy aliases kept so AndroidManifest and any existing references still compile.
    public static final String ACTION_START = ACTION_START_TIMER;
    public static final String ACTION_STOP  = ACTION_CANCEL_REST;

    public static final String EXTRA_DURATION_MS      = "duration_ms";
    public static final String EXTRA_WORKOUT_START_MS = "workout_start_ms";

    private static final int NOTIF_TIMER_ID = 2001;
    static final String CHANNEL_TIMER = "workoutpro_timer";

    private Handler handler;
    private long workoutStartMs = 0;
    private long restEndMs = 0;
    private boolean isRestActive = false;
    private NotificationManager notificationManager;

    // Runs every second while the service is alive; keeps both timers current.
    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            try {
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
            } catch (Exception ignored) {}
            handler.postDelayed(this, 1000);
        }
    };

    // Fires when rest ends naturally — flip back to workout-only display.
    private final Runnable restDoneRunnable = () -> {
        isRestActive = false;
        try { notificationManager.notify(NOTIF_TIMER_ID, buildNotification()); }
        catch (Exception ignored) {}
    };

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        notificationManager = getSystemService(NotificationManager.class);
        try { createChannel(); } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            String action = (intent != null) ? intent.getAction() : ACTION_START_WORKOUT;

            if (ACTION_STOP_WORKOUT.equals(action)) {
                cancelAndStop();
                return START_NOT_STICKY;
            }

            if (ACTION_CANCEL_REST.equals(action)) {
                // Edge case: service wasn't properly started — just stop.
                if (workoutStartMs == 0) { stopSelf(); return START_NOT_STICKY; }
                isRestActive = false;
                handler.removeCallbacks(restDoneRunnable);
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
                return START_NOT_STICKY;
            }

            if (ACTION_START_TIMER.equals(action)) {
                long durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 90_000L);
                long providedMs  = intent.getLongExtra(EXTRA_WORKOUT_START_MS, 0L);
                if (providedMs > 0) workoutStartMs = providedMs;
                if (workoutStartMs == 0) workoutStartMs = System.currentTimeMillis();
                restEndMs = System.currentTimeMillis() + durationMs;
                isRestActive = true;
                handler.removeCallbacks(restDoneRunnable);
                handler.postDelayed(restDoneRunnable, durationMs);
                // startForeground is safe to call again if already in foreground — just updates notification.
                callStartForeground();
                ensureTickLoop();
                return START_NOT_STICKY;
            }

            // ACTION_START_WORKOUT — start the service and show workout timer.
            long providedMs = (intent != null) ? intent.getLongExtra(EXTRA_WORKOUT_START_MS, 0L) : 0L;
            if (providedMs > 0) workoutStartMs = providedMs;
            if (workoutStartMs == 0) workoutStartMs = System.currentTimeMillis();
            isRestActive = false;
            callStartForeground();
            ensureTickLoop();

        } catch (Exception e) {
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void ensureTickLoop() {
        handler.removeCallbacks(tickRunnable);
        handler.postDelayed(tickRunnable, 1000);
    }

    private void cancelAndStop() {
        handler.removeCallbacksAndMessages(null);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
        stopSelf();
    }

    private Notification buildNotification() {
        long workoutSec = Math.max(0, (System.currentTimeMillis() - workoutStartMs) / 1000);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_TIMER)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(buildOpenAppIntent());

        if (isRestActive && restEndMs > System.currentTimeMillis()) {
            long restSec = (restEndMs - System.currentTimeMillis() + 999) / 1000;
            b.setContentTitle("Descanso: " + fmt(restSec))
             .setContentText("Treino: " + fmt(workoutSec));
        } else {
            b.setContentTitle("Treino em andamento")
             .setContentText("Duração: " + fmt(workoutSec));
        }

        return b.build();
    }

    // Android 14+ (API 34) requires the foreground service type when the manifest declares one.
    // Without the third argument, startForeground() throws IllegalArgumentException on API 34+,
    // which our catch block silently swallows — causing the service to die with no notification.
    private void callStartForeground() {
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { // API 29+ supports the typed overload
            startForeground(NOTIF_TIMER_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH);
        } else {
            startForeground(NOTIF_TIMER_ID, n);
        }
    }

    private PendingIntent buildOpenAppIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        return PendingIntent.getActivity(this, 0, i, flags);
    }

    private static String fmt(long totalSec) {
        return String.format(Locale.US, "%02d:%02d", totalSec / 60, totalSec % 60);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_TIMER, "Timer de Treino", NotificationManager.IMPORTANCE_LOW
            );
            ch.setSound(null, null);
            ch.enableVibration(false);
            notificationManager.createNotificationChannel(ch);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
