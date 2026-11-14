package com.workoutpro.app

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ChangesTokenRequest
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.reflect.KClass

/**
 * Tells the web layer *which* Health Connect data changed since the last check, using the
 * Changes API (a sync token). A check with no news is a single cheap local call, so the app
 * can ask every few seconds while it is open instead of re-reading history.
 *
 * Result of `check()`:
 * - `available: false` when Health Connect is not installed / supported.
 * - `reset: true` when there was no usable token (first run, permissions changed, token
 *   expired): the caller should do one full read. A fresh token is already stored.
 * - otherwise `changed`: the data types with new, edited or deleted records
 *   ("deleted" when Health Connect does not say which type a deletion was).
 */
@CapacitorPlugin(name = "HealthChanges")
class HealthChangesPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()

    private val types: Map<String, KClass<out Record>> = linkedMapOf(
        "heartRate" to HeartRateRecord::class,
        "steps" to StepsRecord::class,
        "sleep" to SleepSessionRecord::class,
        "workouts" to ExerciseSessionRecord::class,
        "restingHeartRate" to RestingHeartRateRecord::class,
        "heartRateVariability" to HeartRateVariabilityRmssdRecord::class,
        "vo2Max" to Vo2MaxRecord::class,
        "weight" to WeightRecord::class,
        "bodyFat" to BodyFatRecord::class,
    )

    private val prefs by lazy { context.getSharedPreferences("health_changes", Context.MODE_PRIVATE) }

    @PluginMethod
    fun check(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().put("available", false))
            return
        }
        scope.launch {
            try {
                lock.withLock { call.resolve(runCheck(HealthConnectClient.getOrCreate(context))) }
            } catch (error: Exception) {
                call.reject("Falha ao verificar mudanças no Health Connect", error)
            }
        }
    }

    /** Forgets the token, e.g. after the user disconnects health sync. */
    @PluginMethod
    fun reset(call: PluginCall) {
        prefs.edit().clear().apply()
        call.resolve()
    }

    private suspend fun runCheck(client: HealthConnectClient): JSObject {
        val granted = client.permissionController.getGrantedPermissions()
        val readable = types.filterValues { granted.contains(HealthPermission.getReadPermission(it)) }
        if (readable.isEmpty()) {
            prefs.edit().clear().apply()
            return JSObject().put("available", true).put("changed", JSArray()).put("reset", false)
        }

        // A token only covers the types it was created for; new permissions need a new one.
        val signature = readable.keys.sorted().joinToString(",")
        val token = prefs.getString(KEY_TOKEN, null)?.takeIf { prefs.getString(KEY_TYPES, null) == signature }
        if (token == null) {
            storeNewToken(client, readable, signature)
            return result(reset = true, changed = emptySet())
        }

        val changed = linkedSetOf<String>()
        var next: String = token
        try {
            do {
                val response = client.getChanges(next)
                if (response.changesTokenExpired) {
                    storeNewToken(client, readable, signature)
                    return result(reset = true, changed = emptySet())
                }
                for (change in response.changes) {
                    when (change) {
                        is UpsertionChange -> readable.entries.firstOrNull { it.value.isInstance(change.record) }?.let { changed.add(it.key) }
                        is DeletionChange -> changed.add("deleted")
                    }
                }
                next = response.nextChangesToken
            } while (response.hasMore)
        } catch (error: SecurityException) {
            // A permission was revoked between the check above and the read.
            prefs.edit().clear().apply()
            return result(reset = true, changed = emptySet())
        }
        prefs.edit().putString(KEY_TOKEN, next).apply()
        return result(reset = false, changed = changed)
    }

    private suspend fun storeNewToken(client: HealthConnectClient, readable: Map<String, KClass<out Record>>, signature: String) {
        val token = client.getChangesToken(ChangesTokenRequest(recordTypes = readable.values.toSet()))
        prefs.edit().putString(KEY_TOKEN, token).putString(KEY_TYPES, signature).apply()
    }

    private fun result(reset: Boolean, changed: Set<String>): JSObject {
        val list = JSArray()
        changed.forEach { list.put(it) }
        return JSObject().put("available", true).put("reset", reset).put("changed", list)
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    private companion object {
        const val KEY_TOKEN = "token"
        const val KEY_TYPES = "types"
    }
}
