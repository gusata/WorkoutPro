package com.workoutpro.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * SharedPreferences shared by the timer service, the notification actions, the home-screen
 * widget and the Capacitor plugins.
 *
 * - Pending actions: notification buttons tapped while the WebView may be paused. The web
 *   layer drains them (consumePendingActions) and applies them to its stores.
 * - Timer state: what the foreground service is showing, so the widget can render the
 *   running workout / rest without talking to the service.
 * - Widget data: pushed by the web layer (schedule, streak, heart rate).
 */
// commit() on the action queue is deliberate: a tap must be on disk before the process can die.
@android.annotation.SuppressLint("ApplySharedPref")
final class NativeStore {
    private static final String TAG = "WorkoutProStore";
    private static final String PREFS = "workoutpro_native";
    private static final String KEY_PENDING = "pending_actions";
    private static final String KEY_WIDGET = "widget_data";
    private static final String KEY_TIMER = "timer_state";
    /** The web layer may be paused for a whole workout; cap the queue anyway. */
    private static final int MAX_PENDING = 100;

    private static final Object LOCK = new Object();

    private NativeStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---- Pending notification actions -------------------------------------------------

    static void enqueueAction(Context context, JSONObject action) {
        synchronized (LOCK) {
            JSONArray current = readArray(prefs(context).getString(KEY_PENDING, "[]"));
            current.put(action);
            while (current.length() > MAX_PENDING) current.remove(0);
            prefs(context).edit().putString(KEY_PENDING, current.toString()).commit();
        }
    }

    /** Returns every queued action and clears the queue atomically. */
    static JSONArray drainActions(Context context) {
        synchronized (LOCK) {
            JSONArray current = readArray(prefs(context).getString(KEY_PENDING, "[]"));
            prefs(context).edit().remove(KEY_PENDING).commit();
            return current;
        }
    }

    static int pendingCount(Context context) {
        synchronized (LOCK) {
            return readArray(prefs(context).getString(KEY_PENDING, "[]")).length();
        }
    }

    // ---- Widget data (from the web layer) ----------------------------------------------

    static void saveWidgetData(Context context, JSONObject data) {
        prefs(context).edit().putString(KEY_WIDGET, data.toString()).apply();
    }

    static JSONObject widgetData(Context context) {
        return readObject(prefs(context).getString(KEY_WIDGET, null));
    }

    // ---- Timer state (from the foreground service) -------------------------------------

    static void saveTimerState(Context context, JSONObject state) {
        if (state == null) prefs(context).edit().remove(KEY_TIMER).apply();
        else prefs(context).edit().putString(KEY_TIMER, state.toString()).apply();
    }

    static JSONObject timerState(Context context) {
        return readObject(prefs(context).getString(KEY_TIMER, null));
    }

    private static JSONArray readArray(String raw) {
        try {
            return new JSONArray(raw == null ? "[]" : raw);
        } catch (JSONException error) {
            Log.w(TAG, "Fila de acoes corrompida; descartando", error);
            return new JSONArray();
        }
    }

    private static JSONObject readObject(String raw) {
        if (raw == null) return new JSONObject();
        try {
            return new JSONObject(raw);
        } catch (JSONException error) {
            return new JSONObject();
        }
    }
}
