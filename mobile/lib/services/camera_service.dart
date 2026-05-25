import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';

/// Servicio de cámara: inicialización y conversión YUV420 → NV21.
class CameraService {
  CameraController? controller;
  List<CameraDescription> cameras = [];

  bool get isInitialized =>
      controller != null && controller!.value.isInitialized;

  Future<void> initialize() async {
    cameras = await availableCameras();
    final back = cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
      orElse: () => cameras.first,
    );

    controller = CameraController(
      back,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.yuv420,
    );
    await controller!.initialize();
  }

  Future<void> dispose() async {
    await controller?.dispose();
    controller = null;
  }

  void startImageStream(void Function(CameraImage image) onImage) {
    controller?.startImageStream(onImage);
  }

  void stopImageStream() {
    controller?.stopImageStream();
  }

  /// Convierte CameraImage (YUV420) a buffer NV21 estándar para el motor C++.
  static Uint8List cameraImageToNv21(CameraImage image) {
    final width = image.width;
    final height = image.height;
    final yPlane = image.planes[0];
    final uPlane = image.planes.length > 1 ? image.planes[1] : yPlane;
    final vPlane = image.planes.length > 2 ? image.planes[2] : uPlane;

    final nv21 = Uint8List(width * height + (width * height ~/ 2));
    int offset = 0;

    // Plano Y
    for (var row = 0; row < height; row++) {
      final rowStart = row * yPlane.bytesPerRow;
      for (var col = 0; col < width; col++) {
        nv21[offset++] = yPlane.bytes[rowStart + col];
      }
    }

    // Plano VU intercalado (NV21)
    final uvHeight = height ~/ 2;
    final uvWidth = width ~/ 2;
    for (var row = 0; row < uvHeight; row++) {
      for (var col = 0; col < uvWidth; col++) {
        final pixelStride = uPlane.bytesPerPixel ?? 1;
        final uvIndex = row * uPlane.bytesPerRow + col * pixelStride;
        final v = vPlane.bytes[uvIndex];
        final u = uPlane.bytes[uvIndex];
        nv21[offset++] = v;
        nv21[offset++] = u;
      }
    }

    return nv21;
  }
}
