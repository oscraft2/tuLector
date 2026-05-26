// Paridad con src/lib/scanner_config.ts y omr_reference.json

class ScanCodes {
  static const int graded = 1;
  static const int bright = 5;
  static const int curveFail = 10;
  static const int wrongFormat = 30;
  static const int alignStart = 100;
  static const int outOfFocus = 1001;
}

class ScanThresholds {
  static const int scanCooldownMs = 2500;
  static const int badPaperThreshold = 45;
  static const int outOfFocusThreshold = 50;
  static const int stableFramesNeeded = 12;
  static const int frameSkipMs = 66;
}

const Map<int, String> scanMessages = {
  100: 'Alinea los 4 cuadrados en los visores',
  106: 'Esperando foco...',
  30: 'Verifica el formato de la hoja',
  10: 'Papel curvado detectado - alisa la hoja',
  5: 'Brillo detectado - cambia el angulo',
  1001: 'Fuera de foco - ajusta la distancia',
};

int normalizeRotation(int deviceRotation) {
  var r = deviceRotation - 90;
  if (r < 0) r += 360;
  return r;
}
