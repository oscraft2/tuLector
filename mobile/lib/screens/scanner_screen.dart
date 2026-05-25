import 'dart:async';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:vibration/vibration.dart';

import '../models/scan_result.dart';
import '../services/camera_service.dart';
import '../services/omr_bridge.dart';

enum ScanPhase { detecting, scanning, result, cooldown }

class ScannerState extends ChangeNotifier {
  ScanPhase phase = ScanPhase.detecting;
  ScanResult lastResult = ScanResult.empty;
  bool sheetFound = false;
  int scanCount = 0;
  String statusText = 'Buscando hoja...';
  String? error;

  void update({
    ScanPhase? phase,
    ScanResult? lastResult,
    bool? sheetFound,
    int? scanCount,
    String? statusText,
    String? error,
  }) {
    if (phase != null) this.phase = phase;
    if (lastResult != null) this.lastResult = lastResult;
    if (sheetFound != null) this.sheetFound = sheetFound;
    if (scanCount != null) this.scanCount = scanCount;
    if (statusText != null) this.statusText = statusText;
    if (error != null) this.error = error;
    notifyListeners();
  }
}

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _camera = CameraService();
  bool _processing = false;
  int _stableFrames = 0;
  int _lastScanMs = 0;
  List<Offset> _corners = [];
  static const _stableNeeded = 12;
  static const _cooldownMs = 3000;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final state = context.read<ScannerState>();
    final camStatus = await Permission.camera.request();
    if (!camStatus.isGranted) {
      state.update(
        error: 'Se necesita permiso de cámara',
        statusText: 'Sin permiso',
      );
      return;
    }

    if (!OmrBridge.instance.isAvailable) {
      OmrBridge.instance.processFrame(Uint8List(0), 0, 0);
    }
    if (!OmrBridge.instance.isAvailable) {
      state.update(
        error: OmrBridge.instance.loadError ?? 'Motor OMR no disponible',
        statusText: 'Error nativo',
      );
    }

    try {
      await _camera.initialize();
      _camera.startImageStream(_onFrame);
      if (mounted) setState(() {});
    } catch (e) {
      state.update(error: e.toString(), statusText: 'Error de cámara');
    }
  }

  /// Laplacian variance sobre plano Y (paridad con scan/page.tsx del JSON web).
  bool _isFrameSharp(Uint8List nv21, int width, int height) {
    if (nv21.length < width * height) return false;
    double sum = 0;
    int count = 0;
    for (var y = 1; y < height - 1; y += 2) {
      for (var x = 1; x < width - 1; x += 2) {
        final idx = y * width + x;
        final c = nv21[idx].toDouble();
        final lap = (-4 * c +
                nv21[idx - width] +
                nv21[idx + width] +
                nv21[idx - 1] +
                nv21[idx + 1])
            .abs();
        sum += lap * lap;
        count++;
      }
    }
    return count > 0 && sum / count > 40;
  }

  bool _cornersStable(List<Offset> prev, List<Offset> next) {
    if (prev.length != 4 || next.length != 4) return false;
    for (var i = 0; i < 4; i++) {
      if ((prev[i] - next[i]).distance > 15) return false;
    }
    return true;
  }

  Future<void> _onFrame(CameraImage image) async {
    if (_processing) return;
    final state = context.read<ScannerState>();
    if (state.phase == ScanPhase.result) return;

    _processing = true;
    try {
      final nv21 = CameraService.cameraImageToNv21(image);
      final rotation = _camera.controller?.description.sensorOrientation ?? 0;

      final detect = await OmrBridge.instance.processFrameAsync(
        OmrFrameRequest(
          yuv: nv21,
          width: image.width,
          height: image.height,
          rotation: rotation,
          doGrade: 0,
        ),
      );

      if (!mounted) return;

      final sharp = _isFrameSharp(nv21, image.width, image.height);

      if (detect.found && detect.corners.length == 4 && sharp) {
        final stable = _corners.isNotEmpty &&
            _cornersStable(_corners, detect.corners);
        _corners = detect.corners;
        if (stable) {
          _stableFrames++;
        } else {
          _stableFrames = 1;
        }

        state.update(
          sheetFound: true,
          statusText: state.phase == ScanPhase.scanning
              ? 'Calificando...'
              : 'Hoja detectada',
        );

        final now = DateTime.now().millisecondsSinceEpoch;
        final canScan = now - _lastScanMs > _cooldownMs;
        if (_stableFrames >= _stableNeeded &&
            canScan &&
            state.phase == ScanPhase.detecting) {
          _stableFrames = 0;
          await _gradeSheet(image, nv21, rotation);
        }
      } else {
        _stableFrames = 0;
        _corners = [];
        state.update(
          sheetFound: false,
          statusText: 'Buscando hoja...',
        );
      }
    } finally {
      _processing = false;
    }
  }

  Future<void> _gradeSheet(
    CameraImage image,
    Uint8List nv21,
    int rotation,
  ) async {
    final state = context.read<ScannerState>();
    state.update(phase: ScanPhase.scanning, statusText: 'Calificando...');

    final graded = await OmrBridge.instance.processFrameAsync(
      OmrFrameRequest(
        yuv: nv21,
        width: image.width,
        height: image.height,
        rotation: rotation,
        doGrade: 1,
      ),
    );

    if (!mounted) return;

    if (graded.graded) {
      _lastScanMs = DateTime.now().millisecondsSinceEpoch;
      HapticFeedback.heavyImpact();
      if (await Vibration.hasVibrator() == true) {
        await Vibration.vibrate(duration: 100);
      }

      state.update(
        phase: ScanPhase.result,
        lastResult: graded,
        scanCount: state.scanCount + 1,
        statusText: 'Escaneo completado',
      );

      Future.delayed(const Duration(seconds: 4), () {
        if (!mounted) return;
        state.update(
          phase: ScanPhase.cooldown,
          statusText: 'Enfriando...',
        );
        Future.delayed(const Duration(milliseconds: _cooldownMs), () {
          if (!mounted) return;
          state.update(
            phase: ScanPhase.detecting,
            statusText: 'Buscando hoja...',
          );
        });
      });
    } else {
      state.update(
        phase: ScanPhase.detecting,
        statusText: 'Hoja detectada',
      );
    }
  }

  @override
  void dispose() {
    _camera.stopImageStream();
    _camera.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ScannerState>(
      builder: (context, state, _) {
        return Scaffold(
          backgroundColor: Colors.black,
          body: Stack(
            fit: StackFit.expand,
            children: [
              if (_camera.isInitialized)
                Center(
                  child: AspectRatio(
                    aspectRatio: 3 / 4,
                    child: ClipRect(
                      child: OverflowBox(
                        alignment: Alignment.center,
                        child: FittedBox(
                          fit: BoxFit.cover,
                          child: SizedBox(
                            width: _camera.controller!.value.previewSize!.height,
                            height: _camera.controller!.value.previewSize!.width,
                            child: CameraPreview(_camera.controller!),
                          ),
                        ),
                      ),
                    ),
                  ),
                )
              else
                const Center(
                  child: CircularProgressIndicator(color: Colors.green),
                ),
              if (_camera.isInitialized)
                LayoutBuilder(
                  builder: (context, constraints) {
                    return CustomPaint(
                      size: Size(constraints.maxWidth, constraints.maxHeight),
                      painter: _ScannerOverlayPainter(
                        corners: _corners,
                        sheetFound: state.sheetFound,
                        previewSize: _camera.controller!.value.previewSize!,
                      ),
                    );
                  },
                ),
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                left: 16,
                right: 16,
                child: _StatusBar(
                  text: state.statusText,
                  error: state.error,
                ),
              ),
              Positioned(
                top: MediaQuery.paddingOf(context).top + 8,
                right: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${state.scanCount}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
              if (state.phase == ScanPhase.result)
                _ResultOverlay(result: state.lastResult),
            ],
          ),
        );
      },
    );
  }
}

class _StatusBar extends StatelessWidget {
  final String text;
  final String? error;

  const _StatusBar({required this.text, this.error});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        error ?? text,
        style: TextStyle(
          color: error != null ? Colors.redAccent : Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _ScannerOverlayPainter extends CustomPainter {
  final List<Offset> corners;
  final bool sheetFound;
  final Size previewSize;

  _ScannerOverlayPainter({
    required this.corners,
    required this.sheetFound,
    required this.previewSize,
  });

  Offset _mapPoint(Offset p, Size size) {
    final scaleX = size.width / previewSize.height;
    final scaleY = size.height / previewSize.width;
    return Offset(p.dx * scaleX, p.dy * scaleY);
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (!sheetFound || corners.length != 4) return;

    final paintCircle = Paint()
      ..color = const Color(0xFF22C55E)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    final paintLine = Paint()
      ..color = const Color(0x4022C55E)
      ..strokeWidth = 1.5;

    final center = Offset(size.width / 2, size.height / 2);

    for (final c in corners) {
      final mapped = _mapPoint(c, size);
      canvas.drawCircle(mapped, 12, paintCircle);
      final toward = Offset(
        center.dx + (mapped.dx - center.dx) * 0.7,
        center.dy + (mapped.dy - center.dy) * 0.7,
      );
      canvas.drawLine(mapped, toward, paintLine);
    }
  }

  @override
  bool shouldRepaint(covariant _ScannerOverlayPainter old) =>
      old.corners != corners || old.sheetFound != sheetFound;
}

class _ResultOverlay extends StatelessWidget {
  final ScanResult result;

  const _ResultOverlay({required this.result});

  @override
  Widget build(BuildContext context) {
    final labels = result.answerLabels;
    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: Container(
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF22C55E)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Resultado',
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (result.studentId.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'ID: ${result.studentId.join(' | ')}',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 5,
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                childAspectRatio: 1.4,
              ),
              itemCount: labels.length,
              itemBuilder: (context, i) {
                final letter = labels[i];
                final marked = letter != '-';
                return Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: marked
                        ? const Color(0xFF166534)
                        : const Color(0xFF27272A),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Q${i + 1}\n$letter',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: marked ? const Color(0xFF4ADE80) : Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () {
                  context.read<ScannerState>().update(
                        phase: ScanPhase.detecting,
                        statusText: 'Buscando hoja...',
                      );
                },
                child: const Text('Continuar escaneando'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
