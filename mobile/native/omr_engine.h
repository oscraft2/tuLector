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

/* Codigos alineados con src/lib/scanner_config.ts / omr_reference.json */
#define OMR_CODE_GRADED 1
#define OMR_CODE_BRIGHT 5
#define OMR_CODE_CURVE_FAIL 10
#define OMR_CODE_WRONG_FORMAT 30
#define OMR_CODE_ALIGN_START 100
#define OMR_CODE_OUT_OF_FOCUS 1001

typedef struct {
  int32_t found;
  int32_t result_code;
  float corners_x[4];
  float corners_y[4];
  int32_t graded;
  int32_t valid;
  int32_t answers[OMR_NUM_QUESTIONS];
  char answer_text[OMR_NUM_QUESTIONS][8];
  char student_id[OMR_ID_ROWS][OMR_ID_COLS + 1];
  char reason[160];
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
