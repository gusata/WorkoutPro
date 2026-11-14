package com.workoutpro.app;

import android.content.Context;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;

/** Home-screen widget data and the dynamic "last workout" launcher shortcut. */
@CapacitorPlugin(name = "WorkoutWidget")
public class WidgetPlugin extends Plugin {
    private static final String SHORTCUT_LAST_WORKOUT = "last_workout";

    /** Stores the web layer's snapshot (schedule, streak, heart rate) and redraws the widgets. */
    @PluginMethod
    public void update(PluginCall call) {
        try {
            JSObject data = call.getData();
            NativeStore.saveWidgetData(getContext(), data);
            WorkoutWidgetProvider.refreshAll(getContext());
            call.resolve();
        } catch (Exception error) {
            call.reject("Nao foi possivel atualizar o widget", error);
        }
    }

    /** Publishes (or removes, without an id) the "Repetir <treino>" shortcut. */
    @PluginMethod
    public void setLastWorkout(PluginCall call) {
        Context context = getContext();
        try {
            String id = call.getString("id", "");
            String name = call.getString("name", "");
            if (id == null || id.isEmpty() || name == null || name.isEmpty()) {
                ShortcutManagerCompat.removeDynamicShortcuts(context, Collections.singletonList(SHORTCUT_LAST_WORKOUT));
                call.resolve();
                return;
            }
            String shortLabel = name.length() > 24 ? name.substring(0, 23) + "…" : name;
            ShortcutInfoCompat shortcut = new ShortcutInfoCompat.Builder(context, SHORTCUT_LAST_WORKOUT)
                .setShortLabel(shortLabel)
                .setLongLabel("Repetir " + name)
                .setIcon(IconCompat.createWithResource(context, R.drawable.ic_shortcut_repeat))
                .setIntent(DeepLinks.intent(context, DeepLinks.startWorkout(id)))
                .build();
            ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);
            call.resolve();
        } catch (Exception error) {
            call.reject("Nao foi possivel atualizar o atalho do ultimo treino", error);
        }
    }
}
