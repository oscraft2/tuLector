# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor core + plugins comunitarios: sus propios .aar ya publican
# consumer-rules.pro (Capacitor, browser, camera, share, etc. via
# capacitor.build.gradle consumerProguardFiles), pero los que usan reflection
# o JNI (biometria, login social, storage seguro, RevenueCat) no siempre
# garantizan cobertura completa — se refuerzan explicitamente aqui.
# Ver SECURITY_PROMPT_APK.md Tarea F.
-keep class com.getcapacitor.** { *; }
-keep class ee.forgr.capacitor.social.login.** { *; }
-keep class com.aparajita.capacitor.biometricauth.** { *; }
-keep class com.whitestein.securestorage.** { *; }
-keep class com.revenuecat.purchases.** { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keepattributes SourceFile,LineNumberTable
