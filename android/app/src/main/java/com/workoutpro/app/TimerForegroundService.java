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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class TimerForegroundService extends Service {
    private static final String TAG = "WorkoutProTimer";

    public static final String ACTION_START_WORKOUT = "com.workoutpro.app.START_WORKOUT";
    public static final String ACTION_STOP_WORKOUT  = "com.workoutpro.app.STOP_WORKOUT";
    public static final String ACTION_START_TIMER   = "com.workoutpro.app.START_TIMER";
    public static final String ACTION_CANCEL_REST   = "com.workoutpro.app.CANCEL_REST";
    public static final String ACTION_UPDATE_STATUS = "com.workoutpro.app.UPDATE_STATUS";

    // Notification buttons. Handled here (works with the screen locked and the WebView paused)
    // and mirrored to the web layer through NativeStore's pending-action queue + TimerPlugin events.
    public static final String ACTION_NOTIF_ADD_REST     = "com.workoutpro.app.NOTIF_ADD_REST";
    public static final String ACTION_NOTIF_SKIP_REST    = "com.workoutpro.app.NOTIF_SKIP_REST";
    public static final String ACTION_NOTIF_COMPLETE_SET = "com.workoutpro.app.NOTIF_COMPLETE_SET";

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
    /** JSON array of {exerciseId, setId, restSeconds, label}: the sets still to do, in order. */
    public static final String EXTRA_PENDING_JSON     = "pending_json";
    /** Identifies the state a notification button was rendered for (stale taps are ignored). */
    static final String EXTRA_TOKEN                   = "action_token";

    static final long EXTEND_REST_MS = 15_000L;
    /** Two taps on the same button closer than this are treated as one (accidental double tap). */
    private static final long DOUBLE_TAP_MS = 700L;

    private static final int NOTIF_TIMER_ID = 2001;
    static final String CHANNEL_TIMER = "workoutpro_timer";

    /** True while this service instance is alive; the widget uses it to discard stale state. */
    private static volatile boolean running = false;

    static boolean isRunning() { return running; }

    private static final class PendingStep {
        final String exerciseId;
        final String setId;
        final int restSeconds;
        final String label;

        PendingStep(String exerciseId, String setId, int restSeconds, String label) {
            this.exerciseId = exerciseId;
            this.setId = setId;
            this.restSeconds = restSeconds;
            this.label = label;
        }
    }

    private Handler handler;
    private long workoutStartMs = 0;
    private long restEndMs = 0;
    private long restTotalMs = 0;
    private boolean isRestActive = false;
    /** The rest end was set from a notification button: this service owns the end alert. */
    private boolean nativeAlert = false;
    // "Live activity" content pushed by the web app (what to do now / next).
    private String workoutName = null;
    private String currentExercise = null;
    private String nextStep = null;
    private int doneSets = 0;
    private int totalSets = 0;
    private final List<PendingStep> pending = new ArrayList<>();
    /** Sets completed from the notification that the web layer may not know about yet. */
    private final Set<String> completedNatively = new HashSet<>();
    private final Map<String, Long> lastTapAt = new HashMap<>();
    private String widgetKey = null;
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
        long token = restEndMs;
        boolean alert = nativeAlert;
        isRestActive = false;
        try { notificationManager.notify(NOTIF_TIMER_ID, buildNotification()); }
        catch (Exception error) { Log.e(TAG, "Falha ao encerrar o descanso", error); }
        // Fire the alert before the state forgets the rest (the alarm is the fallback in deep sleep).
        if (alert) RestAlarmReceiver.fire(this, token);
        nativeAlert = false;
        persistState(true);
    };

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
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

            if (ACTION_NOTIF_ADD_REST.equals(action) || ACTION_NOTIF_SKIP_REST.equals(action)
                || ACTION_NOTIF_COMPLETE_SET.equals(action)) {
                // A tap on a notification of a service that died in the meantime: nothing to update.
                if (workoutStartMs == 0) { stopSelf(); return START_NOT_STICKY; }
                handleNotificationAction(action, intent);
                return START_NOT_STICKY;
            }

            if (ACTION_UPDATE_STATUS.equals(action)) {
                workoutName = intent.getStringExtra(EXTRA_WORKOUT_NAME);
                currentExercise = intent.getStringExtra(EXTRA_CURRENT);
                nextStep = intent.getStringExtra(EXTRA_NEXT);
                totalSets = intent.getIntExtra(EXTRA_TOTAL_SETS, 0);
                int reportedDone = intent.getIntExtra(EXTRA_DONE_SETS, 0);
                int unknownToWeb = readPending(intent.getStringExtra(EXTRA_PENDING_JSON));
                doneSets = Math.min(totalSets, reportedDone + unknownToWeb);
                // Only refresh an already running notification; never start the service from here.
                if (workoutStartMs == 0) { stopSelf(); return START_NOT_STICKY; }
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
                persistState(false);
                return START_NOT_STICKY;
            }

            if (ACTION_CANCEL_REST.equals(action)) {
                // Edge case: service wasn't properly started — just stop.
                if (workoutStartMs == 0) { stopSelf(); return START_NOT_STICKY; }
                endRest();
                notificationManager.notify(NOTIF_TIMER_ID, buildNotification());
                persistState(true);
                return START_NOT_STICKY;
            }

            if (ACTION_START_TIMER.equals(action)) {
                long durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 90_000L);
                long providedMs  = intent.getLongExtra(EXTRA_WORKOUT_START_MS, 0L);
                if (providedMs > 0) workoutStartMs = providedMs;
                if (workoutStartMs == 0) workoutStartMs = System.currentTimeMillis();
                // Started by the web layer, which schedules its own end alert.
                startRest(durationMs, false);
                // startForeground is safe to call again if already in foreground — just updates notification.
                callStartForeground();
                ensureTickLoop();
                persistState(true);
                return START_NOT_STICKY;
            }

            // ACTION_START_WORKOUT — start the service and show workout timer.
            long providedMs = (intent != null) ? intent.getLongExtra(EXTRA_WORKOUT_START_MS, 0L) : 0L;
            if (providedMs > 0 && providedMs != workoutStartMs) {
                // A different session: forget what the previous one completed natively.
                completedNatively.clear();
                pending.clear();
                workoutStartMs = providedMs;
            }
            if (workoutStartMs == 0) workoutStartMs = System.currentTimeMillis();
            endRest();
            callStartForeground();
            ensureTickLoop();
            persistState(true);

        } catch (Exception e) {
            Log.e(TAG, "Falha ao processar comando do timer", e);
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    // ---- Notification buttons -----------------------------------------------------------

    private void handleNotificationAction(String action, Intent intent) {
        long now = System.currentTimeMillis();
        Long last = lastTapAt.get(action);
        if (last != null && now - last < DOUBLE_TAP_MS) return;
        String token = intent.getStringExtra(EXTRA_TOKEN);

        JSONObject event = new JSONObject();
        try {
            event.put("id", UUID.randomUUID().toString());
            event.put("at", now);
            event.put("workoutStartedAt", workoutStartMs);

            if (ACTION_NOTIF_ADD_REST.equals(action)) {
                if (!restVisible() || !Objects.equals(token, restToken())) return;
                startRest(restEndMs - now + EXTEND_REST_MS, true, restTotalMs + EXTEND_REST_MS);
                event.put("type", "extendRest");
                event.put("restEndAt", restEndMs);
                event.put("restTotal", restTotalMs / 1000);
            } else if (ACTION_NOTIF_SKIP_REST.equals(action)) {
                if (!restVisible() || !Objects.equals(token, restToken())) return;
                endRest();
                event.put("type", "skipRest");
            } else {
                PendingStep head = pending.isEmpty() ? null : pending.get(0);
                if (head == null || !head.setId.equals(token) || completedNatively.contains(head.setId)) return;
                pending.remove(0);
                completedNatively.add(head.setId);
                doneSets = Math.min(totalSets > 0 ? totalSets : Integer.MAX_VALUE, doneSets + 1);
                event.put("type", "completeSet");
                event.put("exerciseId", head.exerciseId);
                event.put("setId", head.setId);
                if (head.restSeconds > 0) {
                    startRest(head.restSeconds * 1000L, true);
                    event.put("restEndAt", restEndMs);
                    event.put("restTotal", head.restSeconds);
                } else {
                    endRest();
                }
            }
        } catch (JSONException error) {
            Log.e(TAG, "Falha ao montar a acao da notificacao", error);
            return;
        }

        lastTapAt.put(action, now);
        NativeStore.enqueueAction(this, event);
        TimerPlugin.emitNotificationAction(event);
        try { notificationManager.notify(NOTIF_TIMER_ID, buildNotification()); }
        catch (Exception error) { Log.e(TAG, "Falha ao atualizar a notificacao", error); }
        persistState(true);
    }

    private void startRest(long durationMs, boolean ownAlert) {
        startRest(durationMs, ownAlert, durationMs);
    }

    private void startRest(long durationMs, boolean ownAlert, long totalMs) {
        long duration = Math.max(1000L, durationMs);
        restEndMs = System.currentTimeMillis() + duration;
        restTotalMs = Math.max(duration, totalMs);
        isRestActive = true;
        nativeAlert = ownAlert;
        handler.removeCallbacks(restDoneRunnable);
        handler.postDelayed(restDoneRunnable, duration);
        if (ownAlert) RestAlarmReceiver.schedule(this, restEndMs);
        else RestAlarmReceiver.cancel(this);
    }

    private void endRest() {
        isRestActive = false;
        nativeAlert = false;
        handler.removeCallbacks(restDoneRunnable);
        RestAlarmReceiver.cancel(this);
    }

    private boolean restVisible() {
        return isRestActive && restEndMs > System.currentTimeMillis();
    }

    private String restToken() {
        return "rest:" + restEndMs;
    }

    /** Replaces the pending steps; returns how many sets were completed here but not yet in the web layer. */
    private int readPending(String json) {
        if (json == null) return 0;
        pending.clear();
        int unknown = 0;
        try {
            JSONArray items = new JSONArray(json);
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                if (item == null) continue;
                String setId = item.optString("setId", "");
                if (setId.isEmpty()) continue;
                if (completedNatively.contains(setId)) { unknown++; continue; }
                pending.add(new PendingStep(
                    item.optString("exerciseId", ""), setId,
                    Math.max(0, item.optInt("restSeconds", 0)), item.optString("label", "")
                ));
            }
        } catch (JSONException error) {
            Log.w(TAG, "Lista de series pendentes invalida", error);
        }
        return unknown;
    }

    // ---- Notification ----------------------------------------------------------------

    private void ensureTickLoop() {
        handler.removeCallbacks(tickRunnable);
        handler.postDelayed(tickRunnable, 1000);
    }

    private void cancelAndStop() {
        handler.removeCallbacksAndMessages(null);
        RestAlarmReceiver.cancel(this);
        workoutName = null; currentExercise = null; nextStep = null; doneSets = 0; totalSets = 0;
        pending.clear(); completedNatively.clear();
        workoutStartMs = 0; isRestActive = false;
        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Exception error) {
            Log.e(TAG, "Falha ao remover a notificacao foreground", error);
        }
        persistState(true);
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
        PendingStep head = pending.isEmpty() ? null : pending.get(0);
        String headLabel = head != null && !head.label.isEmpty() ? head.label : null;
        boolean everythingDone = !completedNatively.isEmpty() && head == null;

        if (restVisible()) {
            long restSec = (restEndMs - System.currentTimeMillis() + 999) / 1000;
            String upcoming = headLabel != null ? headLabel : (everythingDone ? "Finalizar o treino" : nextStep);
            String next = (upcoming != null && !upcoming.isEmpty()) ? "A seguir: " + upcoming : "Treino: " + fmt(workoutSec);
            b.setContentTitle("Descanso " + fmt(restSec))
             .setContentText(next)
             .setSubText(name);
            String token = restToken();
            b.addAction(action(R.drawable.ic_action_add, "+15 s", ACTION_NOTIF_ADD_REST, token));
            b.addAction(action(R.drawable.ic_action_skip, "Pular descanso", ACTION_NOTIF_SKIP_REST, token));
        } else {
            String current = headLabel != null ? headLabel : (everythingDone ? "Tudo feito. Finalize o treino." : currentExercise);
            String now = (current != null && !current.isEmpty()) ? current : "Duração: " + fmt(workoutSec);
            b.setContentTitle(name + " · " + fmt(workoutSec))
             .setContentText(now);
            if (progress != null) b.setSubText(progress);
        }
        if (head != null) {
            b.addAction(action(R.drawable.ic_action_check, "Série feita", ACTION_NOTIF_COMPLETE_SET, head.setId));
        }
        if (totalSets > 0) b.setProgress(totalSets, Math.min(doneSets, totalSets), false);

        return b.build();
    }

    private NotificationCompat.Action action(int icon, String title, String action, String token) {
        Intent intent = new Intent(this, TimerForegroundService.class).setAction(action);
        intent.putExtra(EXTRA_TOKEN, token);
        // One PendingIntent per (button, state): a tap on an outdated rendering keeps its old
        // token and is ignored instead of acting on the newer state.
        int requestCode = Objects.hash(action, token);
        PendingIntent pi = PendingIntent.getService(this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Action.Builder(icon, title, pi).build();
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
        Intent i = DeepLinks.intent(this, DeepLinks.EXECUTE);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 0, i, flags);
    }

    // ---- Widget state ------------------------------------------------------------------

    /** Saves what the widget needs; refreshes widgets when something they show changed. */
    private void persistState(boolean force) {
        try {
            JSONObject state = null;
            if (workoutStartMs > 0) {
                state = new JSONObject();
                state.put("workoutStartMs", workoutStartMs);
                state.put("workoutName", workoutName == null ? "" : workoutName);
                state.put("restEndMs", restVisible() ? restEndMs : 0L);
                state.put("nativeAlert", nativeAlert);
                state.put("doneSets", doneSets);
                state.put("totalSets", totalSets);
            }
            String key = state == null ? "" : state.toString();
            if (!force && key.equals(widgetKey)) return;
            widgetKey = key;
            NativeStore.saveTimerState(this, state);
            WorkoutWidgetProvider.refreshAll(this);
        } catch (Exception error) {
            Log.w(TAG, "Falha ao salvar o estado do timer para o widget", error);
        }
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
        running = false;
        if (handler != null) handler.removeCallbacksAndMessages(null);
        // stopService() from the web layer lands here without ACTION_STOP_WORKOUT.
        RestAlarmReceiver.cancel(this);
        NativeStore.saveTimerState(this, null);
        WorkoutWidgetProvider.refreshAll(this);
        super.onDestroy();
    }
}
