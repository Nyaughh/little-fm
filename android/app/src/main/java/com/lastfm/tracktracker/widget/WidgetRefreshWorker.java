package com.lastfm.tracktracker.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.reactnativeandroidwidget.RNWidgetBackgroundTaskWorker;
import com.reactnativeandroidwidget.RNWidgetUtil;

/** One scheduled JS refresh updates both providers and every placed instance. */
public class WidgetRefreshWorker extends Worker {
    public WidgetRefreshWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }

    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<?> provider : new Class<?>[]{FriendListening.class, ListeningCircle.class}) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, provider));
            if (ids.length == 0) continue;
            int id = ids[0];
            Data data = new Data.Builder().putString("widgetName", provider.getSimpleName())
                .putInt("widgetId", id).putInt("width", RNWidgetUtil.getWidgetWidth(context, id))
                .putInt("height", RNWidgetUtil.getWidgetHeight(context, id)).putString("widgetAction", "WIDGET_UPDATE").build();
            WorkManager.getInstance(context).enqueueUniqueWork("little-fm-widget-refresh-now", ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(RNWidgetBackgroundTaskWorker.class).setInputData(data).build());
            return Result.success();
        }
        WidgetRefreshScheduler.cancelIfUnused(context);
        return Result.success();
    }
}
