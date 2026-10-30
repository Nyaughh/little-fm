import 'dotenv/config';

export default {
  expo: {
    name: "little fm",
    slug: "little-fm",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "listeningcircle",
    newArchEnabled: false,
    plugins: [
      "expo-router",
      ["react-native-android-widget", {
        widgets: [
          {
            name: "FriendListening", label: "A little listening",
            description: "A favourite friend's latest song. Choose your friend in the app's Widgets tab.",
            minWidth: "150dp", minHeight: "210dp", targetCellWidth: 2, targetCellHeight: 3,
            resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000
          },
          {
            name: "ListeningCircle", label: "Listening circle",
            description: "Everyone in your circle, with album covers. Scroll to see more friends.",
            minWidth: "280dp", minHeight: "230dp", targetCellWidth: 4, targetCellHeight: 3,
            resizeMode: "horizontal|vertical", updatePeriodMillis: 1800000
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
