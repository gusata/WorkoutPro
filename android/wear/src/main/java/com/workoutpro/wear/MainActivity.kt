package com.workoutpro.wear

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.wear.ambient.AmbientLifecycleObserver
import com.workoutpro.wear.ui.WatchActions
import com.workoutpro.wear.ui.WorkoutApp
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private val ambient = mutableStateOf(false)
    /** Bumped once a minute by the system while in ambient mode, so the clock-based UI refreshes. */
    private val ambientTick = mutableIntStateOf(0)
    private val message = mutableStateOf<String?>(null)
    private val hrPermission = mutableStateOf(false)
    private lateinit var heartRate: HeartRateMonitor

    private val ambientObserver = AmbientLifecycleObserver(
        this,
        object : AmbientLifecycleObserver.AmbientLifecycleCallback {
            override fun onEnterAmbient(ambientDetails: AmbientLifecycleObserver.AmbientDetails) {
                ambient.value = true
                // Saves battery; the reading would only refresh once a minute anyway.
                heartRate.stop()
            }

            override fun onUpdateAmbient() {
                ambientTick.intValue += 1
            }

            override fun onExitAmbient() {
                ambient.value = false
                heartRate.start()
            }
        },
    )

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            hrPermission.value = HeartRateMonitor.hasPermission(this)
            if (hrPermission.value && !ambient.value) heartRate.start()
            // Notification permission may have just been granted: show the ongoing activity.
            WorkoutRepository.state.value?.let { OngoingWorkout.update(applicationContext, it) }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WorkoutRepository.init(this)
        heartRate = HeartRateMonitor(this)
        hrPermission.value = HeartRateMonitor.hasPermission(this)
        lifecycle.addObserver(ambientObserver)
        requestMissingPermissions()

        val actions = object : WatchActions {
            override fun start() = send(PhoneLink.PATH_START, JSONObject(), null, getString(R.string.idle_sent))

            override fun setDone(state: WorkoutState, weight: Double, reps: Int) = send(
                PhoneLink.PATH_SET_DONE,
                JSONObject()
                    .put("sessionId", state.sessionId)
                    .put("exerciseId", state.exerciseId)
                    .put("setId", state.setId)
                    .put("weight", weight)
                    .put("reps", reps),
                { it.afterSetDone(System.currentTimeMillis()) },
            )

            override fun addRest(state: WorkoutState) = send(
                PhoneLink.PATH_REST,
                JSONObject().put("sessionId", state.sessionId).put("op", "extend").put("seconds", 15),
                { it.withRestExtended(15, System.currentTimeMillis()) },
            )

            override fun skipRest(state: WorkoutState) = send(
                PhoneLink.PATH_REST,
                JSONObject().put("sessionId", state.sessionId).put("op", "skip"),
                { it.withRestSkipped() },
            )

            override fun finish(state: WorkoutState) = send(
                PhoneLink.PATH_FINISH,
                JSONObject().put("sessionId", state.sessionId),
                { WorkoutState.INACTIVE.copy(updatedAt = it.updatedAt) },
            )

            override fun dismissMessage() {
                message.value = null
            }
        }

        setContent {
            val state by WorkoutRepository.state.collectAsState()
            val bpm by heartRate.bpm.collectAsState()
            WorkoutApp(
                state = state,
                heartRate = bpm,
                hasHeartRatePermission = hrPermission.value,
                ambient = ambient.value,
                ambientTick = ambientTick.intValue,
                message = message.value,
                actions = actions,
            )
        }
    }

    override fun onResume() {
        super.onResume()
        hrPermission.value = HeartRateMonitor.hasPermission(this)
        if (!ambient.value) heartRate.start()
        // The listener service may have missed updates while the watch was disconnected.
        lifecycleScope.launch {
            PhoneLink.readState(applicationContext)?.let { (json, updatedAt) ->
                WorkoutRepository.onPhoneState(applicationContext, json, updatedAt)
            }
        }
    }

    override fun onPause() {
        heartRate.stop()
        super.onPause()
    }

    private fun send(path: String, payload: JSONObject, optimistic: ((WorkoutState) -> WorkoutState)?, okMessage: String? = null) {
        lifecycleScope.launch {
            val sent = PhoneLink.send(applicationContext, path, payload)
            if (sent) {
                optimistic?.let { WorkoutRepository.applyOptimistic(applicationContext, it) }
                message.value = okMessage
            } else {
                message.value = getString(R.string.phone_unreachable)
            }
        }
    }

    private fun requestMissingPermissions() {
        val wanted = buildList {
            add(HeartRateMonitor.PERMISSION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
        }.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (wanted.isNotEmpty()) permissionLauncher.launch(wanted.toTypedArray())
    }
}
