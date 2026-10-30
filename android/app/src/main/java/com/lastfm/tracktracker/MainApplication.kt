package com.lastfm.tracktracker

import android.app.Application
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.res.Configuration
import android.os.Build
import android.widget.RemoteViews

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            val packages = PackageList(this).packages
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    publishWidgetPreviews()
  }

  private fun publishWidgetPreviews() {
    if (Build.VERSION.SDK_INT < 35) return
    val preferences = getSharedPreferences("widget_previews", MODE_PRIVATE)
    if (preferences.getInt("version", 0) == BuildConfig.VERSION_CODE) return
    try {
      val manager = AppWidgetManager.getInstance(this)
      val previews = listOf(
        "FriendListening" to R.layout.widget_preview_friend,
        "ListeningCircle" to R.layout.widget_preview_circle
      )
      var published = true
      for ((name, layout) in previews) {
        val accepted = manager.setWidgetPreview(
          ComponentName(this, "$packageName.widget.$name"),
          AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,
          RemoteViews(packageName, layout)
        )
        published = published && accepted
      }
      // Android rate-limits this API. Retry on a later start if necessary.
      if (published) preferences.edit().putInt("version", BuildConfig.VERSION_CODE).apply()
    } catch (_: RuntimeException) {
      // previewLayout and previewImage remain available on every launcher.
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
