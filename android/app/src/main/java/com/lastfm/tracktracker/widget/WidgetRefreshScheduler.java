package com.lastfm.tracktracker.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import java.util.concurrent.TimeUnit;

public final class WidgetRefreshScheduler {
    public static final String WORK_NAME = "little-fm-widget-refresh";
    public static final long INTERVAL_MINUTES = 15;

    public static boolean hasWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        return manager.getAppWidgetIds(new ComponentName(context, FriendListening.class)).length > 0
            || manager.getAppWidgetIds(new ComponentName(context, ListeningCircle.class)).length > 0;
    }

    public static void ensure(Context context) {
        if (!hasWidgets(context)) return;
        Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(WidgetRefreshWorker.class, INTERVAL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(constraints).setInitialDelay(INTERVAL_MINUTES, TimeUnit.MINUTES).addTag(WORK_NAME).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelIfUnused(Context context) {
        if (!hasWidgets(context)) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME);
            context.stopService(new android.content.Intent(context, WidgetLiveService.class));
        }
    }
}
