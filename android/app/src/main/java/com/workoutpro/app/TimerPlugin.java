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
    public void startTimer(PluginCall call) {
        try {
            int seconds = call.getInt("seconds", 90);
            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            intent.setAction(TimerForegroundService.ACTION_START);
            intent.putExtra(TimerForegroundService.EXTRA_DURATION_MS, (long) seconds * 1000L);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        try {
            // stopService() requires no foreground-service permissions — safe to call anytime.
            Intent intent = new Intent(getContext(), TimerForegroundService.class);
            getContext().stopService(intent);
        } catch (Exception ignored) {}
        call.resolve();
    }
}
