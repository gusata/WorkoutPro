package com.workoutpro.app.wear

import android.annotation.SuppressLint
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Durable queue of actions sent by the watch. Messages can arrive while the WebView is paused
 * or the app is not running at all, so they are written here first and the JS side drains the
 * queue (on the "actionsAvailable" event and whenever the app comes back to the foreground).
 */
// commit(): the queue must be on disk before the WebView is told to drain it.
@SuppressLint("ApplySharedPref", "UseKtx")
object WearActionStore {
    private const val PREFS = "workoutpro_wear_actions"
    private const val KEY_QUEUE = "queue"
    private const val MAX_QUEUE = 100

    val SUPPORTED_TYPES = setOf("set-done", "rest", "start", "finish")
    const val PATH_PREFIX = "/workout/"

    /** Maps "/workout/set-done" to "set-done"; null for anything we do not handle. */
    fun typeForPath(path: String): String? {
        if (!path.startsWith(PATH_PREFIX)) return null
        val type = path.removePrefix(PATH_PREFIX)
        return if (type in SUPPORTED_TYPES) type else null
    }

    @Synchronized
    fun enqueue(context: Context, type: String, payload: String, receivedAt: Long = System.currentTimeMillis()) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val queue = read(prefs.getString(KEY_QUEUE, null))
        queue.put(JSONObject().put("type", type).put("payload", payload).put("receivedAt", receivedAt))
        // Keep only the newest entries if the phone app was closed for a long time.
        val trimmed = if (queue.length() > MAX_QUEUE) {
            JSONArray().also { out -> for (i in queue.length() - MAX_QUEUE until queue.length()) out.put(queue.get(i)) }
        } else queue
        prefs.edit().putString(KEY_QUEUE, trimmed.toString()).commit()
    }

    /** Returns every queued action and empties the queue atomically. */
    @Synchronized
    fun drain(context: Context): JSONArray {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val queue = read(prefs.getString(KEY_QUEUE, null))
        if (queue.length() > 0) prefs.edit().remove(KEY_QUEUE).commit()
        return queue
    }

    @Synchronized
    fun isEmpty(context: Context): Boolean =
        read(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_QUEUE, null)).length() == 0

    private fun read(raw: String?): JSONArray = try {
        if (raw.isNullOrEmpty()) JSONArray() else JSONArray(raw)
    } catch (error: Exception) {
        JSONArray()
    }
}
