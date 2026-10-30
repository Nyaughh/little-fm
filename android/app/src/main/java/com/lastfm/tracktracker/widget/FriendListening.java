package com.lastfm.tracktracker.widget;

import com.reactnativeandroidwidget.RNWidgetProvider;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;

public class FriendListening extends RNWidgetProvider {
    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        super.onUpdate(context, manager, ids);
        WidgetRefreshScheduler.ensure(context);
        WidgetLiveService.startIfAllowed(context);
    }
    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if ((context.getPackageName() + ".WIDGET_CLICK").equals(intent.getAction())) WidgetLiveService.startIfAllowed(context);
    }
    @Override public void onDeleted(Context context, int[] ids) {
        super.onDeleted(context, ids);
        WidgetRefreshScheduler.cancelIfUnused(context);
    }
}
