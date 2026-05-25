# TuLector Mobile (Flutter + C++ OMR)

App complementaria de escaneo OMR con motor nativo en C++ (sin OpenCV).

## Estructura

```
mobile/
├── lib/                    # UI Flutter
├── native/omr_engine.cpp   # Motor OMR
├── CMakeLists.txt          # Android NDK
└── android/ios/            # Plataformas
```

## Desarrollo

```bash
cd mobile
flutter pub get
flutter analyze
flutter run   # dispositivo físico recomendado
```

## Compilar librería C++

### Android (CMake + NDK)

La configuración está en `android/app/build.gradle.kts` → `externalNativeBuild` apunta a `CMakeLists.txt`.

```bash
flutter build apk
```

Genera `libomr_engine.so` empaquetado en el APK.

### iOS

`omr_engine.cpp` está enlazado en el target **Runner** (`ios/Runner.xcodeproj`). Símbolos visibles vía `DynamicLibrary.process()`.

```bash
flutter build ios
```

Abre `ios/Runner.xcworkspace` en Xcode si falla el linking.

## Probar en dispositivo real

1. Activa depuración USB (Android) o confía en el Mac (iOS).
2. `flutter devices` → copia el ID.
3. `flutter run -d <device_id>`
4. Imprime una hoja desde la web (`/sheet`) y escanea con buena luz.

## Notas

- El escaneo usa **NV21** desde `CameraImage` (YUV420 convertido).
- Procesamiento en **Isolate** para no bloquear la UI.
- Auto-scan: 12 frames estables + cooldown 3 s (igual que la web).
