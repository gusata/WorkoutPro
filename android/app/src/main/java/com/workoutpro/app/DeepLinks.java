package com.workoutpro.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/** workoutpro://open/... links understood by lib/deepLinks.ts (keep both in sync). */
final class DeepLinks {
    static final String DASHBOARD = "workoutpro://open/dashboard";
    static final String START_TODAY = "workoutpro://open/start";
    static final String EXECUTE = "workoutpro://open/workout";
    static final String CARDIO_NEW = "workoutpro://open/cardio?novo=1";
    static final String PROGRESS = "workoutpro://open/progress";

    private DeepLinks() {}

    static String startWorkout(String workoutId) {
        return START_TODAY + "?workout=" + Uri.encode(workoutId);
    }

    static Intent intent(Context context, String link) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(link), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return intent;
    }
}
