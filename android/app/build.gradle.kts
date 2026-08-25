plugins { id("com.android.application") }

android {
    namespace = "chat.cwhitty.calculator.secure"
    compileSdk = 37

    defaultConfig {
        applicationId = "chat.cwhitty.calculator.secure"
        minSdk = 28
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0-security-foundation"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}
