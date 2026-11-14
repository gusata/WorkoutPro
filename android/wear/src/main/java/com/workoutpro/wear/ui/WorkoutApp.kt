package com.workoutpro.wear.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.rotary.onPreRotaryScrollEvent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AlertDialog
import androidx.wear.compose.material3.AlertDialogDefaults
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.FilledTonalIconButton
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.OutlinedButton
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import com.workoutpro.wear.R
import com.workoutpro.wear.WorkoutState
import com.workoutpro.wear.formatClock
import com.workoutpro.wear.formatWeight
import kotlinx.coroutines.delay
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong
import kotlin.math.sign

interface WatchActions {
    fun start()
    fun setDone(state: WorkoutState, weight: Double, reps: Int)
    fun addRest(state: WorkoutState)
    fun skipRest(state: WorkoutState)
    fun finish(state: WorkoutState)
    fun dismissMessage()
}

private val Accent = Color(0xFF34C77B)
private val HeartRed = Color(0xFFFF5A5F)
private val Muted = Color(0xFFB0B0B5)

private enum class Field { WEIGHT, REPS }

@Composable
fun WorkoutApp(
    state: WorkoutState?,
    heartRate: Int?,
    hasHeartRatePermission: Boolean,
    ambient: Boolean,
    ambientTick: Int,
    message: String?,
    actions: WatchActions,
) {
    // Wall clock for the rest countdown; slower in ambient (the system wakes us once a minute).
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(ambient, ambientTick) {
        while (true) {
            now = System.currentTimeMillis()
            if (ambient) break
            delay(250)
        }
    }

    LaunchedEffect(message) {
        if (message != null) {
            delay(4000)
            actions.dismissMessage()
        }
    }

    val resting = state != null && state.isResting(now)
    KeepScreenOn(resting && !ambient)
    RestEndVibration(state?.restEndAt, now)

    MaterialTheme {
        if (ambient) {
            AmbientScreen(state, now)
            return@MaterialTheme
        }
        AppScaffold {
            when {
                state == null || !state.active -> IdleScreen(message, actions)
                resting -> RestScreen(state, now, heartRate, hasHeartRatePermission, message, actions)
                state.allDone -> DoneScreen(state, heartRate, hasHeartRatePermission, message, actions)
                else -> SetScreen(state, heartRate, hasHeartRatePermission, message, actions)
            }
        }
    }
}

@Composable
private fun IdleScreen(message: String?, actions: WatchActions) {
    val listState = rememberScalingLazyListState()
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxSize()) {
            item {
                Text(
                    stringResource(R.string.idle_title),
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                Button(onClick = actions::start, modifier = Modifier.fillMaxWidth(), label = {
                    Text(stringResource(R.string.idle_start), maxLines = 2)
                })
            }
            if (message != null) item { MessageText(message) }
        }
    }
}

@Composable
private fun SetScreen(
    state: WorkoutState,
    heartRate: Int?,
    hasHeartRatePermission: Boolean,
    message: String?,
    actions: WatchActions,
) {
    val key = "${state.sessionId}|${state.setId}|${state.exerciseName}|${state.setIndex}|${state.targetWeight}|${state.targetReps}"
    var weight by remember(key) { mutableDoubleStateOf(state.targetWeight) }
    var reps by remember(key) { mutableIntStateOf(state.targetReps) }
    var selected by remember(key) { mutableStateOf<Field?>(null) }
    var confirmFinish by remember { mutableStateOf(false) }
    var rotaryAccumulator by remember { mutableFloatStateOf(0f) }
    val view = LocalView.current
    val step = state.weightStep

    fun changeWeight(direction: Int) {
        weight = (((weight + direction * step) * 100).roundToLong() / 100.0).coerceIn(0.0, 999.0)
        view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
    }

    fun changeReps(direction: Int) {
        reps = (reps + direction).coerceIn(0, 200)
        view.performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
    }

    val listState = rememberScalingLazyListState()
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(
            state = listState,
            contentPadding = padding,
            modifier = Modifier
                .fillMaxSize()
                // With a value selected the crown/bezel adjusts it; otherwise it scrolls the list.
                .onPreRotaryScrollEvent { event ->
                    val field = selected ?: return@onPreRotaryScrollEvent false
                    val pixels = event.verticalScrollPixels
                    // One notch on a bezel is a large single event; a crown sends many small ones.
                    val steps = if (abs(pixels) >= ROTARY_STEP_PX) {
                        rotaryAccumulator = 0f
                        sign(pixels).toInt()
                    } else {
                        rotaryAccumulator += pixels
                        if (abs(rotaryAccumulator) >= ROTARY_STEP_PX) {
                            val direction = sign(rotaryAccumulator).toInt()
                            rotaryAccumulator = 0f
                            direction
                        } else 0
                    }
                    if (steps != 0) {
                        if (field == Field.WEIGHT) changeWeight(steps) else changeReps(steps)
                    }
                    true
                },
        ) {
            item {
                Text(
                    state.exerciseName,
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                val setLabel = stringResource(R.string.set_of, state.setIndex + 1, state.setCount) +
                    if (state.setType == "warmup") " · " + stringResource(R.string.warmup) else ""
                Text(setLabel, color = Accent, style = MaterialTheme.typography.labelMedium, textAlign = TextAlign.Center)
            }
            if (state.previousWeight != null && state.previousReps != null) {
                item {
                    Text(
                        stringResource(R.string.previous, formatWeight(state.previousWeight), state.previousReps),
                        color = Muted,
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            item {
                Stepper(
                    value = formatWeight(weight),
                    unit = stringResource(R.string.weight_unit),
                    selected = selected == Field.WEIGHT,
                    onSelect = { selected = if (selected == Field.WEIGHT) null else Field.WEIGHT },
                    onMinus = { changeWeight(-1) },
                    onPlus = { changeWeight(1) },
                    minusLabel = stringResource(R.string.decrease_weight),
                    plusLabel = stringResource(R.string.increase_weight),
                )
            }
            item {
                Stepper(
                    value = reps.toString(),
                    unit = stringResource(R.string.reps_unit),
                    selected = selected == Field.REPS,
                    onSelect = { selected = if (selected == Field.REPS) null else Field.REPS },
                    onMinus = { changeReps(-1) },
                    onPlus = { changeReps(1) },
                    minusLabel = stringResource(R.string.decrease_reps),
                    plusLabel = stringResource(R.string.increase_reps),
                )
            }
            item {
                Button(
                    onClick = {
                        view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                        actions.setDone(state, weight, reps)
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    label = {
                        Text(
                            stringResource(R.string.set_done),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    },
                )
            }
            if (message != null) item { MessageText(message) }
            item {
                Text(
                    if (selected == null) stringResource(R.string.rotary_hint) else stringResource(R.string.progress, state.doneSets, state.totalSets),
                    color = Muted,
                    style = MaterialTheme.typography.labelSmall,
                    textAlign = TextAlign.Center,
                )
            }
            item { HeartRateLabel(heartRate, hasHeartRatePermission) }
            state.next?.let { next ->
                item {
                    Text(
                        stringResource(R.string.next_label, stringResource(R.string.next_detail, next.exerciseName, formatWeight(next.weight), next.reps)),
                        color = Muted,
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                    )
                }
            }
            item {
                OutlinedButton(onClick = { confirmFinish = true }, modifier = Modifier.fillMaxWidth(), label = {
                    Text(stringResource(R.string.finish))
                })
            }
        }
    }
    FinishDialog(confirmFinish, onDismiss = { confirmFinish = false }, onConfirm = {
        confirmFinish = false
        actions.finish(state)
    })
}

@Composable
private fun Stepper(
    value: String,
    unit: String,
    selected: Boolean,
    onSelect: () -> Unit,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    minusLabel: String,
    plusLabel: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth(),
    ) {
        FilledTonalIconButton(onClick = onMinus, modifier = Modifier.size(40.dp).semantics { contentDescription = minusLabel }) {
            Text("−", fontSize = 22.sp)
        }
        Spacer(Modifier.width(6.dp))
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .width(86.dp)
                .height(44.dp)
                .border(if (selected) 2.dp else 1.dp, if (selected) Accent else Color(0x55FFFFFF), RoundedCornerShape(22.dp))
                .clickable(onClick = onSelect),
        ) {
            Text(
                "$value $unit",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                color = if (selected) Accent else Color.White,
            )
        }
        Spacer(Modifier.width(6.dp))
        FilledTonalIconButton(onClick = onPlus, modifier = Modifier.size(40.dp).semantics { contentDescription = plusLabel }) {
            Text("+", fontSize = 22.sp)
        }
    }
}

@Composable
private fun RestScreen(
    state: WorkoutState,
    now: Long,
    heartRate: Int?,
    hasHeartRatePermission: Boolean,
    message: String?,
    actions: WatchActions,
) {
    val remaining = state.restRemainingSeconds(now)
    val total = max(state.restTotal, remaining).coerceAtLeast(1)
    ScreenScaffold {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(
                progress = { remaining.toFloat() / total },
                modifier = Modifier.fillMaxSize().padding(4.dp),
            )
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(horizontal = 24.dp)) {
                Text(stringResource(R.string.rest), color = Accent, style = MaterialTheme.typography.labelMedium)
                Text(formatClock(remaining), fontSize = 40.sp, fontWeight = FontWeight.Bold)
                HeartRateLabel(heartRate, hasHeartRatePermission)
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilledTonalButton(onClick = { actions.addRest(state) }, label = { Text(stringResource(R.string.rest_add)) })
                    Button(onClick = { actions.skipRest(state) }, label = { Text(stringResource(R.string.rest_skip)) })
                }
                Spacer(Modifier.height(4.dp))
                val nextText = if (state.allDone) stringResource(R.string.all_done)
                else stringResource(R.string.next_label, stringResource(R.string.next_detail, state.exerciseName, formatWeight(state.targetWeight), state.targetReps))
                Text(nextText, color = Muted, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, maxLines = 2)
                if (message != null) MessageText(message)
            }
        }
    }
}

@Composable
private fun DoneScreen(
    state: WorkoutState,
    heartRate: Int?,
    hasHeartRatePermission: Boolean,
    message: String?,
    actions: WatchActions,
) {
    var confirmFinish by remember { mutableStateOf(false) }
    val listState = rememberScalingLazyListState()
    ScreenScaffold(scrollState = listState) { padding ->
        ScalingLazyColumn(state = listState, contentPadding = padding, modifier = Modifier.fillMaxSize()) {
            item { Text(stringResource(R.string.all_done), style = MaterialTheme.typography.titleMedium) }
            item { Text(stringResource(R.string.progress, state.doneSets, state.totalSets), color = Muted, style = MaterialTheme.typography.labelSmall) }
            item { HeartRateLabel(heartRate, hasHeartRatePermission) }
            item {
                Button(onClick = { confirmFinish = true }, modifier = Modifier.fillMaxWidth(), label = { Text(stringResource(R.string.finish)) })
            }
            if (message != null) item { MessageText(message) }
        }
    }
    FinishDialog(confirmFinish, onDismiss = { confirmFinish = false }, onConfirm = {
        confirmFinish = false
        actions.finish(state)
    })
}

@Composable
private fun FinishDialog(visible: Boolean, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(
        visible = visible,
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.finish_title)) },
        text = { Text(stringResource(R.string.finish_text)) },
        confirmButton = { AlertDialogDefaults.ConfirmButton(onClick = onConfirm) },
        dismissButton = { AlertDialogDefaults.DismissButton(onClick = onDismiss) },
    )
}

/** Low-power layout: black background, thin text, no buttons, no seconds. */
@Composable
private fun AmbientScreen(state: WorkoutState?, now: Long) {
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
            when {
                state == null || !state.active -> Text(stringResource(R.string.idle_title), color = Color.White, textAlign = TextAlign.Center)
                state.isResting(now) -> {
                    Text(stringResource(R.string.rest), color = Color.White)
                    val minutes = (state.restRemainingSeconds(now) + 59) / 60
                    Text("~$minutes min", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Light)
                }
                state.allDone -> Text(stringResource(R.string.all_done), color = Color.White)
                else -> {
                    Text(state.exerciseName, color = Color.White, textAlign = TextAlign.Center, maxLines = 2, fontWeight = FontWeight.Light)
                    Text(stringResource(R.string.set_of, state.setIndex + 1, state.setCount), color = Color.White, fontWeight = FontWeight.Light)
                    Text("${formatWeight(state.targetWeight)} kg × ${state.targetReps}", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Light)
                }
            }
        }
    }
}

@Composable
private fun HeartRateLabel(bpm: Int?, hasPermission: Boolean) {
    val text = when {
        !hasPermission -> stringResource(R.string.permission_hr)
        bpm != null -> "♥ " + stringResource(R.string.heart_rate, bpm)
        else -> "♥ " + stringResource(R.string.heart_rate_unknown)
    }
    Text(
        text,
        color = if (hasPermission) HeartRed else Muted,
        style = MaterialTheme.typography.labelSmall,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun MessageText(message: String) {
    Text(message, color = Accent, style = MaterialTheme.typography.labelSmall, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun KeepScreenOn(enabled: Boolean) {
    val view = LocalView.current
    DisposableEffect(enabled) {
        view.keepScreenOn = enabled
        onDispose { view.keepScreenOn = false }
    }
}

/** Buzzes once when a rest that was running reaches zero while the app is open. */
@Composable
private fun RestEndVibration(restEndAt: Long?, now: Long) {
    val context = LocalContext.current
    var armedFor by remember { mutableStateOf<Long?>(null) }
    LaunchedEffect(restEndAt, now) {
        val armed = armedFor
        when {
            restEndAt != null && restEndAt > now -> armedFor = restEndAt
            armed == null -> Unit
            // Reached zero (the phone may already have cleared the rest a moment earlier).
            now >= armed - 1500 && (restEndAt == null || restEndAt == armed) -> {
                armedFor = null
                vibrate(context)
            }
            // Skipped or replaced: no buzz.
            else -> armedFor = null
        }
    }
}

private fun vibrate(context: Context) {
    val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        context.getSystemService(VibratorManager::class.java)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    } ?: return
    vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 250, 120, 250, 120, 400), -1))
}

private const val ROTARY_STEP_PX = 40f
