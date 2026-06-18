package com.workoutpro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;

public class TimerForegroundService extends Service {

    public static final String ACTION_START = "com.workoutpro.app.START_TIMER";
    public static final String ACTION_STOP  = "com.workoutpro.app.STOP_TIMER";
    public static final String EXTRA_DURATION_MS = "duration_ms";

    private static final int NOTIF_TIMER_ID = 2001;
    static final String CHANNEL_TIMER = "workoutpro_timer";

    private Handler handler;
    private long endTimeMs;

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        try { createChannels(); } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            if (intent != null && ACTION_STOP.equals(intent.getAction())) {
                cancelAndStop();
                return START_NOT_STICKY;
            }

            long durationMs = (intent != null)
                ? intent.getLongExtra(EXTRA_DURATION_MS, 90_000L)
                : 90_000L;
            endTimeMs = System.currentTimeMillis() + durationMs;

            Notification notification = buildTimerNotification();
            startForeground(NOTIF_TIMER_ID, notification);

            if (handler != null) {
                handler.removeCallbacksAndMessages(null);
                handler.postDelayed(this::onTimerComplete, durationMs);
            }
        } catch (Exception e) {
            // If anything fails (bad icon, channel missing, permission issue, etc.)
            // stop the service gracefully instead of crashing the app.
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void cancelAndStop() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
        stopSelf();
    }

    private Notification buildTimerNotification() {
        // Use the app's own launcher icon — guaranteed to exist on every device.
        int iconRes = R.mipmap.ic_launcher;

        PendingIntent openApp = buildOpenAppIntent(0);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_TIMER)
            .setSmallIcon(iconRes)
            .setContentTitle("Descansando...")
            .setContentText("Próxima série em breve")
            .setUsesChronometer(true)
            .setWhen(endTimeMs)
            .setShowWhen(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(openApp);

        // Countdown chronometer: show count down from endTimeMs (API 24+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            builder.setChronometerCountDown(true);
        }

        return builder.build();
    }

    private void onTimerComplete() {
        // The countdown is done — just remove the foreground notification and stop.
        // The "rest ended" alert is handled by @capacitor/local-notifications
        // scheduled from JavaScript, so we don't duplicate it here.
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
        stopSelf();
    }

    private PendingIntent buildOpenAppIntent(int requestCode) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            : PendingIntent.FLAG_UPDATE_CURRENT;
        return PendingIntent.getActivity(this, requestCode, openIntent, flags);
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel timerCh = new NotificationChannel(
                CHANNEL_TIMER, "Timer de Descanso", NotificationManager.IMPORTANCE_LOW
            );
            timerCh.setSound(null, null);
            timerCh.enableVibration(false);
            nm.createNotificationChannel(timerCh);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (handler != null) handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
