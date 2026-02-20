import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const APP_NAME = "SolveMate";
const APP_SLUG = "solvemate";
const IOS_BUNDLE_ID = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || "com.solvemate.app";
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE || "com.solvemate.app";
const APP_SCHEME = process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME || "solvemate";
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID?.trim();
const EAS_BUILD_PROFILE = process.env.EAS_BUILD_PROFILE?.trim();
const IS_RELEASE_BUILD = EAS_BUILD_PROFILE === "preview" || EAS_BUILD_PROFILE === "production";

function requireBuildEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`[Build Config] ${name} is required for ${EAS_BUILD_PROFILE ?? "release"} builds`);
  }
  return value;
}

if (IS_RELEASE_BUILD) {
  requireBuildEnv("EXPO_PUBLIC_API_BASE_URL");
  requireBuildEnv("EAS_PROJECT_ID");
  requireBuildEnv("EXPO_PUBLIC_PRIVACY_POLICY_URL");
  requireBuildEnv("EXPO_PUBLIC_TERMS_OF_SERVICE_URL");
}

const extra: ExpoConfig["extra"] = {};
if (EAS_PROJECT_ID) {
  extra.eas = {
    projectId: EAS_PROJECT_ID,
  };
}

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: APP_SCHEME,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: IOS_BUNDLE_ID,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: ANDROID_PACKAGE,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: APP_SCHEME,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra,
};

export default config;
