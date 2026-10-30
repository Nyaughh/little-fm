package com.lastfm.tracktracker;

import android.app.Activity;
import android.appwidget.AppWidgetHost;
import android.appwidget.AppWidgetHostView;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.ContextThemeWrapper;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.TimeUnit;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import com.lastfm.tracktracker.widget.WidgetRefreshWorker;
import com.lastfm.tracktracker.widget.WidgetRefreshScheduler;
import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class WidgetSmokeTest {
    private final android.app.Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
    private final Context context = instrumentation.getTargetContext();

    private boolean hasText(View view, String text) {
        if (view instanceof TextView && ((TextView) view).getText().toString().equals(text)) return true;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) if (hasText(group.getChildAt(i), text)) return true;
        }
        return false;
    }

    private void save(Bitmap bitmap, String name) throws Exception {
        File directory = context.getExternalFilesDir("widget-smoke");
        directory.mkdirs();
        try (FileOutputStream stream = new FileOutputStream(new File(directory, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        }
    }

    @Test public void artworkAndBothLauncherWidgetsRenderOnAndroid() throws Exception {
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        Activity activity = instrumentation.startActivitySync(launch);
        try {
            long deadline = System.currentTimeMillis() + 45000;
            AtomicReference<Boolean> ready = new AtomicReference<>(false);
            while (!ready.get() && System.currentTimeMillis() < deadline) {
                instrumentation.runOnMainSync(() -> ready.set(hasText(activity.getWindow().getDecorView(), "Native checks ready")));
                Thread.sleep(250);
            }
            save(instrumentation.getUiAutomation().takeScreenshot(), "in-app-previews");
            assertTrue("Native app setup did not finish", ready.get());
            for (String pattern : new String[]{"doodles", "alien", "fruits", "miffy"}) {
                ReactContext reactContext = ((ReactApplication) context.getApplicationContext()).getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
                assertNotNull("React runtime is missing", reactContext);
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("WIDGET_SMOKE_PATTERN", pattern);
                ready.set(false);
                deadline = System.currentTimeMillis() + 15000;
                while (!ready.get() && System.currentTimeMillis() < deadline) {
                    instrumentation.runOnMainSync(() -> ready.set(hasText(activity.getWindow().getDecorView(), "Pattern ready " + pattern)));
                    Thread.sleep(250);
                }
                assertTrue("Pattern did not update: " + pattern, ready.get());
                save(instrumentation.getUiAutomation().takeScreenshot(), pattern + "-app-previews");
                for (String name : new String[]{"FriendListening", "ListeningCircle"}) {
                int width = name.equals("FriendListening") ? 184 : 316;
                AppWidgetManager manager = AppWidgetManager.getInstance(context);
                ComponentName provider = new ComponentName(context, context.getPackageName() + ".widget." + name);
                AppWidgetProviderInfo info = manager.getInstalledProviders().stream().filter(p -> p.provider.equals(provider)).findFirst().orElse(null);
                assertNotNull("Widget provider is missing", info);
                assertTrue("Picker preview image missing", info.previewImage != 0);
                assertTrue("Picker preview layout missing", info.previewLayout != 0);
                assertEquals("Horizontal and vertical resizing must be enabled", AppWidgetProviderInfo.RESIZE_BOTH, info.resizeMode);
                assertTrue("The compact resize height is missing", info.minResizeHeight > 0 && info.minResizeHeight <= Math.round(140 * context.getResources().getDisplayMetrics().density));
                AppWidgetHost host = new AppWidgetHost(context, width);
                try {
                    host.startListening();
                    int id = host.allocateAppWidgetId();
                    Bundle options = new Bundle();
                    options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, width);
                    options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, width);
                    options.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 238);
                    options.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 238);
                    assertTrue("Widget bind permission missing", manager.bindAppWidgetIdIfAllowed(id, provider, options));
                    AtomicReference<AppWidgetHostView> view = new AtomicReference<>();
                    instrumentation.runOnMainSync(() -> {
                        // AppCompat's activity inflater substitutes an image class
                        // that RemoteViews forbids. Launchers use framework views.
                        ContextThemeWrapper widgetContext = new ContextThemeWrapper(context, android.R.style.Theme_Material_Light_NoActionBar);
                        AppWidgetHostView hostView = host.createView(widgetContext, id, info);
                        float density = context.getResources().getDisplayMetrics().density;
                        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(Math.round(width * density), Math.round(238 * density));
                        activity.addContentView(hostView, params);
                        view.set(hostView);
                    });
                    AtomicReference<Bitmap> bitmap = new AtomicReference<>();
                    deadline = System.currentTimeMillis() + 60000;
                    int imageId = context.getResources().getIdentifier("rn_widget_image", "id", context.getPackageName());
                    while (bitmap.get() == null && System.currentTimeMillis() < deadline) {
                        instrumentation.runOnMainSync(() -> {
                            ImageView image = view.get().findViewById(imageId);
                            if (image != null && image.getDrawable() instanceof BitmapDrawable) bitmap.set(((BitmapDrawable) image.getDrawable()).getBitmap());
                        });
                        Thread.sleep(250);
                    }
                    assertNotNull(name + " remained blank: Android headless rendering never completed", bitmap.get());
                    assertTrue("Widget bitmap has no visible background", android.graphics.Color.alpha(bitmap.get().getPixel(bitmap.get().getWidth() / 2, bitmap.get().getHeight() / 2)) > 200);
                    save(bitmap.get(), pattern + "-" + name + "-background");
                    Thread.sleep(3000); // Allow the native scrolling collection to bind its rows.
                    save(instrumentation.getUiAutomation().takeScreenshot(), pattern + "-" + name + "-launcher");
                    if (pattern.equals("doodles") && name.equals("FriendListening")) {
                        assertFalse("Placing a widget did not create its persistent refresh schedule",
                            WorkManager.getInstance(context).getWorkInfosForUniqueWork(WidgetRefreshScheduler.WORK_NAME).get(10, TimeUnit.SECONDS).isEmpty());
                        // Exercise the same worker used by the 15-minute schedule,
                        // without waiting fifteen minutes or touching the refresh UI.
                        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("WIDGET_SMOKE_AUTOMATIC", null);
                        ready.set(false);
                        deadline = System.currentTimeMillis() + 10000;
                        while (!ready.get() && System.currentTimeMillis() < deadline) {
                            instrumentation.runOnMainSync(() -> ready.set(hasText(activity.getWindow().getDecorView(), "Automatic check armed")));
                            Thread.sleep(100);
                        }
                        assertTrue("Automatic refresh test was not armed", ready.get());
                        Bitmap beforeRefresh = bitmap.get();
                        WorkManager.getInstance(context).enqueue(new OneTimeWorkRequest.Builder(WidgetRefreshWorker.class).build());
                        ready.set(false);
                        deadline = System.currentTimeMillis() + 20000;
                        while (!ready.get() && System.currentTimeMillis() < deadline) {
                            instrumentation.runOnMainSync(() -> {
                                ImageView image = view.get().findViewById(imageId);
                                if (image != null && image.getDrawable() instanceof BitmapDrawable) {
                                    Bitmap current = ((BitmapDrawable) image.getDrawable()).getBitmap();
                                    ready.set(hasText(activity.getWindow().getDecorView(), "Automatic refresh fetched") && !beforeRefresh.sameAs(current));
                                }
                            });
                            Thread.sleep(150);
                        }
                        assertTrue("The scheduled worker did not fetch and redraw the new song", ready.get());
                        save(instrumentation.getUiAutomation().takeScreenshot(), "automatic-widget-refresh");
                    }
                    if (pattern.equals("doodles")) {
                        // Change the options on the same placed widget, as a
                        // launcher does when its resize handles are dragged.
                        int[][] sizes = name.equals("FriendListening")
                            ? new int[][]{{150, 140}, {316, 140}, {400, 340}}
                            : new int[][]{{210, 140}, {400, 340}};
                        for (int[] size : sizes) {
                            Bundle resized = new Bundle();
                            resized.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, size[0]);
                            resized.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, size[0]);
                            resized.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, size[1]);
                            resized.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, size[1]);
                            manager.updateAppWidgetOptions(id, resized);
                            instrumentation.runOnMainSync(() -> {
                                float density = context.getResources().getDisplayMetrics().density;
                                view.get().setLayoutParams(new FrameLayout.LayoutParams(Math.round(size[0] * density), Math.round(size[1] * density)));
                            });
                            AtomicReference<Bitmap> resizedBitmap = new AtomicReference<>();
                            deadline = System.currentTimeMillis() + 30000;
                            while (resizedBitmap.get() == null && System.currentTimeMillis() < deadline) {
                                instrumentation.runOnMainSync(() -> {
                                    ImageView image = view.get().findViewById(imageId);
                                    if (image != null && image.getDrawable() instanceof BitmapDrawable) {
                                        Bitmap candidate = ((BitmapDrawable) image.getDrawable()).getBitmap();
                                        float density = context.getResources().getDisplayMetrics().density;
                                        if (Math.abs(candidate.getWidth() - size[0] * density) < 3 && Math.abs(candidate.getHeight() - size[1] * density) < 3) resizedBitmap.set(candidate);
                                    }
                                });
                                Thread.sleep(250);
                            }
                            assertNotNull(name + " did not re-render at " + size[0] + "x" + size[1], resizedBitmap.get());
                            save(resizedBitmap.get(), name + "-resized-" + size[0] + "x" + size[1]);
                            Thread.sleep(1500);
                            save(instrumentation.getUiAutomation().takeScreenshot(), name + "-resized-" + size[0] + "x" + size[1] + "-launcher");
                        }
                    }
                    instrumentation.runOnMainSync(() -> ((ViewGroup) view.get().getParent()).removeView(view.get()));
                } finally { host.deleteHost(); host.stopListening(); }
                }
            }
            instrumentation.runOnMainSync(() -> ready.set(hasText(activity.getWindow().getDecorView(), "Artwork ready")));
            assertTrue("Android failed to decode the real album cover", ready.get());
        } finally { activity.finish(); }
    }
}
