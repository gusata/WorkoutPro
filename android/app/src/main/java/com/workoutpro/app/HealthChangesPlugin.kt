package com.workoutpro.app

import android.content.Context
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
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
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.units.Energy
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.time.ZoneId
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
 *   Records this app wrote itself (strength sessions, weight) are skipped, so our own
 *   writes never trigger a refresh.
 *
 * It also writes the app's strength sessions (`writeExerciseSession`), which
 * @capgo/capacitor-health cannot do, and requests the write permissions they need.
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

    /** Which of the session write permissions are granted. */
    @PluginMethod
    fun writePermissions(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(unavailableWriteStatus())
            return
        }
        scope.launch {
            try {
                call.resolve(writeStatus(HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()))
            } catch (error: Exception) {
                call.reject("Falha ao ler as permissões do Health Connect", error)
            }
        }
    }

    /** Opens the Health Connect sheet for the session write permissions that are still missing. */
    @PluginMethod
    fun requestWritePermissions(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(unavailableWriteStatus())
            return
        }
        scope.launch {
            try {
                val granted = HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()
                val missing = WRITE_PERMISSIONS - granted
                if (missing.isEmpty()) {
                    call.resolve(writeStatus(granted))
                    return@launch
                }
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, missing)
                activity.runOnUiThread { startActivityForResult(call, intent, "onWritePermissionsResult") }
            } catch (error: Exception) {
                call.reject("Não foi possível pedir as permissões do Health Connect", error)
            }
        }
    }

    @ActivityCallback
    private fun onWritePermissionsResult(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        // The sheet's result only covers this request; ask Health Connect for the full picture.
        scope.launch {
            try {
                call.resolve(writeStatus(HealthConnectClient.getOrCreate(context).permissionController.getGrantedPermissions()))
            } catch (error: Exception) {
                call.reject("Falha ao ler as permissões do Health Connect", error)
            }
        }
    }

    /**
     * Inserts (or updates) a strength session and, optionally, its active calories.
     * `clientRecordId` must be stable (the app's session id): Health Connect upserts
     * records with the same client id, so finishing twice or re-syncing never duplicates.
     */
    @PluginMethod
    fun writeExerciseSession(call: PluginCall) {
        val id = call.getString("clientRecordId")
        val start = call.getString("startTime")?.let { runCatching { Instant.parse(it) }.getOrNull() }
        val end = call.getString("endTime")?.let { runCatching { Instant.parse(it) }.getOrNull() }
        if (id.isNullOrBlank() || start == null || end == null || !end.isAfter(start)) {
            call.reject("Sessão inválida")
            return
        }
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) {
            call.resolve(JSObject().put("written", false).put("reason", "unavailable"))
            return
        }
        val title = call.getString("title")
        val notes = call.getString("notes")
        val calories = call.getDouble("activeCalories")
        val version = call.getLong("version") ?: end.toEpochMilli()
        val exerciseType = when (call.getString("exerciseType")) {
            "weightlifting" -> ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING
            else -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        }
        scope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(HealthPermission.getWritePermission(ExerciseSessionRecord::class))) {
                    call.resolve(JSObject().put("written", false).put("reason", "permission"))
                    return@launch
                }
                val rules = ZoneId.systemDefault().rules
                val startOffset = rules.getOffset(start)
                val endOffset = rules.getOffset(end)
                val device = Device(type = Device.TYPE_PHONE, manufacturer = Build.MANUFACTURER, model = Build.MODEL)
                val records = mutableListOf<Record>(
                    ExerciseSessionRecord(
                        startTime = start,
                        startZoneOffset = startOffset,
                        endTime = end,
                        endZoneOffset = endOffset,
                        metadata = Metadata.activelyRecorded(device, id, version),
                        exerciseType = exerciseType,
                        title = title,
                        notes = notes,
                    )
                )
                val canWriteCalories = granted.contains(HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class))
                if (calories != null && calories > 0 && canWriteCalories) {
                    records.add(
                        ActiveCaloriesBurnedRecord(
                            startTime = start,
                            startZoneOffset = startOffset,
                            endTime = end,
                            endZoneOffset = endOffset,
                            energy = Energy.kilocalories(calories),
                            metadata = Metadata.activelyRecorded(device, "$id-kcal", version),
                        )
                    )
                }
                client.insertRecords(records)
                call.resolve(JSObject().put("written", true).put("calories", records.size > 1))
            } catch (error: SecurityException) {
                call.resolve(JSObject().put("written", false).put("reason", "permission"))
            } catch (error: Exception) {
                call.reject("Falha ao gravar o treino no Health Connect", error)
            }
        }
    }

    private fun writeStatus(granted: Set<String>) = JSObject()
        .put("available", true)
        .put("exercise", granted.contains(HealthPermission.getWritePermission(ExerciseSessionRecord::class)))
        .put("calories", granted.contains(HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class)))

    private fun unavailableWriteStatus() = JSObject().put("available", false).put("exercise", false).put("calories", false)

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
                        is UpsertionChange -> {
                            // Our own writes: the app already has that data.
                            if (change.record.metadata.dataOrigin.packageName == context.packageName) continue
                            readable.entries.firstOrNull { it.value.isInstance(change.record) }?.let { changed.add(it.key) }
                        }
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
        val WRITE_PERMISSIONS = setOf(
            HealthPermission.getWritePermission(ExerciseSessionRecord::class),
            HealthPermission.getWritePermission(ActiveCaloriesBurnedRecord::class),
        )
    }
}
