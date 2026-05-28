import 'dart:ffi' as ffi;
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui';

import 'package:ffi/ffi.dart';
import 'package:flutter/foundation.dart';

import '../models/scan_result.dart';

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

/// Debe coincidir byte-a-byte con OmrResult en native/omr_engine.h
final class _OmrResultNative extends ffi.Struct {
  @ffi.Int32()
  external int found;

  @ffi.Int32()
  external int resultCode;

  @ffi.Array(4)
  external ffi.Array<ffi.Float> cornersX;

  @ffi.Array(4)
  external ffi.Array<ffi.Float> cornersY;

  @ffi.Int32()
  external int graded;

  @ffi.Int32()
  external int valid;

  @ffi.Array(20)
  external ffi.Array<ffi.Int32> answers;

  @ffi.Array(160)
  external ffi.Array<ffi.Uint8> answerTextFlat;

  @ffi.Array(33)
  external ffi.Array<ffi.Uint8> studentIdFlat;

  @ffi.Array(160)
  external ffi.Array<ffi.Uint8> reasonBytes;
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
        _loadError = 'Plataforma no soportada';
        return;
      }
      _processFrame = lib
          .lookup<ffi.NativeFunction<_OmrProcessFrameNative>>('omr_process_frame')
          .asFunction();
    } catch (e) {
      _loadError = e.toString();
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
    if (_processFrame == null) return ScanResult.empty;

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

  ScanResult _mapResult(_OmrResultNative n) {
    final corners = <Offset>[];
    for (var i = 0; i < 4; i++) {
      corners.add(Offset(n.cornersX[i], n.cornersY[i]));
    }

    final answers = <String>[];
    for (var q = 0; q < 20; q++) {
      final start = q * 8;
      final bytes = <int>[];
      for (var b = 0; b < 8; b++) {
        final v = n.answerTextFlat[start + b];
        if (v == 0) break;
        bytes.add(v);
      }
      answers.add(String.fromCharCodes(bytes));
    }

    final idRows = <String>[];
    for (var row = 0; row < 3; row++) {
      final bytes = <int>[];
      for (var col = 0; col < 10; col++) {
        bytes.add(n.studentIdFlat[row * 11 + col]);
      }
      idRows.add(String.fromCharCodes(bytes.where((c) => c != 0)));
    }

    final reasonBytes = <int>[];
    for (var i = 0; i < 160; i++) {
      final v = n.reasonBytes[i];
      if (v == 0) break;
      reasonBytes.add(v);
    }

    return ScanResult(
      found: n.found != 0,
      resultCode: n.resultCode,
      corners: corners,
      graded: n.graded != 0,
      valid: n.valid != 0,
      answers: answers,
      studentId: idRows,
      reason: String.fromCharCodes(reasonBytes),
    );
  }

  Future<ScanResult> processFrameAsync(OmrFrameRequest request) {
    _ensureLoaded();
    if (_processFrame == null) return Future.value(ScanResult.empty);
    return compute(_processFrameInIsolate, request);
  }
}

ScanResult _processFrameInIsolate(OmrFrameRequest request) {
  final bridge = OmrBridge._();
  return bridge.processFrame(
    request.yuv,
    request.width,
    request.height,
    rotation: request.rotation,
    doGrade: request.doGrade,
  );
}
