plugins { id("com.android.application") }

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    implementation("org.signal:libsignal-client:0.99.1")
    implementation("org.signal:libsignal-android:0.99.1")
    testImplementation("junit:junit:4.13.2")
}

android {
    namespace = "chat.cwhitty.calculator.secure"
    compileSdk = 37

    defaultConfig {
        applicationId = "chat.cwhitty.calculator.secure"
        minSdk = 28
    targetSdk = 37

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
        versionCode = 5
        versionName = "0.4.0-secure-lab"
        ndk {
            // The current two-phone lab targets modern 64-bit Android devices.
            abiFilters += setOf("arm64-v8a")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    packaging {
        jniLibs {
            excludes += setOf("**/libsignal_jni_testing.so")
        }
        resources {
            excludes += setOf("libsignal_jni*.dylib", "signal_jni*.dll", "libsignal_jni_testing.so")
        }
    }
}
