package com.workoutpro.wear

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.health.services.client.HealthServices
import androidx.health.services.client.MeasureCallback
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.DataTypeAvailability
import androidx.health.services.client.data.DeltaDataType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.roundToInt

/** Live heart rate from the watch sensor (Health Services MeasureClient) while the UI is visible. */
class HeartRateMonitor(context: Context) {
    private val appContext = context.applicationContext
    private val client = HealthServices.getClient(appContext).measureClient
    private var registered = false

    private val _bpm = MutableStateFlow<Int?>(null)
    val bpm: StateFlow<Int?> = _bpm.asStateFlow()

    private val callback = object : MeasureCallback {
        override fun onAvailabilityChanged(dataType: DeltaDataType<*, *>, availability: Availability) {
            // Off-wrist / acquiring: hide the stale number instead of showing it as live.
            if (availability is DataTypeAvailability && availability != DataTypeAvailability.AVAILABLE) _bpm.value = null
        }

        override fun onDataReceived(data: DataPointContainer) {
            val latest = data.getData(DataType.HEART_RATE_BPM).lastOrNull()?.value ?: return
            if (latest > 0) _bpm.value = latest.roundToInt()
        }

        override fun onRegistrationFailed(throwable: Throwable) {
            registered = false
            _bpm.value = null
        }
    }

    fun start() {
        if (registered || !hasPermission(appContext)) return
        try {
            client.registerMeasureCallback(DataType.HEART_RATE_BPM, callback)
            registered = true
        } catch (error: Exception) {
            registered = false
        }
    }

    fun stop() {
        if (!registered) return
        registered = false
        try {
            client.unregisterMeasureCallbackAsync(DataType.HEART_RATE_BPM, callback)
        } catch (error: Exception) {
            // Already gone.
        }
        _bpm.value = null
    }

    companion object {
        /** Wear OS 6 (API 36) replaced BODY_SENSORS with the granular health permission. */
        val PERMISSION: String =
            if (Build.VERSION.SDK_INT >= 36) "android.permission.health.READ_HEART_RATE" else Manifest.permission.BODY_SENSORS

        fun hasPermission(context: Context): Boolean =
            ContextCompat.checkSelfPermission(context, PERMISSION) == PackageManager.PERMISSION_GRANTED
    }
}
