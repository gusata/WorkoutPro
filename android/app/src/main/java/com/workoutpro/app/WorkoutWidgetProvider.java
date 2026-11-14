package com.workoutpro.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget: today's planned workout, streak, last heart rate and, during a
 * workout, elapsed time / rest countdown (Chronometer, so it ticks without updates).
 *
 * Data: NativeStore.widgetData (pushed by the web layer via WidgetPlugin.update) and
 * NativeStore.timerState (written by TimerForegroundService).
 */
public class WorkoutWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "WorkoutProWidget";
    private static final int WIDE_MIN_DP = 220;
    private static final int RC_ROOT = 5101;
    private static final int RC_ACTION = 5102;
    private static final int RC_MIDNIGHT = 5103;
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.forLanguageTag("pt-BR"));

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) render(context, manager, id);
        scheduleMidnightRefresh(context);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, id);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms != null) alarms.cancel(midnightIntent(context));
    }

    /** Re-renders every placed widget (cheap; called when data changes, never on a timer). */
    static void refreshAll(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            if (manager == null) return;
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, WorkoutWidgetProvider.class));
            for (int id : ids) render(context, manager, id);
        } catch (Exception error) {
            Log.w(TAG, "Falha ao atualizar o widget", error);
        }
    }

    private static void render(Context context, AppWidgetManager manager, int id) {
        try {
            Model model = Model.load(context);
            RemoteViews views;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Map<SizeF, RemoteViews> sizes = new HashMap<>();
                sizes.put(new SizeF(100f, 100f), build(context, model, false));
                sizes.put(new SizeF(WIDE_MIN_DP, 100f), build(context, model, true));
                views = new RemoteViews(sizes);
            } else {
                Bundle options = manager.getAppWidgetOptions(id);
                int minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
                views = build(context, model, minWidth >= WIDE_MIN_DP);
            }
            manager.updateAppWidget(id, views);
        } catch (Exception error) {
            Log.w(TAG, "Falha ao desenhar o widget " + id, error);
        }
    }

    private static RemoteViews build(Context context, Model model, boolean wide) {
        RemoteViews views = new RemoteViews(context.getPackageName(),
            wide ? R.layout.widget_workout : R.layout.widget_workout_small);

        views.setTextViewText(R.id.widget_eyebrow, model.eyebrow);
        views.setTextViewText(R.id.widget_title, model.title);
        views.setTextViewText(R.id.widget_subtitle, model.subtitle);
        views.setViewVisibility(R.id.widget_subtitle, model.subtitle.isEmpty() ? View.GONE : View.VISIBLE);

        if (model.chronometerBase != null) {
            views.setChronometer(R.id.widget_chronometer, model.chronometerBase, null, true);
            views.setChronometerCountDown(R.id.widget_chronometer, model.countDown);
            views.setViewVisibility(R.id.widget_chronometer, View.VISIBLE);
        } else {
            views.setChronometer(R.id.widget_chronometer, SystemClock.elapsedRealtime(), null, false);
            views.setViewVisibility(R.id.widget_chronometer, View.GONE);
        }

        views.setTextViewText(R.id.widget_streak, model.streakText);
        views.setTextViewText(R.id.widget_heart, model.heartText);
        if (wide) {
            views.setTextViewText(R.id.widget_heart_time, model.heartTime);
            views.setViewVisibility(R.id.widget_heart_time, model.heartTime.isEmpty() ? View.GONE : View.VISIBLE);
            views.setTextViewText(R.id.widget_action, model.actionLabel);
            views.setOnClickPendingIntent(R.id.widget_action, activityIntent(context, RC_ACTION, model.actionLink));
        }
        views.setOnClickPendingIntent(android.R.id.background, activityIntent(context, RC_ROOT, model.rootLink));
        return views;
    }

    private static PendingIntent activityIntent(Context context, int requestCode, String link) {
        Intent intent = DeepLinks.intent(context, link);
        return PendingIntent.getActivity(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Today's workout changes at midnight even when the app is closed. */
    private static void scheduleMidnightRefresh(Context context) {
        try {
            AlarmManager alarms = context.getSystemService(AlarmManager.class);
            if (alarms == null) return;
            ZoneId zone = ZoneId.systemDefault();
            long at = LocalDate.now(zone).plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli() + 60_000L;
            // Non-waking and inexact: refreshing when the screen next turns on is enough.
            alarms.set(AlarmManager.RTC, at, midnightIntent(context));
        } catch (Exception error) {
            Log.w(TAG, "Nao foi possivel agendar a virada do dia do widget", error);
        }
    }

    private static PendingIntent midnightIntent(Context context) {
        Intent intent = new Intent(context, WorkoutWidgetProvider.class).setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        int[] ids = AppWidgetManager.getInstance(context)
            .getAppWidgetIds(new ComponentName(context, WorkoutWidgetProvider.class));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        return PendingIntent.getBroadcast(context, RC_MIDNIGHT, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Everything the widget shows, derived from the stored data. */
    static final class Model {
        String eyebrow = "Hoje";
        String title = "Abra o app";
        String subtitle = "para carregar seus treinos";
        Long chronometerBase = null;
        boolean countDown = false;
        String streakText = "0 dias";
        String heartText = "— bpm";
        String heartTime = "";
        String actionLabel = "Abrir";
        String rootLink = DeepLinks.DASHBOARD;
        String actionLink = DeepLinks.DASHBOARD;

        static Model load(Context context) {
            Model model = new Model();
            JSONObject data = NativeStore.widgetData(context);
            JSONObject timer = NativeStore.timerState(context);
            ZoneId zone = ZoneId.systemDefault();
            LocalDate today = LocalDate.now(zone);
            long now = System.currentTimeMillis();

            // Streak only counts while it is still alive (last workout today or yesterday).
            int streak = data.optInt("streak", 0);
            LocalDate last = parseDay(data.optString("lastWorkoutDay", ""));
            if (last == null || last.isBefore(today.minusDays(1))) streak = 0;
            model.streakText = streak == 1 ? "1 dia" : streak + " dias";

            JSONObject heart = data.optJSONObject("heartRate");
            if (heart != null && heart.optInt("bpm", 0) > 0) {
                LocalDateTime time = LocalDateTime.ofInstant(Instant.ofEpochMilli(heart.optLong("time", 0L)), zone);
                LocalDate day = time.toLocalDate();
                if (!day.isBefore(today.minusDays(1))) {
                    model.heartText = heart.optInt("bpm") + " bpm";
                    model.heartTime = (day.equals(today) ? "às " : "ontem ") + time.format(TIME);
                }
            }

            if (data.length() > 0) {
                String names = todaysNames(data.optJSONArray("schedule"), today);
                boolean trainedToday = today.equals(last);
                if (names.isEmpty()) {
                    model.title = trainedToday ? "Treino feito" : "Descanso";
                    model.subtitle = trainedToday ? "Hoje já teve treino" : "Nenhum treino planejado";
                } else {
                    model.title = names;
                    model.subtitle = trainedToday ? "Treino de hoje concluído" : "Planejado para hoje";
                    if (!trainedToday) {
                        model.actionLabel = "Iniciar";
                        model.actionLink = DeepLinks.START_TODAY;
                    }
                }
            }

            // A running workout wins (state is only trusted while the service is alive).
            if (timer.length() > 0 && TimerForegroundService.isRunning()) {
                long startMs = timer.optLong("workoutStartMs", 0L);
                long restEnd = timer.optLong("restEndMs", 0L);
                String name = timer.optString("workoutName", "");
                int done = timer.optInt("doneSets", 0);
                int total = timer.optInt("totalSets", 0);
                String progress = total > 0 ? done + "/" + total + " séries" : "";
                model.actionLabel = "Continuar";
                model.actionLink = DeepLinks.EXECUTE;
                model.rootLink = DeepLinks.EXECUTE;
                long elapsedNow = SystemClock.elapsedRealtime();
                if (restEnd > now) {
                    model.eyebrow = "Descanso";
                    model.title = name.isEmpty() ? "Treino em andamento" : name;
                    model.subtitle = progress;
                    model.chronometerBase = elapsedNow + (restEnd - now);
                    model.countDown = true;
                } else if (startMs > 0) {
                    model.eyebrow = "Em andamento";
                    model.title = name.isEmpty() ? "Treino em andamento" : name;
                    model.subtitle = progress;
                    model.chronometerBase = elapsedNow - Math.max(0L, now - startMs);
                    model.countDown = false;
                }
            }
            return model;
        }

        /** schedule[weekday] (0 = Sunday, like JS Date.getDay) = [{id, name}]. */
        private static String todaysNames(JSONArray schedule, LocalDate today) {
            if (schedule == null) return "";
            JSONArray items = schedule.optJSONArray(today.getDayOfWeek().getValue() % 7);
            if (items == null) return "";
            StringBuilder names = new StringBuilder();
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                String name = item == null ? "" : item.optString("name", "");
                if (name.isEmpty()) continue;
                if (names.length() > 0) names.append(" + ");
                names.append(name);
            }
            return names.toString();
        }

        private static LocalDate parseDay(String value) {
            try {
                return value == null || value.isEmpty() ? null : LocalDate.parse(value);
            } catch (Exception error) {
                return null;
            }
        }
    }
}
