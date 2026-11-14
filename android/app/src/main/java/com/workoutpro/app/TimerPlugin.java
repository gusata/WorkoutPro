package com.workoutpro.app;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerPlugin")
public class TimerPlugin extends Plugin {

    @PluginMethod
    public void startWorkout(PluginCall call) {
        try {
            Double rawMs = call.getDouble("workoutStartedAt");
            long workoutStartedAt = (rawMs != null) ? rawMs.longValue() : System.currentTimeMillis();

            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            intent.setAction(TimerForegroundService.ACTION_START_WORKOUT);
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_START_MS, workoutStartedAt);
            startService(intent);
        } catch (Exception error) {
            call.reject("Nao foi possivel iniciar o timer de treino", error);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopWorkout(PluginCall call) {
        try {
            // stopService() is the safest way to stop — requires no special permissions.
            getContext().stopService(new Intent(getContext(), TimerForegroundService.class));
        } catch (Exception error) {
            call.reject("Nao foi possivel parar o timer de treino", error);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void startTimer(PluginCall call) {
        try {
            int seconds = call.getInt("seconds", 90);
            Double rawMs = call.getDouble("workoutStartedAt");
            long workoutStartedAt = (rawMs != null) ? rawMs.longValue() : System.currentTimeMillis();

            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            intent.setAction(TimerForegroundService.ACTION_START_TIMER);
            intent.putExtra(TimerForegroundService.EXTRA_DURATION_MS, (long) seconds * 1000L);
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_START_MS, workoutStartedAt);
            startService(intent);
        } catch (Exception error) {
            call.reject("Nao foi possivel iniciar o descanso", error);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void updateStatus(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            intent.setAction(TimerForegroundService.ACTION_UPDATE_STATUS);
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_NAME, call.getString("workoutName", ""));
            intent.putExtra(TimerForegroundService.EXTRA_CURRENT, call.getString("current", ""));
            intent.putExtra(TimerForegroundService.EXTRA_NEXT, call.getString("next", ""));
            intent.putExtra(TimerForegroundService.EXTRA_DONE_SETS, call.getInt("doneSets", 0));
            intent.putExtra(TimerForegroundService.EXTRA_TOTAL_SETS, call.getInt("totalSets", 0));
            // Plain startService: the service is already in the foreground while a workout runs.
            getContext().startService(intent);
        } catch (Exception error) {
            call.reject("Nao foi possivel atualizar a notificacao do treino", error);
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        try {
            // Cancels the rest countdown but keeps the service running for the workout timer.
            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            intent.setAction(TimerForegroundService.ACTION_CANCEL_REST);
            // Do not call startForegroundService for a cancel-only action. On newer Android
            // versions that can require a fresh startForeground() call and crash the app.
            getContext().startService(intent);
        } catch (Exception error) {
            call.reject("Nao foi possivel cancelar o descanso", error);
            return;
        }
        call.resolve();
    }

    private void startService(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
    }
}
