/**
 * Motor OMR TuLector - Port 1:1 de src/lib/omr.ts
 * Referencia: omr_reference.json (parametros y codigos de retorno)
 */
#include "omr_engine.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <numeric>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

constexpr int SHEET_W = 1200;
constexpr int SHEET_H = 1650;
constexpr int MARGIN = 40;
constexpr int CORNER_SIZE = 50;
constexpr int NUM_QUESTIONS = 20;
constexpr int NUM_OPTIONS = 5;
constexpr int ID_ROWS = 3;
constexpr int ID_COLS = 10;
constexpr int DARK_THRESH = 70;
constexpr int GLARE_THRESH = 220;
constexpr char LABELS[] = "ABCDE";

constexpr int NAME_TOP = MARGIN + CORNER_SIZE + 10;
constexpr int NAME_H = 35;
constexpr int NAME_BOTTOM = NAME_TOP + NAME_H;
constexpr int ID_START = NAME_BOTTOM + 15;
constexpr int Q_TOP = ID_START + ID_ROWS * 28 + 30;
constexpr int Q_H = 42;

struct Point2f { float x, y; };

void setReason(OmrResult* out, const char* msg) {
  if (!out) return;
  std::strncpy(out->reason, msg, sizeof(out->reason) - 1);
  out->reason[sizeof(out->reason) - 1] = '\0';
}

// --- findCorners: grid-based dense-blob with 2-direction white neighbor check ---
bool findCorners(const uint8_t* gray, int w, int h, Point2f corners[4]) {
  // Build integral image
  std::vector<uint32_t> integral(w * h);
  for (int y = 0; y < h; y++) {
    uint32_t rowSum = 0;
    for (int x = 0; x < w; x++) {
      rowSum += (gray[y * w + x] < 80 ? 1 : 0);
      integral[y * w + x] = (y > 0 ? integral[(y - 1) * w + x] : 0) + rowSum;
    }
  }
  auto regionDark = [&](int x, int y, int sx, int sy) -> int {
    const int x2 = std::min(x + sx - 1, w - 1);
    const int y2 = std::min(y + sy - 1, h - 1);
    int sum = integral[y2 * w + x2];
    if (x > 0) sum -= integral[y2 * w + (x - 1)];
    if (y > 0) sum -= integral[(y - 1) * w + x2];
    if (x > 0 && y > 0) sum += integral[(y - 1) * w + (x - 1)];
    return sum;
  };

  struct ZoneDef { int x0, y0, x1, y1, ex, ey; };
  const ZoneDef zones[4] = {
    {15, 15, (int)(w * 0.45f), (int)(h * 0.45f), 15, 15},
    {(int)(w * 0.55f), 15, w - 15, (int)(h * 0.45f), w - 15, 15},
    {(int)(w * 0.55f), (int)(h * 0.55f), w - 15, h - 15, w - 15, h - 15},
    {15, (int)(h * 0.55f), (int)(w * 0.45f), h - 15, 15, h - 15},
  };

  const int cellSize = (int)(std::min(w, h) * 0.018f);
  const int stride = std::max(3, cellSize / 3);
  const float minDensity = 0.35f;
  const float maxDensity = 0.90f;
  const int checkGap = (int)(cellSize * 1.2f);

  // 2-direction white neighbor checks per zone: {dx1, dy1, dx2, dy2}
  const int neighborDirs[4][4] = {
    {checkGap, 0, 0, checkGap},           // TL: right + below
    {-checkGap, 0, 0, checkGap},          // TR: left + below
    {-checkGap, 0, 0, -checkGap},         // BR: left + above
    {checkGap, 0, 0, -checkGap},          // BL: right + above
  };

  for (int z = 0; z < 4; z++) {
    const auto& zd = zones[z];
    const int* nd = neighborDirs[z];
    float bestScore = -1;
    int bestCx = 0, bestCy = 0;

    for (int cy = zd.y0; cy <= zd.y1 - cellSize; cy += stride) {
      for (int cx = zd.x0; cx <= zd.x1 - cellSize; cx += stride) {
        const int dark = regionDark(cx, cy, cellSize, cellSize);
        const float density = (float)dark / (cellSize * cellSize);
        if (density < minDensity || density > maxDensity) continue;

        const int n1x = std::max(0, std::min(w - 10, (int)(cx + nd[0])));
        const int n1y = std::max(0, std::min(h - 10, (int)(cy + nd[1])));
        if ((float)regionDark(n1x, n1y, 10, 10) / 100.f > 0.20f) continue;

        const int n2x = std::max(0, std::min(w - 10, (int)(cx + nd[2])));
        const int n2y = std::max(0, std::min(h - 10, (int)(cy + nd[3])));
        if ((float)regionDark(n2x, n2y, 10, 10) / 100.f > 0.20f) continue;

        const float distToExpected = std::hypot((float)(cx + cellSize / 2 - zd.ex),
                                                 (float)(cy + cellSize / 2 - zd.ey)) /
                                      std::max(w, h);
        const float score = density * 0.7f + (1.f - std::min(1.f, distToExpected)) * 0.3f;

        if (score > bestScore) {
          bestScore = score;
          bestCx = cx;
          bestCy = cy;
        }
      }
    }

    if (bestScore < 0) return false;

    // Refine: center-of-mass in region around best cell
    double sx = 0, sy = 0;
    int c = 0;
    const int rm = cellSize / 2;
    for (int ry = std::max(0, bestCy - rm); ry <= std::min(h - 1, bestCy + cellSize + rm); ry++) {
      for (int rx = std::max(0, bestCx - rm); rx <= std::min(w - 1, bestCx + cellSize + rm); rx++) {
        if (gray[ry * w + rx] < 80) { sx += rx; sy += ry; c++; }
      }
    }
    corners[z].x = c > 0 ? (float)std::round(sx / c) : (float)(bestCx + cellSize / 2);
    corners[z].y = c > 0 ? (float)std::round(sy / c) : (float)(bestCy + cellSize / 2);
  }

  // Validate quadrilateral
  const float tl0 = corners[0].x, tl1 = corners[0].y;
  const float tr0 = corners[1].x, tr1 = corners[1].y;
  const float br0 = corners[2].x, br1 = corners[2].y;
  const float bl0 = corners[3].x, bl1 = corners[3].y;

  const float topW = std::hypot(tr0 - tl0, tr1 - tl1);
  const float botW = std::hypot(br0 - bl0, br1 - bl1);
  const float leftH = std::hypot(bl0 - tl0, bl1 - tl1);
  const float rightH = std::hypot(br0 - tr0, br1 - tr1);
  const float avgW = (topW + botW) / 2.f;
  const float avgH = (leftH + rightH) / 2.f;
  const float aspect = avgW / std::max(avgH, 1.f);
  if (aspect < 0.35f || aspect > 2.8f) return false;
  if (topW / std::max(botW, 1.f) < 0.3f || botW / std::max(topW, 1.f) < 0.3f) return false;
  if (leftH / std::max(rightH, 1.f) < 0.3f || rightH / std::max(leftH, 1.f) < 0.3f) return false;
  const float area = std::fabs((tr0 - tl0) * (br1 - tl1) - (tr1 - tl1) * (br0 - tl0));
  if (area < 15000.f) return false;

  return true;
}
      }
    }
    if (c < 150) return false;
    const double cx = sx / c, cy = sy / c;
    const double varX = sxx / c - cx * cx;
    const double varY = syy / c - cy * cy;
    if (varX > 1500 || varY > 1500) return false;
    pts[z][0] = (float)std::round(cx);
    pts[z][1] = (float)std::round(cy);
  }

  const float tl0 = pts[0][0], tl1 = pts[0][1];
  const float tr0 = pts[1][0], tr1 = pts[1][1];
  const float br0 = pts[2][0], br1 = pts[2][1];
  const float bl0 = pts[3][0], bl1 = pts[3][1];

  if (std::fabs(tl1 - tr1) > h * 0.05f) return false;
  if (std::fabs(bl1 - br1) > h * 0.05f) return false;
  if (std::fabs(tl0 - bl0) > w * 0.05f) return false;
  if (std::fabs(tr0 - br0) > w * 0.05f) return false;

  const float topW = std::hypot(tr0 - tl0, tr1 - tl1);
  const float botW = std::hypot(br0 - bl0, br1 - bl1);
  const float leftH = std::hypot(bl0 - tl0, bl1 - tl1);
  const float rightH = std::hypot(br0 - tr0, br1 - tr1);
  const float avgW = (topW + botW) / 2.f;
  const float avgH = (leftH + rightH) / 2.f;
  const float aspect = avgW / std::max(avgH, 1.f);
  if (aspect < 0.5f || aspect > 2.0f) return false;
  if (topW / std::max(botW, 1.f) < 0.5f || botW / std::max(topW, 1.f) < 0.5f) return false;
  if (leftH / std::max(rightH, 1.f) < 0.5f || rightH / std::max(leftH, 1.f) < 0.5f) return false;

  const float area = std::fabs((tr0 - tl0) * (br1 - tl1) - (tr1 - tl1) * (br0 - tl0));
  if (area < 50000.f) return false;

  for (int i = 0; i < 4; i++) {
    corners[i].x = pts[i][0];
    corners[i].y = pts[i][1];
  }
  return true;
}

bool solve8x8(double A[8][9], double out[8]) {
  const int n = 8;
  for (int col = 0; col < n; col++) {
    int maxRow = col;
    for (int row = col + 1; row < n; row++) {
      if (std::fabs(A[row][col]) > std::fabs(A[maxRow][col])) maxRow = row;
    }
    for (int j = 0; j <= n; j++) std::swap(A[col][j], A[maxRow][j]);
    if (std::fabs(A[col][col]) < 1e-10) return false;
    for (int row = col + 1; row < n; row++) {
      const double f = A[row][col] / A[col][col];
      for (int j = col; j <= n; j++) A[row][j] -= f * A[col][j];
    }
  }
  for (int i = n - 1; i >= 0; i--) {
    out[i] = A[i][n];
    for (int j = i + 1; j < n; j++) out[i] -= A[i][j] * out[j];
    out[i] /= A[i][i];
  }
  return true;
}

void nv21ToRgba(const uint8_t* nv21, int w, int h, std::vector<uint8_t>& rgba) {
  rgba.resize(w * h * 4);
  const uint8_t* yPlane = nv21;
  const uint8_t* vuPlane = nv21 + w * h;
  for (int y = 0; y < h; y++) {
    for (int x = 0; x < w; x++) {
      const int Y = yPlane[y * w + x];
      const int uvIdx = (y / 2) * w + (x & ~1);
      const int V = vuPlane[uvIdx];
      const int U = vuPlane[uvIdx + 1];
      const int C = Y - 16, D = U - 128, E = V - 128;
      int R = (298 * C + 409 * E + 128) >> 8;
      int G = (298 * C - 100 * D - 208 * E + 128) >> 8;
      int B = (298 * C + 516 * D + 128) >> 8;
      R = std::clamp(R, 0, 255);
      G = std::clamp(G, 0, 255);
      B = std::clamp(B, 0, 255);
      const int di = (y * w + x) * 4;
      rgba[di] = (uint8_t)R;
      rgba[di + 1] = (uint8_t)G;
      rgba[di + 2] = (uint8_t)B;
      rgba[di + 3] = 255;
    }
  }
}

bool warpPerspective(const std::vector<uint8_t>& srcRgba, int sw, int sh,
                     const Point2f corners[4], std::vector<uint8_t>& outRgba) {
  const Point2f tl = corners[0], tr = corners[1], br = corners[2], bl = corners[3];
  const float dst[8] = {
      MARGIN + CORNER_SIZE / 2.f, MARGIN + CORNER_SIZE / 2.f,
      SHEET_W - MARGIN - CORNER_SIZE / 2.f, MARGIN + CORNER_SIZE / 2.f,
      SHEET_W - MARGIN - CORNER_SIZE / 2.f, SHEET_H - MARGIN - CORNER_SIZE / 2.f,
      MARGIN + CORNER_SIZE / 2.f, SHEET_H - MARGIN - CORNER_SIZE / 2.f,
  };
  const float src[8] = {tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y};

  double A[8][9];
  for (int i = 0; i < 4; i++) {
    const double sx = src[i * 2], sy = src[i * 2 + 1];
    const double dx = dst[i * 2], dy = dst[i * 2 + 1];
    A[i * 2][0] = sx;
    A[i * 2][1] = sy;
    A[i * 2][2] = 1;
    A[i * 2][3] = 0;
    A[i * 2][4] = 0;
    A[i * 2][5] = 0;
    A[i * 2][6] = -dx * sx;
    A[i * 2][7] = -dx * sy;
    A[i * 2][8] = dx;
    A[i * 2 + 1][0] = 0;
    A[i * 2 + 1][1] = 0;
    A[i * 2 + 1][2] = 0;
    A[i * 2 + 1][3] = sx;
    A[i * 2 + 1][4] = sy;
    A[i * 2 + 1][5] = 1;
    A[i * 2 + 1][6] = -dy * sx;
    A[i * 2 + 1][7] = -dy * sy;
    A[i * 2 + 1][8] = dy;
  }

  double h[8];
  if (!solve8x8(A, h)) return false;

  outRgba.resize(SHEET_W * SHEET_H * 4);
  for (int dy = 0; dy < SHEET_H; dy++) {
    for (int dx = 0; dx < SHEET_W; dx++) {
      const double denom = h[6] * dx + h[7] * dy + 1.0;
      const int sx = (int)std::round((h[0] * dx + h[1] * dy + h[2]) / denom);
      const int sy = (int)std::round((h[3] * dx + h[4] * dy + h[5]) / denom);
      const int di = (dy * SHEET_W + dx) * 4;
      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const int si = (sy * sw + sx) * 4;
        outRgba[di] = srcRgba[si];
        outRgba[di + 1] = srcRgba[si + 1];
        outRgba[di + 2] = srcRgba[si + 2];
        outRgba[di + 3] = 255;
      } else {
        outRgba[di] = outRgba[di + 1] = outRgba[di + 2] = 255;
        outRgba[di + 3] = 255;
      }
    }
  }
  return true;
}

struct BubbleClassify {
  float score;
  bool glare;
};

BubbleClassify classifyBubble(const std::vector<float>& gray, int w, int cx, int cy, int r) {
  BubbleClassify out{0.f, false};
  int dark = 0, total = 0, bright = 0;
  double sum = 0, sumSq = 0;
  std::vector<float> centerVals, edgeVals;

  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      const int px = cx + dx, py = cy + dy;
      if (px >= 0 && px < w && py >= 0 && py < (int)gray.size() / w) {
        const float v = gray[py * w + px];
        total++;
        sum += v;
        sumSq += v * v;
        if (v < DARK_THRESH) dark++;
        if (v > GLARE_THRESH) bright++;
        const float dist = std::sqrt((float)(dx * dx + dy * dy));
        if (dist < r * 0.45f) centerVals.push_back(v);
        else if (dist > r * 0.65f) edgeVals.push_back(v);
      }
    }
  }
  if (total == 0) return out;

  const float darkRatio = (float)dark / total;
  const float centerAvg = centerVals.empty() ? 255.f
                                               : std::accumulate(centerVals.begin(), centerVals.end(), 0.f) /
                                                     centerVals.size();
  const float edgeAvg = edgeVals.empty() ? 255.f
                                         : std::accumulate(edgeVals.begin(), edgeVals.end(), 0.f) / edgeVals.size();
  const float contrast = edgeAvg > 0 ? (edgeAvg - centerAvg) / edgeAvg : 0.f;
  const float mean = (float)(sum / total);
  const float variance = (float)(sumSq / total - mean * mean);
  int edgeDark = 0;
  for (float v : edgeVals)
    if (v < 100) edgeDark++;
  const float edgeDensity = edgeVals.empty() ? 0.f : (float)edgeDark / edgeVals.size();

  out.score = darkRatio * 0.40f + contrast * 0.25f + std::min(variance / 10000.f, 1.f) * 0.15f +
              edgeDensity * 0.20f;
  out.glare = (float)bright / total > 0.25f;
  return out;
}

bool checkCurve(const Point2f corners[4]) {
  const Point2f tl = corners[0], tr = corners[1], br = corners[2], bl = corners[3];
  const float topLen = std::hypot(tr.x - tl.x, tr.y - tl.y);
  const float botLen = std::hypot(br.x - bl.x, br.y - bl.y);
  const float leftLen = std::hypot(bl.x - tl.x, bl.y - tl.y);
  const float rightLen = std::hypot(br.x - tr.x, br.y - tr.y);
  const float hRatio = std::max(topLen, botLen) / std::max(std::min(topLen, botLen), 1.f);
  const float vRatio = std::max(leftLen, rightLen) / std::max(std::min(leftLen, rightLen), 1.f);
  if (hRatio > 1.4f || vRatio > 1.4f) return true;
  const float diag1 = std::hypot(br.x - tl.x, br.y - tl.y);
  const float diag2 = std::hypot(tr.x - bl.x, tr.y - bl.y);
  const float dRatio = std::max(diag1, diag2) / std::max(std::min(diag1, diag2), 1.f);
  return dRatio > 1.3f;
}

bool validateFormat(const std::vector<float>& gray, int w, int h, std::string& reason) {
  const int cornersToCheck[4][2] = {
      {MARGIN + 25, MARGIN + 25},
      {w - MARGIN - 25, MARGIN + 25},
      {w - MARGIN - 25, h - MARGIN - 25},
      {MARGIN + 25, h - MARGIN - 25},
  };
  for (const auto& c : cornersToCheck) {
    int dark = 0, total = 0;
    for (int dy = -15; dy <= 15; dy++) {
      for (int dx = -15; dx <= 15; dx++) {
        const int px = c[0] + dx, py = c[1] + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          total++;
          if (gray[py * w + px] < DARK_THRESH) dark++;
        }
      }
    }
    if (total > 0 && (float)dark / total < 0.08f) {
      reason = "Falta marca de esquina";
      return false;
    }
  }

  const int sampleQ[] = {0, 5, 10, 15, 19};
  int bubbleChecks = 0, bubblePassed = 0;
  for (int qi = 0; qi < 5; qi++) {
    const int q = sampleQ[qi];
    const int qy = Q_TOP + q * Q_H;
    for (int o = 0; o < 5; o++) {
      const int cx = MARGIN + 150 + o * 50, cy = qy + 16;
      int ring = 0, total = 0;
      for (int dy = -12; dy <= 12; dy++) {
        for (int dx = -12; dx <= 12; dx++) {
          const int px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            total++;
            const float dist = std::sqrt((float)(dx * dx + dy * dy));
            if (dist > 9 && dist < 13 && gray[py * w + px] < 100) ring++;
          }
        }
      }
      bubbleChecks++;
      if (total > 0 && (float)ring / total > 0.01f) bubblePassed++;
    }
  }
  if (bubbleChecks > 0 && (float)bubblePassed / bubbleChecks < 0.5f) {
    reason = "Formato incorrecto - burbujas";
    return false;
  }

  int idChecks = 0, idPassed = 0;
  for (int row = 0; row < 3; row++) {
    for (int col = 0; col < 5; col++) {
      const int cx = MARGIN + 30 + col * 28, cy = ID_START + 10 + row * 28;
      int ring = 0, total = 0;
      for (int dy = -8; dy <= 8; dy++) {
        for (int dx = -8; dx <= 8; dx++) {
          const int px = cx + dx, py = cy + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            total++;
            const float dist = std::sqrt((float)(dx * dx + dy * dy));
            if (dist > 6 && dist < 9 && gray[py * w + px] < 100) ring++;
          }
        }
      }
      idChecks++;
      if (total > 0 && (float)ring / total > 0.005f) idPassed++;
    }
  }
  if (idChecks > 0 && (float)idPassed / idChecks < 0.3f) {
    reason = "Zona de ID no detectada";
    return false;
  }
  return true;
}

int gradeBubblesFull(const std::vector<uint8_t>& rgba, const Point2f corners[4],
                     OmrResult* out) {
  std::vector<float> gray(SHEET_W * SHEET_H);
  for (int i = 0; i < SHEET_W * SHEET_H; i++) {
    const int j = i * 4;
    gray[i] = rgba[j] * 0.299f + rgba[j + 1] * 0.587f + rgba[j + 2] * 0.114f;
  }

  int td = 0;
  for (float g : gray)
    if (g < DARK_THRESH) td++;
  if ((float)td / gray.size() < 0.003f) {
    setReason(out, "Warp vacio");
    return OMR_CODE_WRONG_FORMAT;
  }

  if (checkCurve(corners)) {
    setReason(out, "Papel curvado - alisa la hoja");
    return OMR_CODE_CURVE_FAIL;
  }

  std::string fmtReason;
  if (!validateFormat(gray, SHEET_W, SHEET_H, fmtReason)) {
    setReason(out, fmtReason.c_str());
    return OMR_CODE_WRONG_FORMAT;
  }

  int glareWarnings = 0;
  std::unordered_map<std::string, int> sameCount;

  for (int q = 0; q < NUM_QUESTIONS; q++) {
    const int qy = Q_TOP + q * Q_H;
    float scores[NUM_OPTIONS];
    bool glares[NUM_OPTIONS];
    for (int o = 0; o < NUM_OPTIONS; o++) {
      const int cx = MARGIN + 150 + o * 50, cy = qy + 16;
      const BubbleClassify bc = classifyBubble(gray, SHEET_W, cx, cy, 10);
      scores[o] = bc.score;
      glares[o] = bc.glare;
      if (bc.glare) glareWarnings++;
    }

    const float maxS = *std::max_element(scores, scores + NUM_OPTIONS);
    const float thresh = std::max(0.18f, maxS * 0.35f);
    int marked[NUM_OPTIONS];
    int markedCount = 0;
    for (int o = 0; o < NUM_OPTIONS; o++) {
      if (scores[o] > thresh && !glares[o]) {
        marked[markedCount++] = o;
      }
    }

    int glareCount = 0;
    for (int o = 0; o < NUM_OPTIONS; o++)
      if (glares[o]) glareCount++;

    std::string answer = "-";
    if (glareCount >= 3) {
      answer = "?";
    } else if (markedCount == 0 && maxS > 0.12f) {
      const int idx = (int)(std::max_element(scores, scores + NUM_OPTIONS) - scores);
      answer = std::string(1, LABELS[idx]);
      out->answers[q] = idx;
    } else if (markedCount > 0 && markedCount <= 3) {
      answer.clear();
      for (int i = 0; i < markedCount; i++) answer += LABELS[marked[i]];
      out->answers[q] = marked[0];
    } else {
      out->answers[q] = -1;
    }

    std::strncpy(out->answer_text[q], answer.c_str(), 7);
    out->answer_text[q][7] = '\0';
    sameCount[answer]++;
  }

  if (glareWarnings > 10) {
    setReason(out, "Demasiado brillo");
    return OMR_CODE_BRIGHT;
  }

  int answered = 0;
  for (int q = 0; q < NUM_QUESTIONS; q++) {
    const char* a = out->answer_text[q];
    if (a[0] != '-' && a[0] != '?' && a[0] != '\0') answered++;
  }
  if (answered == 0) {
    setReason(out, "Sin respuestas detectadas");
    return OMR_CODE_OUT_OF_FOCUS;
  }

  int maxSame = 0;
  for (const auto& kv : sameCount)
    if (kv.second > maxSame) maxSame = kv.second;
  if (maxSame >= 18 && answered >= 18) {
    setReason(out, "Posible mal warp");
    return OMR_CODE_WRONG_FORMAT;
  }

  out->valid = 1;
  return OMR_CODE_GRADED;
}

void readStudentIdFull(const std::vector<uint8_t>& rgba, char idOut[ID_ROWS][ID_COLS + 1]) {
  std::vector<float> gray(SHEET_W * SHEET_H);
  for (int i = 0; i < SHEET_W * SHEET_H; i++) {
    const int j = i * 4;
    gray[i] = rgba[j] * 0.299f + rgba[j + 1] * 0.587f + rgba[j + 2] * 0.114f;
  }
  const int xStart = MARGIN + 30;
  const int yStart = ID_START + 10;
  for (int row = 0; row < ID_ROWS; row++) {
    std::memset(idOut[row], '0', ID_COLS);
    idOut[row][ID_COLS] = '\0';
    for (int col = 0; col < ID_COLS; col++) {
      const int cx = xStart + col * 28, cy = yStart + row * 28;
      int dk = 0, tot = 0;
      for (int dy = -6; dy <= 6; dy++) {
        for (int dx = -6; dx <= 6; dx++) {
          const int px = cx + dx, py = cy + dy;
          if (px >= 0 && px < SHEET_W && py >= 0 && py < SHEET_H) {
            tot++;
            if (gray[py * SHEET_W + px] < DARK_THRESH) dk++;
          }
        }
      }
      if (tot > 0 && (float)dk / tot > 0.12f) idOut[row][col] = '1';
    }
  }
}

void applyRotationY(const std::vector<uint8_t>& in, int w, int h, int rotation,
                    std::vector<uint8_t>& out, int& outW, int& outH) {
  rotation = ((rotation % 360) + 360) % 360;
  if (rotation == 0) {
    out = in;
    outW = w;
    outH = h;
    return;
  }
  if (rotation == 90) {
    // 90° CW: input (x,y) → output col=(h-1-y), row=x; outW=h, outH=w
    outW = h;
    outH = w;
    out.resize(outW * outH);
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++) out[(h - 1 - y) + x * h] = in[y * w + x];
    return;
  }
  if (rotation == 180) {
    outW = w;
    outH = h;
    out.resize(w * h);
    for (int i = 0; i < w * h; i++) out[i] = in[w * h - 1 - i];
    return;
  }
  // 270° CW (90° CCW): input (x,y) → output col=y, row=(w-1-x); outW=h, outH=w
  outW = h;
  outH = w;
  out.resize(outW * outH);
  for (int y = 0; y < h; y++)
    for (int x = 0; x < w; x++) out[y + (w - 1 - x) * h] = in[y * w + x];
}

}  // namespace

extern "C" void omr_process_frame(
    const uint8_t* yuv_nv21,
    int width,
    int height,
    int rotation,
    int do_grade,
    OmrResult* out) {
  if (!out || !yuv_nv21 || width <= 0 || height <= 0) return;

  std::memset(out, 0, sizeof(OmrResult));
  for (int i = 0; i < OMR_NUM_QUESTIONS; i++) {
    out->answers[i] = -1;
    std::strcpy(out->answer_text[i], "-");
  }

  std::vector<uint8_t> yPlane(width * height);
  std::memcpy(yPlane.data(), yuv_nv21, width * height);

  std::vector<uint8_t> rotatedY;
  int rw = width, rh = height;
  applyRotationY(yPlane, width, height, rotation, rotatedY, rw, rh);

  Point2f corners[4];
  const bool found = findCorners(rotatedY.data(), rw, rh, corners);
  out->found = found ? 1 : 0;
  for (int i = 0; i < 4; i++) {
    out->corners_x[i] = corners[i].x;
    out->corners_y[i] = corners[i].y;
  }

  if (!found) {
    out->result_code = OMR_CODE_ALIGN_START;
    setReason(out, "Alinea los 4 cuadrados");
    return;
  }

  if (!do_grade) {
    out->result_code = 0;
    return;
  }

  std::vector<uint8_t> nv21;
  if (rotation == 0) {
    nv21.assign(yuv_nv21, yuv_nv21 + width * height * 3 / 2);
  } else {
    nv21.resize(rw * rh * 3 / 2);
    std::memcpy(nv21.data(), rotatedY.data(), rw * rh);
    std::memset(nv21.data() + rw * rh, 128, rw * rh / 2);
  }

  std::vector<uint8_t> rgba;
  nv21ToRgba(nv21.data(), rw, rh, rgba);

  std::vector<uint8_t> warped;
  if (!warpPerspective(rgba, rw, rh, corners, warped)) {
    out->result_code = OMR_CODE_WRONG_FORMAT;
    setReason(out, "Homografia fallida");
    return;
  }

  const int code = gradeBubblesFull(warped, corners, out);
  out->result_code = code;
  if (code == OMR_CODE_GRADED) {
    readStudentIdFull(warped, out->student_id);
    out->graded = 1;
    setReason(out, "OK");
  }
}
