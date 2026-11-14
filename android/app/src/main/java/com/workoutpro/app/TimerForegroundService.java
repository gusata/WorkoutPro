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
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

public class TimerForegroundService extends Service {
    private static final String TAG = "WorkoutProTimer";

    public static final String ACTION_START_WORKOUT = "com.workoutpro.app.START_WORKOUT";
    public static final String ACTION_STOP_WORKOUT  = "com.workoutpro.app.STOP_WORKOUT";
    public static final String ACTION_START_TIMER   = "com.workoutpro.app.START_TIMER";
    public static final String ACTION_CANCEL_REST   = "com.workoutpro.app.CANCEL_REST";
    public static final String ACTION_UPDATE_STATUS = "com.workoutpro.app.UPDATE_STATUS";

    // Legacy aliases kept so AndroidManifest and any existing references still compile.
    public static final String ACTION_START = ACTION_START_TIMER;
    public static final String ACTION_STOP  = ACTION_CANCEL_REST;

    public static final String EXTRA_DURATION_MS      = "duration_ms";
    public static final String EXTRA_WORKOUT_START_MS = "workout_start_ms";
    public static final String EXTRA_WORKOUT_NAME     = "workout_name";
    public static final String EXTRA_CURRENT          = "current_exercise";
    public static final String EXTRA_NEXT             = "next_step";
    public static final String EXTRA_DONE_SETS        = "done_sets";
    public static final String EXTRA_TOTAL_SETS       = "total_sets";

    private static final int NOTIF_TIMER_ID = 2001;
    static final String CHANNEL_TIMER = "workoutpro_timer";

    private Handler handler;
    private long workoutStartMs = 0;
    private long restEndMs = 0;
    private boolean isRestActive = false;
    // "Live activity" content pushed by the web app (what to do now / next).
    private String workoutName = null;
    private String currentExercise = null;
    private String nextStep = null;
    private int doneSets = 0;
    private int totalSets = 0;
    private NotificationManager notificationManager;

    // Runs every second while the service is alive; keeps both timers current.
    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            try {
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
            } catch (Exception error) {
                Log.e(TAG, "Falha ao atualizar a notificacao do timer", error);
            }
            handler.postDelayed(this, 1000);
        }
    };

    // Fires when rest ends naturally — flip back to workout-only display.
    private final Runnable restDoneRunnable = () -> {
        isRestActive = false;
        try { notificationManager.notify(NOTIF_TIMER_ID, buildNotification()); }
        catch (Exception error) { Log.e(TAG, "Falha ao encerrar o descanso", error); }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        notificationManager = getSystemService(NotificationManager.class);
        try { createChannel(); }
        catch (Exception error) { Log.e(TAG, "Falha ao criar o canal de notificacao", error); }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            String action = (intent != null) ? intent.getAction() : ACTION_START_WORKOUT;

            if (ACTION_STOP_WORKOUT.equals(action)) {
                cancelAndStop();
                return START_NOT_STICKY;
            }

            if (ACTION_UPDATE_STATUS.equals(action)) {
                workoutName = intent.getStringExtra(EXTRA_WORKOUT_NAME);
                currentExercise = intent.getStringExtra(EXTRA_CURRENT);
                nextStep = intent.getStringExtra(EXTRA_NEXT);
                doneSets = intent.getIntExtra(EXTRA_DONE_SETS, 0);
                totalSets = intent.getIntExtra(EXTRA_TOTAL_SETS, 0);
                // Only refresh an already running notification; never start the service from here.
                if (workoutStartMs == 0) { stopSelf(); return START_NOT_STICKY; }
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
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
            Log.e(TAG, "Falha ao processar comando do timer", e);
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
        workoutName = null; currentExercise = null; nextStep = null; doneSets = 0; totalSets = 0;
        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Exception error) {
            Log.e(TAG, "Falha ao remover a notificacao foreground", error);
        }
        stopSelf();
    }

    private Notification buildNotification() {
        long workoutSec = Math.max(0, (System.currentTimeMillis() - workoutStartMs) / 1000);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_TIMER)
            .setSmallIcon(R.drawable.ic_stat_workoutpro)
            .setColor(getColor(R.color.brand_accent))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            // Shown in full on the lock screen: it only contains the workout progress.
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(buildOpenAppIntent());

        String name = (workoutName != null && !workoutName.isEmpty()) ? workoutName : "Treino em andamento";
        String progress = totalSets > 0 ? doneSets + "/" + totalSets + " séries" : null;

        if (isRestActive && restEndMs > System.currentTimeMillis()) {
            long restSec = (restEndMs - System.currentTimeMillis() + 999) / 1000;
            String next = (nextStep != null && !nextStep.isEmpty()) ? "A seguir: " + nextStep : "Treino: " + fmt(workoutSec);
            b.setContentTitle("Descanso " + fmt(restSec))
             .setContentText(next)
             .setSubText(name);
        } else {
            String now = (currentExercise != null && !currentExercise.isEmpty()) ? currentExercise : "Duração: " + fmt(workoutSec);
            b.setContentTitle(name + " · " + fmt(workoutSec))
             .setContentText(now);
            if (progress != null) b.setSubText(progress);
        }
        if (totalSets > 0) b.setProgress(totalSets, Math.min(doneSets, totalSets), false);

        return b.build();
    }

    // Android 14+ requires the declared foreground-service type in the typed overload.
    @SuppressWarnings("deprecation")
    private void callStartForeground() {
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIF_TIMER_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_TIMER_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MANIFEST);
        } else {
            startForeground(NOTIF_TIMER_ID, n);
        }
    }

    private PendingIntent buildOpenAppIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
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
