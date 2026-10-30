import 'dotenv/config';

export default {
  expo: {
    name: "little fm",
    slug: "little-fm",
    version: "1.0.4",
    orientation: "portrait",
    scheme: "listeningcircle",
    newArchEnabled: false,
    plugins: [
      "expo-router",
      "./scripts/with-widget-min-sizes.cjs",
      ["react-native-android-widget", {
        widgets: [
          {
            name: "FriendListening", label: "A little listening",
            description: "A favourite friend's latest song. Choose your friend in the app's Widgets tab.",
            minWidth: "150dp", minHeight: "210dp", targetCellWidth: 2, targetCellHeight: 3,
            previewImage: "./assets/widget-preview/friend.png",
            resizeMode: "horizontal|vertical", updatePeriodMillis: 0
          },
          {
            name: "ListeningCircle", label: "Listening circle",
            description: "Everyone in your circle, with album covers. Scroll to see more friends.",
            minWidth: "280dp", minHeight: "230dp", targetCellWidth: 4, targetCellHeight: 3,
            previewImage: "./assets/widget-preview/circle.png",
            resizeMode: "horizontal|vertical", updatePeriodMillis: 0
          }
        ]
      }]
    ],
    icon: "./assets/images/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FBE6E4"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.lastfm.tracktracker"
    },
    web: {
      name: "little fm",
      favicon: "./assets/images/favicon.png"
    },
    android: {
      versionCode: 5,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#FBE6E4"
      },
      package: "com.lastfm.tracktracker"
    },
    extra: {
      listeningApiUrl: process.env.EXPO_PUBLIC_LISTENING_API_URL
    }
  }
};
