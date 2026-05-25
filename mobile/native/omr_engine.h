#ifndef OMR_ENGINE_H
#define OMR_ENGINE_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define OMR_NUM_QUESTIONS 20
#define OMR_NUM_OPTIONS 5
#define OMR_ID_ROWS 3
#define OMR_ID_COLS 10

typedef struct {
  int found;
  float corners_x[4];
  float corners_y[4];
  int graded;
  int answers[OMR_NUM_QUESTIONS];
  char student_id[OMR_ID_ROWS][OMR_ID_COLS + 1];
} OmrResult;

void omr_process_frame(
    const uint8_t* yuv_nv21,
    int width,
    int height,
    int rotation,
    int do_grade,
    OmrResult* out);

#ifdef __cplusplus
}
#endif

#endif
