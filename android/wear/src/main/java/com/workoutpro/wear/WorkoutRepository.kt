package com.workoutpro.wear

import android.content.Context
import androidx.wear.tiles.TileService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Single source of truth on the watch. Fed by the phone's DataItem (listener service or a read
 * on resume) and by optimistic updates right after the user taps something on the watch.
 * The last phone state is cached so the Tile and a cold start show something immediately.
 */
object WorkoutRepository {
    private const val PREFS = "workoutpro_wear_state"
    private const val KEY_JSON = "json"
    private const val KEY_UPDATED = "updatedAt"

    private val _state = MutableStateFlow<WorkoutState?>(null)
    val state: StateFlow<WorkoutState?> = _state.asStateFlow()

    @Volatile
    private var cachedJson: String? = null

    /** updatedAt of the phone state an optimistic update was built on; re-reads of it are ignored. */
    private var optimisticBase: Long? = null

    private fun isStale(updatedAt: Long): Boolean {
        val current = _state.value ?: return false
        val base = optimisticBase
        return current.updatedAt > updatedAt || (base != null && updatedAt <= base)
    }

    fun init(context: Context) {
        if (_state.value != null) return
        _state.value = loadCached(context)
    }

    /** State straight from the phone (always authoritative unless older than what we have). */
    @Synchronized
    fun onPhoneState(context: Context, json: String, updatedAt: Long) {
        val parsed = WorkoutState.parse(json, updatedAt) ?: return
        if (isStale(updatedAt)) return
        optimisticBase = null
        _state.value = parsed
        if (json != cachedJson) {
            cachedJson = json
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_JSON, json).putLong(KEY_UPDATED, updatedAt).apply()
        }
        publish(context, parsed)
    }

    /** Local guess shown until the phone confirms (the phone's next publish replaces it). */
    @Synchronized
    fun applyOptimistic(context: Context, transform: (WorkoutState) -> WorkoutState) {
        val current = _state.value ?: return
        val next = transform(current)
        optimisticBase = current.updatedAt
        _state.value = next
        publish(context, next)
    }

    fun loadCached(context: Context): WorkoutState? {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_JSON, null) ?: return null
        cachedJson = json
        return WorkoutState.parse(json, prefs.getLong(KEY_UPDATED, 0))
    }

    private fun publish(context: Context, state: WorkoutState) {
        val app = context.applicationContext
        OngoingWorkout.update(app, state)
        try {
            TileService.getUpdater(app).requestUpdate(WorkoutTileService::class.java)
        } catch (error: Exception) {
            // Tile not added / binder unavailable: nothing to refresh.
        }
    }
}
