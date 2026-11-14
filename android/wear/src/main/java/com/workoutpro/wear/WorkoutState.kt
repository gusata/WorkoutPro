package com.workoutpro.wear

import org.json.JSONObject
import java.util.Locale
import kotlin.math.roundToInt

data class NextSet(
    val exerciseName: String,
    val setIndex: Int,
    val setCount: Int,
    val weight: Double,
    val reps: Int,
)

/** Snapshot published by the phone (lib/wearBridge.ts buildWearState). */
data class WorkoutState(
    val active: Boolean,
    val sessionId: String?,
    val workoutName: String,
    val startedAt: Long?,
    val exerciseId: String?,
    val exerciseName: String,
    val setId: String?,
    val setIndex: Int,
    val setCount: Int,
    val setType: String,
    val targetWeight: Double,
    val targetReps: Int,
    val targetMinReps: Int?,
    val targetMaxReps: Int?,
    val previousWeight: Double?,
    val previousReps: Int?,
    val weightStep: Double,
    val restSeconds: Int,
    val restEndAt: Long?,
    val restTotal: Int,
    val doneSets: Int,
    val totalSets: Int,
    val allDone: Boolean,
    val next: NextSet?,
    /** Phone wall-clock time of the publish; used to drop out-of-order updates. */
    val updatedAt: Long,
) {
    fun isResting(now: Long): Boolean = active && restEndAt != null && restEndAt > now

    fun restRemainingSeconds(now: Long): Int =
        if (restEndAt == null) 0 else ((restEndAt - now + 999) / 1000).toInt().coerceAtLeast(0)

    /** What the watch shows right after "Série feita", before the phone answers. */
    fun afterSetDone(now: Long): WorkoutState {
        val upcoming = next
        val rest = restSeconds.coerceAtLeast(0)
        val base = copy(
            restEndAt = if (rest > 0) now + rest * 1000L else null,
            restTotal = rest,
            doneSets = (doneSets + 1).coerceAtMost(totalSets),
            previousWeight = null,
            previousReps = null,
            next = null,
        )
        return if (upcoming == null) {
            base.copy(allDone = true, exerciseId = null, setId = null)
        } else {
            base.copy(
                exerciseId = null, setId = null,
                exerciseName = upcoming.exerciseName, setIndex = upcoming.setIndex, setCount = upcoming.setCount,
                targetWeight = upcoming.weight, targetReps = upcoming.reps,
            )
        }
    }

    fun withRestExtended(seconds: Int, now: Long): WorkoutState {
        val end = restEndAt ?: return this
        val newEnd = maxOf(now + 1000, end + seconds * 1000L)
        return copy(restEndAt = newEnd, restTotal = maxOf(restTotal + seconds, ((newEnd - now) / 1000).toInt()))
    }

    fun withRestSkipped(): WorkoutState = copy(restEndAt = null, restTotal = 0)

    companion object {
        val INACTIVE = WorkoutState(
            active = false, sessionId = null, workoutName = "", startedAt = null, exerciseId = null,
            exerciseName = "", setId = null, setIndex = 0, setCount = 0, setType = "normal",
            targetWeight = 0.0, targetReps = 0, targetMinReps = null, targetMaxReps = null,
            previousWeight = null, previousReps = null, weightStep = 2.5, restSeconds = 0,
            restEndAt = null, restTotal = 0, doneSets = 0, totalSets = 0, allDone = false,
            next = null, updatedAt = 0,
        )

        fun parse(json: String, updatedAt: Long): WorkoutState? = try {
            val o = JSONObject(json)
            val next = o.optJSONObject("next")?.let {
                NextSet(
                    exerciseName = it.optString("exerciseName"),
                    setIndex = it.optInt("setIndex"),
                    setCount = it.optInt("setCount"),
                    weight = it.optDouble("weight", 0.0),
                    reps = it.optInt("reps"),
                )
            }
            WorkoutState(
                active = o.optBoolean("active", false),
                sessionId = o.optStringOrNull("sessionId"),
                workoutName = o.optString("workoutName"),
                startedAt = o.optLongOrNull("startedAt"),
                exerciseId = o.optStringOrNull("exerciseId"),
                exerciseName = o.optString("exerciseName"),
                setId = o.optStringOrNull("setId"),
                setIndex = o.optInt("setIndex"),
                setCount = o.optInt("setCount"),
                setType = o.optString("setType", "normal"),
                targetWeight = o.optDouble("targetWeight", 0.0).let { if (it.isNaN()) 0.0 else it },
                targetReps = o.optInt("targetReps"),
                targetMinReps = o.optIntOrNull("targetMinReps"),
                targetMaxReps = o.optIntOrNull("targetMaxReps"),
                previousWeight = o.optDoubleOrNull("previousWeight"),
                previousReps = o.optIntOrNull("previousReps"),
                weightStep = o.optDouble("weightStep", 2.5).let { if (it.isNaN() || it <= 0) 2.5 else it },
                restSeconds = o.optInt("restSeconds", 90),
                restEndAt = o.optLongOrNull("restEndAt"),
                restTotal = o.optInt("restTotal"),
                doneSets = o.optInt("doneSets"),
                totalSets = o.optInt("totalSets"),
                allDone = o.optBoolean("allDone", false),
                next = next,
                updatedAt = updatedAt,
            )
        } catch (error: Exception) {
            null
        }

        private fun JSONObject.optStringOrNull(key: String): String? =
            if (isNull(key)) null else optString(key).ifEmpty { null }

        private fun JSONObject.optLongOrNull(key: String): Long? =
            if (isNull(key)) null else optDouble(key).takeIf { !it.isNaN() }?.toLong()

        private fun JSONObject.optIntOrNull(key: String): Int? =
            if (isNull(key)) null else optDouble(key).takeIf { !it.isNaN() }?.roundToInt()

        private fun JSONObject.optDoubleOrNull(key: String): Double? =
            if (isNull(key)) null else optDouble(key).takeIf { !it.isNaN() }
    }
}

/** "82,5" / "80" in pt-BR style. */
fun formatWeight(value: Double): String {
    val rounded = (value * 100).roundToInt() / 100.0
    return if (rounded % 1.0 == 0.0) rounded.toLong().toString()
    else String.format(Locale.ROOT, "%.2f", rounded).trimEnd('0').trimEnd('.').replace('.', ',')
}

fun formatClock(totalSeconds: Int): String {
    val s = totalSeconds.coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}
