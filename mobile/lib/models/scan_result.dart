import 'dart:ui';

class ScanResult {
  final bool found;
  final int resultCode;
  final List<Offset> corners;
  final bool graded;
  final bool valid;
  final List<String> answers;
  final List<String> studentId;
  final String reason;

  const ScanResult({
    this.found = false,
    this.resultCode = 0,
    this.corners = const [],
    this.graded = false,
    this.valid = false,
    this.answers = const [],
    this.studentId = const [],
    this.reason = '',
  });

  static const empty = ScanResult();
}
