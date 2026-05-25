import 'package:flutter_test/flutter_test.dart';
import 'package:tulector/models/scan_result.dart';

void main() {
  test('ScanResult answerLabels maps indices to ABCDE', () {
    const result = ScanResult(
      graded: true,
      answers: [0, 1, 2, 3, 4, -1],
    );
    expect(result.answerLabels[0], 'A');
    expect(result.answerLabels[1], 'B');
    expect(result.answerLabels[5], '-');
  });
}
