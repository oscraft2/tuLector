import 'package:flutter_test/flutter_test.dart';
import 'package:tulector/config/scanner_config.dart';
import 'package:tulector/models/scan_result.dart';

void main() {
  test('ScanCodes alineados con omr_reference.json', () {
    expect(ScanCodes.graded, 1);
    expect(ScanCodes.bright, 5);
    expect(ScanCodes.curveFail, 10);
    expect(ScanThresholds.scanCooldownMs, 2500);
  });

  test('ScanResult almacena respuestas como texto', () {
    const r = ScanResult(answers: ['A', 'C', '-', '?']);
    expect(r.answers[0], 'A');
    expect(r.answers[3], '?');
  });
}
