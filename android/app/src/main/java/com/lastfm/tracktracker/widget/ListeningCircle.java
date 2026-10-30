package com.lastfm.tracktracker.widget;

import com.reactnativeandroidwidget.RNWidgetProvider;
import android.appwidget.AppWidgetManager;
import android.content.Context;

public class ListeningCircle extends RNWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        super.onUpdate(context, manager, ids);
        WidgetRefreshScheduler.ensure(context);
    }
    @Override public void onDeleted(Context context, int[] ids) {
        super.onDeleted(context, ids);
        WidgetRefreshScheduler.cancelIfUnused(context);
    }
}
