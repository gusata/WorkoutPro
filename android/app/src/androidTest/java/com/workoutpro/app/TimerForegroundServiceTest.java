package com.workoutpro.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Drives the real {@link TimerForegroundService} with the same intents {@link TimerPlugin} sends and
 * checks the ongoing notification the user sees (workout clock, rest countdown, live status).
 *
 * Runs on an emulator / spare device: {@code npm run test:device -- --device <serial> --instrumented}
 * or {@code ANDROID_SERIAL=<serial> ./gradlew connectedDebugAndroidTest}.
 */
@RunWith(AndroidJUnit4.class)
public class TimerForegroundServiceTest {
    private static final int NOTIFICATION_ID = 2001;
    private static final long TIMEOUT_MS = 8000;

    private Context context;
    private NotificationManager notificationManager;
    private ActivityScenario<MainActivity> scenario;

    @Before
    public void setUp() {
        context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        notificationManager = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            InstrumentationRegistry.getInstrumentation().getUiAutomation()
                .grantRuntimePermission(context.getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
        }
        // A visible activity lets the test start a foreground service (Android 12+ restriction).
        scenario = ActivityScenario.launch(MainActivity.class);
        stopServiceAndWait();
    }

    @After
    public void tearDown() {
        stopServiceAndWait();
        if (scenario != null) scenario.close();
    }

    @Test
    public void timerPluginIsRegisteredUnderTheNameUsedByTheWebApp() {
        AtomicReference<Object> handle = new AtomicReference<>();
        scenario.onActivity((activity) -> handle.set(activity.getBridge().getPlugin("TimerPlugin")));
        assertNotNull("lib/timerPlugin.ts calls registerPlugin('TimerPlugin')", handle.get());
    }

    @Test
    public void startWorkoutShowsAnOngoingWorkoutClock() {
        long startedAt = System.currentTimeMillis() - 65_000L;
        startForeground(TimerForegroundService.ACTION_START_WORKOUT, intent ->
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_START_MS, startedAt));

        Notification notification = awaitNotification(n -> title(n).startsWith("Treino em andamento · 01:"));
        assertTrue("ongoing", (notification.flags & Notification.FLAG_ONGOING_EVENT) != 0);
        assertEquals(TimerForegroundService.CHANNEL_TIMER, notification.getChannelId());
        assertEquals(R.drawable.ic_stat_workoutpro, notification.getSmallIcon().getResId());
        assertNotNull("tapping opens the app", notification.contentIntent);
    }

    @Test
    public void restCountdownReplacesTheTitleAndEndsOnItsOwn() {
        startForeground(TimerForegroundService.ACTION_START_TIMER, intent -> {
            intent.putExtra(TimerForegroundService.EXTRA_DURATION_MS, 3_000L);
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_START_MS, System.currentTimeMillis());
        });

        awaitNotification(n -> title(n).matches("Descanso 00:0[1-3]"));
        // After the 3 s rest the notification flips back to the workout clock by itself.
        awaitNotification(n -> title(n).startsWith("Treino em andamento · "));
    }

    @Test
    public void liveStatusShowsWorkoutNameProgressAndNextStep() {
        startForeground(TimerForegroundService.ACTION_START_WORKOUT, intent ->
            intent.putExtra(TimerForegroundService.EXTRA_WORKOUT_START_MS, System.currentTimeMillis()));
        awaitNotification(n -> title(n).startsWith("Treino em andamento"));

        context.startService(updateStatusIntent("Superior A", "Supino Reto · série 3", "Remada · série 1", 2, 6));
        Notification workout = awaitNotification(n -> title(n).startsWith("Superior A · "));
        assertEquals("Supino Reto · série 3", text(workout));
        assertEquals("2/6 séries", String.valueOf(workout.extras.getCharSequence(Notification.EXTRA_SUB_TEXT)));
        assertEquals(6, workout.extras.getInt(Notification.EXTRA_PROGRESS_MAX));
        assertEquals(2, workout.extras.getInt(Notification.EXTRA_PROGRESS));

        startForeground(TimerForegroundService.ACTION_START_TIMER, intent ->
            intent.putExtra(TimerForegroundService.EXTRA_DURATION_MS, 90_000L));
        Notification rest = awaitNotification(n -> title(n).matches("Descanso 01:(30|29|28)"));
        assertEquals("A seguir: Remada · série 1", text(rest));
        assertEquals("Superior A", String.valueOf(rest.extras.getCharSequence(Notification.EXTRA_SUB_TEXT)));
    }

    @Test
    public void cancelRestKeepsTheWorkoutNotification() {
        startForeground(TimerForegroundService.ACTION_START_TIMER, intent ->
            intent.putExtra(TimerForegroundService.EXTRA_DURATION_MS, 60_000L));
        awaitNotification(n -> title(n).startsWith("Descanso "));

        Intent cancel = new Intent(context, TimerForegroundService.class).setAction(TimerForegroundService.ACTION_CANCEL_REST);
        context.startService(cancel);
        awaitNotification(n -> title(n).startsWith("Treino em andamento · "));
    }

    @Test
    public void stoppingTheServiceRemovesTheNotification() {
        startForeground(TimerForegroundService.ACTION_START_WORKOUT, intent -> { });
        awaitNotification(n -> true);

        stopServiceAndWait();
        assertNull(findNotification());
    }

    @Test
    public void statusUpdateWithoutAWorkoutDoesNotPostANotification() {
        context.startService(updateStatusIntent("Fantasma", "x", "y", 0, 0));
        SystemClock.sleep(1500);
        assertNull("UPDATE_STATUS must never start the timer by itself", findNotification());
    }

    // ---- helpers ------------------------------------------------------------------------------

    private interface IntentExtras { void apply(Intent intent); }
    private interface NotificationCheck { boolean matches(Notification notification); }

    private void startForeground(String action, IntentExtras extras) {
        Intent intent = new Intent(context, TimerForegroundService.class).setAction(action);
        extras.apply(intent);
        context.startForegroundService(intent);
    }

    private Intent updateStatusIntent(String name, String current, String next, int done, int total) {
        return new Intent(context, TimerForegroundService.class)
            .setAction(TimerForegroundService.ACTION_UPDATE_STATUS)
            .putExtra(TimerForegroundService.EXTRA_WORKOUT_NAME, name)
            .putExtra(TimerForegroundService.EXTRA_CURRENT, current)
            .putExtra(TimerForegroundService.EXTRA_NEXT, next)
            .putExtra(TimerForegroundService.EXTRA_DONE_SETS, done)
            .putExtra(TimerForegroundService.EXTRA_TOTAL_SETS, total);
    }

    private void stopServiceAndWait() {
        context.stopService(new Intent(context, TimerForegroundService.class));
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        while (findNotification() != null && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
    }

    private Notification findNotification() {
        for (StatusBarNotification item : notificationManager.getActiveNotifications()) {
            if (item.getId() == NOTIFICATION_ID) return item.getNotification();
        }
        return null;
    }

    private Notification awaitNotification(NotificationCheck check) {
        long deadline = SystemClock.uptimeMillis() + TIMEOUT_MS;
        Notification last = null;
        while (SystemClock.uptimeMillis() < deadline) {
            last = findNotification();
            if (last != null && check.matches(last)) return last;
            SystemClock.sleep(150);
        }
        throw new AssertionError("Timer notification did not reach the expected state; last title: "
            + (last == null ? "<none>" : "\"" + title(last) + "\" / \"" + text(last) + "\""));
    }

    private static String title(Notification notification) {
        CharSequence value = notification.extras.getCharSequence(Notification.EXTRA_TITLE);
        return value == null ? "" : value.toString();
    }

    private static String text(Notification notification) {
        CharSequence value = notification.extras.getCharSequence(Notification.EXTRA_TEXT);
        return value == null ? "" : value.toString();
    }
}
