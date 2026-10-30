package com.lastfm.tracktracker.widget;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactInstanceEventListener;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.facebook.react.jstasks.HeadlessJsTaskContext;
import com.facebook.react.jstasks.HeadlessJsTaskEventListener;
import com.lastfm.tracktracker.MainActivity;
import java.lang.ref.WeakReference;

/** Keeps placed widgets fresh while the screen is awake, including on the launcher. */
public final class WidgetLiveService extends Service implements HeadlessJsTaskEventListener {
    public static final long INTERVAL_MS = 30_000;
    private static final String TASK = "LittleFmLiveWidgets";
    private static final String CHANNEL = "little-fm-widget-updates";
    private static final String STOP = "com.lastfm.tracktracker.STOP_WIDGET_UPDATES";
    private static final int NOTIFICATION_ID = 1907;
    private static volatile WidgetLiveService instance;
    private static volatile boolean appVisible;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean destroyed;
    private boolean receiverRegistered;
    private int activeTask = -1;
    private WeakReference<ReactContext> taskContext = new WeakReference<>(null);
    private ReactInstanceManager startingManager;
    private ReactInstanceEventListener startingListener;

    public static void setAppVisible(boolean visible) {
        appVisible = visible;
        WidgetLiveService service = instance;
        if (service != null) service.kick();
    }

    public static boolean isRunning() { return instance != null; }

    public static void startIfAllowed(Context context) {
        if (!WidgetRefreshScheduler.hasWidgets(context)) return;
        WidgetLiveService service = instance;
        if (service != null) { service.kick(); return; }
        try {
            Intent intent = new Intent(context, WidgetLiveService.class);
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (RuntimeException error) {
            // A system widget update can arrive without a user interaction.
            // Android may forbid starting a service then; the periodic worker
            // still runs, and opening the app/widget starts live checks again.
            Log.w("LittleFmWidgets", "Live updates could not start in the background", error);
        }
    }

    private boolean screenAwake() {
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        return power != null && power.isInteractive();
    }

    private void kick() {
        handler.post(() -> {
            handler.removeCallbacks(tick);
            if (!destroyed && screenAwake()) handler.post(tick);
        });
    }

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            if (destroyed) return;
            if (!WidgetRefreshScheduler.hasWidgets(WidgetLiveService.this)) { stopSelf(); return; }
            if (!screenAwake()) return;
            // The visible app already checks every 30s. Hand polling over to
            // this service as soon as the user returns to the home screen.
            if (!appVisible && activeTask == -1) beginCheck();
            handler.postDelayed(this, INTERVAL_MS);
        }
    };

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_ON.equals(intent.getAction())) kick();
            else handler.removeCallbacks(tick);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Widget updates", NotificationManager.IMPORTANCE_LOW);
            channel.setSound(null, null);
            channel.enableVibration(false);
            channel.setShowBadge(false);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), flags);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, WidgetLiveService.class).setAction(STOP), flags);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_popup_sync).setContentTitle("little fm")
            .setContentText("Updating your widgets every 30 seconds")
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW).setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Stop", stop);
        try {
            // Android requires a notification object for a foreground service.
            // With POST_NOTIFICATIONS unrequested, Android 13+ shows this only
            // in Active apps, rather than in the notification drawer.
            if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIFICATION_ID, notification.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            else startForeground(NOTIFICATION_ID, notification.build());
        } catch (RuntimeException error) {
            Log.w("LittleFmWidgets", "Live updates were restricted by Android", error);
            stopSelf();
            return;
        }
        instance = this;
        IntentFilter filter = new IntentFilter(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(screenReceiver, filter);
        receiverRegistered = true;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (instance != this || (intent != null && STOP.equals(intent.getAction())) || !WidgetRefreshScheduler.hasWidgets(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        kick();
        return START_STICKY;
    }

    private void beginCheck() {
        if (destroyed || appVisible || !screenAwake() || startingListener != null) return;
        ReactInstanceManager manager = ((ReactApplication) getApplication()).getReactNativeHost().getReactInstanceManager();
        ReactContext react = manager.getCurrentReactContext();
        if (react == null) {
            startingManager = manager;
            startingListener = context -> {
                clearStartingListener();
                if (!destroyed && !appVisible && screenAwake()) beginCheck();
            };
            manager.addReactInstanceEventListener(startingListener);
            if (!manager.hasStartedCreatingInitialContext()) manager.createReactContextInBackground();
            return;
        }
        if (!react.hasActiveReactInstance()) return;
        HeadlessJsTaskContext tasks = HeadlessJsTaskContext.getInstance(react);
        taskContext = new WeakReference<>(react);
        tasks.addTaskEventListener(this);
        try {
            activeTask = tasks.startTask(new HeadlessJsTaskConfig(TASK, Arguments.createMap(), 25_000, true));
        } catch (RuntimeException error) {
            tasks.removeTaskEventListener(this);
            taskContext.clear();
            Log.w("LittleFmWidgets", "Widget check could not start", error);
        }
    }

    private void clearStartingListener() {
        if (startingManager != null && startingListener != null) startingManager.removeReactInstanceEventListener(startingListener);
        startingManager = null;
        startingListener = null;
    }

    @Override public void onHeadlessJsTaskStart(int taskId) {}

    @Override public void onHeadlessJsTaskFinish(int taskId) {
        if (taskId != activeTask) return;
        ReactContext react = taskContext.get();
        if (react != null) HeadlessJsTaskContext.getInstance(react).removeTaskEventListener(this);
        taskContext.clear();
        activeTask = -1;
    }

    @Override public void onTimeout(int startId, int foregroundServiceType) {
        // Respect Android's data-sync time budget. The 15-minute worker stays
        // available if the system ends a long live-update session.
        stopSelf();
    }

    @Override public void onDestroy() {
        destroyed = true;
        handler.removeCallbacksAndMessages(null);
        if (receiverRegistered) unregisterReceiver(screenReceiver);
        clearStartingListener();
        ReactContext react = taskContext.get();
        if (react != null) {
            HeadlessJsTaskContext tasks = HeadlessJsTaskContext.getInstance(react);
            tasks.removeTaskEventListener(this);
        }
        taskContext.clear();
        if (instance == this) instance = null;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
