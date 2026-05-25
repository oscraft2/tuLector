import 'dart:ffi' as ffi;
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';
import 'dart:ui';

import 'package:ffi/ffi.dart';
import 'package:flutter/foundation.dart';

import '../models/scan_result.dart';

/// Argumentos para procesamiento en isolate (datos serializables).
class OmrFrameRequest {
  final Uint8List yuv;
  final int width;
  final int height;
  final int rotation;
  final int doGrade;

  const OmrFrameRequest({
    required this.yuv,
    required this.width,
    required this.height,
    this.rotation = 0,
    this.doGrade = 0,
  });
}

final class _OmrResultNative extends ffi.Struct {
  @ffi.Int32()
  external int found;

  @ffi.Array(4)
  external ffi.Array<ffi.Float> cornersX;

  @ffi.Array(4)
  external ffi.Array<ffi.Float> cornersY;

  @ffi.Int32()
  external int graded;

  @ffi.Array(20)
  external ffi.Array<ffi.Int32> answers;

  @ffi.Array(33)
  external ffi.Array<ffi.Uint8> studentIdFlat;
}

typedef _OmrProcessFrameNative = ffi.Void Function(
  ffi.Pointer<ffi.Uint8> yuv,
  ffi.Int32 width,
  ffi.Int32 height,
  ffi.Int32 rotation,
  ffi.Int32 doGrade,
  ffi.Pointer<_OmrResultNative> out,
);

typedef _OmrProcessFrameDart = void Function(
  ffi.Pointer<ffi.Uint8> yuv,
  int width,
  int height,
  int rotation,
  int doGrade,
  ffi.Pointer<_OmrResultNative> out,
);

class OmrBridge {
  OmrBridge._();

  static OmrBridge? _instance;
  static OmrBridge get instance => _instance ??= OmrBridge._();

  _OmrProcessFrameDart? _processFrame;
  bool _loadAttempted = false;
  String? _loadError;

  bool get isAvailable => _processFrame != null;
  String? get loadError => _loadError;

  void _ensureLoaded() {
    if (_loadAttempted) return;
    _loadAttempted = true;
    try {
      final ffi.DynamicLibrary lib;
      if (Platform.isAndroid) {
        lib = ffi.DynamicLibrary.open('libomr_engine.so');
      } else if (Platform.isIOS) {
        lib = ffi.DynamicLibrary.process();
      } else {
        _loadError = 'Plataforma no soportada para OMR nativo';
        return;
      }
      _processFrame = lib
          .lookup<ffi.NativeFunction<_OmrProcessFrameNative>>('omr_process_frame')
          .asFunction();
    } catch (e) {
      _loadError = e.toString();
      _processFrame = null;
    }
  }

  ScanResult processFrame(
    Uint8List yuv,
    int width,
    int height, {
    int rotation = 0,
    int doGrade = 0,
  }) {
    _ensureLoaded();
    if (_processFrame == null) {
      return ScanResult.empty;
    }

    final yuvPtr = calloc<ffi.Uint8>(yuv.length);
    final outPtr = calloc<_OmrResultNative>();
    try {
      yuvPtr.asTypedList(yuv.length).setAll(0, yuv);
      _processFrame!(yuvPtr, width, height, rotation, doGrade, outPtr);
      return _mapResult(outPtr.ref);
    } finally {
      calloc.free(yuvPtr);
      calloc.free(outPtr);
    }
  }

  ScanResult _mapResult(_OmrResultNative native) {
    final corners = <Offset>[];
    for (var i = 0; i < 4; i++) {
      corners.add(Offset(native.cornersX[i], native.cornersY[i]));
    }

    final answers = <int>[];
    for (var i = 0; i < 20; i++) {
      answers.add(native.answers[i]);
    }

    final idRows = <String>[];
    final flat = native.studentIdFlat;
    for (var row = 0; row < 3; row++) {
      final chars = <int>[];
      for (var col = 0; col < 10; col++) {
        chars.add(flat[row * 11 + col]);
      }
      idRows.add(String.fromCharCodes(chars.where((c) => c != 0)));
    }

    return ScanResult(
      found: native.found != 0,
      corners: corners,
      graded: native.graded != 0,
      answers: answers,
      studentId: idRows,
    );
  }

  /// Procesa en isolate para no bloquear el hilo UI.
  Future<ScanResult> processFrameAsync(OmrFrameRequest request) {
    return Isolate.run(() => _processInIsolate(request));
  }

  static ScanResult _processInIsolate(OmrFrameRequest request) {
    final bridge = OmrBridge._();
    bridge._loadAttempted = false;
    return bridge.processFrame(
      request.yuv,
      request.width,
      request.height,
      rotation: request.rotation,
      doGrade: request.doGrade,
    );
  }
}
