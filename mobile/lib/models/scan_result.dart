import 'dart:ui';

class ScanResult {
  final bool found;
  final List<Offset> corners;
  final bool graded;
  final List<int> answers;
  final List<String> studentId;

  const ScanResult({
    this.found = false,
    this.corners = const [],
    this.graded = false,
    this.answers = const [],
    this.studentId = const [],
  });

  static const empty = ScanResult();

  List<String> get answerLabels {
    const labels = 'ABCDE';
    return List.generate(answers.length, (i) {
      final a = answers[i];
      if (a < 0 || a >= labels.length) return '-';
      return labels[a];
    });
  }
}
