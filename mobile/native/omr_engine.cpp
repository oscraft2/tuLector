/**
 * Motor OMR TuLector - C++ puro (sin OpenCV).
 * Port de src/lib/omr.ts para paridad con la app web.
 */
#include "omr_engine.h"

#include <algorithm>
#include <cmath>
#include <cstring>
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

constexpr int NAME_TOP = MARGIN + CORNER_SIZE + 10;
constexpr int NAME_H = 35;
constexpr int NAME_BOTTOM = NAME_TOP + NAME_H;
constexpr int ID_START = NAME_BOTTOM + 15;
constexpr int Q_TOP = ID_START + ID_ROWS * 28 + 30;
constexpr int Q_H = 42;

struct Point2f {
  float x, y;
};

// --- Otsu threshold (histograma + varianza entre clases) ---
int otsuThreshold(const uint8_t* gray, int w, int h) {
  int hist[256] = {0};
  const int n = w * h;
  for (int i = 0; i < n; i++) hist[gray[i]]++;

  long sum = 0;
  for (int i = 0; i < 256; i++) sum += (long)i * hist[i];

  long sumB = 0;
  int wB = 0;
  int wF = 0;
  double maxVar = 0.0;
  int threshold = 128;

  for (int t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB == 0) continue;
    wF = n - wB;
    if (wF == 0) break;

    sumB += (long)t * hist[t];
    const double mB = (double)sumB / wB;
    const double mF = (double)(sum - sumB) / wF;
    const double varBetween = (double)wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

// NV21: Y plane = primeros width*height bytes
void extractGrayFromNv21(const uint8_t* nv21, int w, int h, std::vector<uint8_t>& gray) {
  gray.resize(w * h);
  std::memcpy(gray.data(), nv21, w * h);
}

// NV21 -> RGBA (muestreo bilineal simplificado en centro de pixel)
void nv21ToRgba(const uint8_t* nv21, int w, int h, std::vector<uint8_t>& rgba) {
  rgba.resize(w * h * 4);
  const uint8_t* yPlane = nv21;
  const uint8_t* vuPlane = nv21 + w * h;

  for (int y = 0; y < h; y++) {
    for (int x = 0; x < w; x++) {
      const int yIdx = y * w + x;
      const int Y = yPlane[yIdx];
      const int uvIdx = (y / 2) * w + (x & ~1);
      const int V = vuPlane[uvIdx];
      const int U = vuPlane[uvIdx + 1];

      const int C = Y - 16;
      const int D = U - 128;
      const int E = V - 128;

      int R = (298 * C + 409 * E + 128) >> 8;
      int G = (298 * C - 100 * D - 208 * E + 128) >> 8;
      int B = (298 * C + 516 * D + 128) >> 8;

      R = std::clamp(R, 0, 255);
      G = std::clamp(G, 0, 255);
      B = std::clamp(B, 0, 255);

      const int di = yIdx * 4;
      rgba[di] = (uint8_t)R;
      rgba[di + 1] = (uint8_t)G;
      rgba[di + 2] = (uint8_t)B;
      rgba[di + 3] = 255;
    }
  }
}

uint8_t sampleGrayBilinear(const std::vector<uint8_t>& rgba, int sw, int sh, float sx, float sy) {
  if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) return 255;
  const int x0 = (int)sx;
  const int y0 = (int)sy;
  const float fx = sx - x0;
  const float fy = sy - y0;
  auto grayAt = [&](int x, int y) {
    const int i = (y * sw + x) * 4;
    return rgba[i] * 0.299f + rgba[i + 1] * 0.587f + rgba[i + 2] * 0.114f;
  };
  const float g00 = grayAt(x0, y0);
  const float g10 = grayAt(x0 + 1, y0);
  const float g01 = grayAt(x0, y0 + 1);
  const float g11 = grayAt(x0 + 1, y0 + 1);
  const float top = g00 * (1 - fx) + g10 * fx;
  const float bot = g01 * (1 - fx) + g11 * fx;
  return (uint8_t)std::round(top * (1 - fy) + bot * fy);
}

bool isPixelDarkRgb(const std::vector<uint8_t>& rgba, int sw, int px, int py) {
  const int i = (py * sw + px) * 4;
  const int avg = (rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3;
  return avg < 80;
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

bool findCorners(const uint8_t* gray, int w, int h, Point2f corners[4]) {
  const float zones[4][4] = {
      {0, 0, w * 0.08f, h * 0.06f},
      {w * 0.92f, 0, (float)w, h * 0.06f},
      {w * 0.92f, h * 0.92f, (float)w, (float)h},
      {0, h * 0.92f, w * 0.08f, (float)h},
  };

  int valid = 0;
  for (int z = 0; z < 4; z++) {
    const int x0 = (int)zones[z][0];
    const int y0 = (int)zones[z][1];
    const int x1 = (int)zones[z][2];
    const int y1 = (int)zones[z][3];

    double sumX = 0, sumY = 0;
    int count = 0;
    for (int y = y0; y < y1; y++) {
      for (int x = x0; x < x1; x++) {
        if (gray[y * w + x] < 80) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    if (count > 20) {
      corners[z].x = (float)std::round(sumX / count);
      corners[z].y = (float)std::round(sumY / count);
      valid++;
    } else {
      corners[z].x = (zones[z][0] + zones[z][2]) * 0.5f;
      corners[z].y = (zones[z][1] + zones[z][3]) * 0.5f;
    }
  }
  return valid >= 3;
}

bool warpPerspective(
    const std::vector<uint8_t>& srcRgba, int sw, int sh,
    const Point2f corners[4],
    std::vector<uint8_t>& outRgba) {
  const Point2f tl = corners[0];
  const Point2f tr = corners[1];
  const Point2f br = corners[2];
  const Point2f bl = corners[3];

  const float dst[8] = {
      MARGIN + CORNER_SIZE / 2.0f, MARGIN + CORNER_SIZE / 2.0f,
      SHEET_W - MARGIN - CORNER_SIZE / 2.0f, MARGIN + CORNER_SIZE / 2.0f,
      SHEET_W - MARGIN - CORNER_SIZE / 2.0f, SHEET_H - MARGIN - CORNER_SIZE / 2.0f,
      MARGIN + CORNER_SIZE / 2.0f, SHEET_H - MARGIN - CORNER_SIZE / 2.0f,
  };
  const float src[8] = {tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y};

  double A[8][9];
  for (int i = 0; i < 4; i++) {
    const double sx = src[i * 2];
    const double sy = src[i * 2 + 1];
    const double dx = dst[i * 2];
    const double dy = dst[i * 2 + 1];
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
      const float sx = (float)((h[0] * dx + h[1] * dy + h[2]) / denom);
      const float sy = (float)((h[3] * dx + h[4] * dy + h[5]) / denom);
      const int di = (dy * SHEET_W + dx) * 4;
      if (sx >= 0 && sx < sw - 1 && sy >= 0 && sy < sh - 1) {
        const uint8_t g = sampleGrayBilinear(srcRgba, sw, sh, sx, sy);
        outRgba[di] = g;
        outRgba[di + 1] = g;
        outRgba[di + 2] = g;
        outRgba[di + 3] = 255;
      } else {
        outRgba[di] = outRgba[di + 1] = outRgba[di + 2] = 255;
        outRgba[di + 3] = 255;
      }
    }
  }
  return true;
}

void gradeBubbles(const std::vector<uint8_t>& rgba, int answers[NUM_QUESTIONS]) {
  for (int q = 0; q < NUM_QUESTIONS; q++) {
    const int qy = Q_TOP + q * Q_H;
    float scores[NUM_OPTIONS];
    for (int o = 0; o < NUM_OPTIONS; o++) {
      const int cx = MARGIN + 50 + o * 50;
      const int cy = qy + 16;
      const int r = 8;  // ROI 16x16
      int dark = 0, total = 0;
      for (int dy = -r; dy <= r; dy++) {
        for (int dx = -r; dx <= r; dx++) {
          const int px = cx + dx, py = cy + dy;
          if (px >= 0 && px < SHEET_W && py >= 0 && py < SHEET_H) {
            total++;
            if (isPixelDarkRgb(rgba, SHEET_W, px, py)) dark++;
          }
        }
      }
      scores[o] = total > 0 ? (float)dark / total : 0.f;
    }

    float maxS = 0;
    int maxIdx = -1;
    for (int o = 0; o < NUM_OPTIONS; o++) {
      if (scores[o] > maxS) {
        maxS = scores[o];
        maxIdx = o;
      }
    }
    const float thresh = std::max(0.10f, maxS * 0.35f);
    int marked = -1;
    int markedCount = 0;
    for (int o = 0; o < NUM_OPTIONS; o++) {
      if (scores[o] > thresh && scores[o] > 0.04f) {
        marked = o;
        markedCount++;
      }
    }
    if (markedCount == 1) {
      answers[q] = marked;
    } else if (markedCount == 0 && maxS > 0.04f) {
      answers[q] = maxIdx;
    } else {
      answers[q] = -1;
    }
  }
}

void readStudentId(const std::vector<uint8_t>& rgba, char idOut[ID_ROWS][ID_COLS + 1]) {
  std::vector<float> gray(SHEET_W * SHEET_H);
  for (int i = 0; i < SHEET_W * SHEET_H; i++) {
    const int j = i * 4;
    gray[i] = rgba[j] * 0.299f + rgba[j + 1] * 0.587f + rgba[j + 2] * 0.114f;
  }

  const int xStart = 70;
  const int yStart = ID_START + 10;

  for (int row = 0; row < ID_ROWS; row++) {
    std::memset(idOut[row], '0', ID_COLS);
    idOut[row][ID_COLS] = '\0';
    for (int col = 0; col < ID_COLS; col++) {
      const int cx = xStart + col * 28;
      const int cy = yStart + row * 28;
      const int r = 6;
      int dark = 0, total = 0;
      for (int dy = -r; dy <= r; dy++) {
        for (int dx = -r; dx <= r; dx++) {
          const int px = cx + dx, py = cy + dy;
          if (px >= 0 && px < SHEET_W && py >= 0 && py < SHEET_H) {
            total++;
            if (gray[py * SHEET_W + px] < 128) dark++;
          }
        }
      }
      if (total > 0 && (float)dark / total > 0.12f) {
        idOut[row][col] = '1';
      }
    }
  }
}

void applyRotation(const std::vector<uint8_t>& in, int w, int h, int rotation,
                   std::vector<uint8_t>& out, int& outW, int& outH) {
  rotation = ((rotation % 360) + 360) % 360;
  if (rotation == 0) {
    out = in;
    outW = w;
    outH = h;
    return;
  }
  if (rotation == 90) {
    outW = h;
    outH = w;
    out.resize(outW * outH);
    for (int y = 0; y < h; y++) {
      for (int x = 0; x < w; x++) {
        out[x * outH + (outH - 1 - y)] = in[y * w + x];
      }
    }
    return;
  }
  if (rotation == 180) {
    outW = w;
    outH = h;
    out.resize(w * h);
    for (int i = 0; i < w * h; i++) out[i] = in[w * h - 1 - i];
    return;
  }
  // 270
  outW = h;
  outH = w;
  out.resize(outW * outH);
  for (int y = 0; y < h; y++) {
    for (int x = 0; x < w; x++) {
      out[(outW - 1 - x) * outH + y] = in[y * w + x];
    }
  }
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
  for (int i = 0; i < OMR_NUM_QUESTIONS; i++) out->answers[i] = -1;

  std::vector<uint8_t> yPlane(width * height);
  std::memcpy(yPlane.data(), yuv_nv21, width * height);

  std::vector<uint8_t> rotated;
  int rw = width, rh = height;
  applyRotation(yPlane, width, height, rotation, rotated, rw, rh);

  Point2f corners[4];
  out->found = findCorners(rotated.data(), rw, rh, corners) ? 1 : 0;
  for (int i = 0; i < 4; i++) {
    out->corners_x[i] = corners[i].x;
    out->corners_y[i] = corners[i].y;
  }

  if (!do_grade || !out->found) return;

  std::vector<uint8_t> nv21Rotated;
  if (rotation == 0) {
    nv21Rotated.assign(yuv_nv21, yuv_nv21 + width * height * 3 / 2);
  } else {
    // Reconstruir NV21 rotado solo con plano Y para warp aproximado
    nv21Rotated.resize(rw * rh * 3 / 2);
    std::memcpy(nv21Rotated.data(), rotated.data(), rw * rh);
    std::memset(nv21Rotated.data() + rw * rh, 128, rw * rh / 2);
  }

  std::vector<uint8_t> rgba;
  nv21ToRgba(nv21Rotated.data(), rw, rh, rgba);

  std::vector<uint8_t> warped;
  if (!warpPerspective(rgba, rw, rh, corners, warped)) return;

  gradeBubbles(warped, out->answers);
  readStudentId(warped, out->student_id);
  out->graded = 1;
}
