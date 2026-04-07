#pragma once
#include <stdint.h>
#if defined(_WIN32)
  #if defined(GPW_BUILD_DLL)
    #define GPWW_API __declspec(dllexport)
  #else
    #define GPWW_API __declspec(dllimport)
  #endif
  #define GPWW_CALL __stdcall
#else
  #define GPWW_API __attribute__((visibility("default")))
  #define GPWW_CALL
#endif
#ifdef __cplusplus
extern "C" {
#endif
typedef enum { GPWW_OK=0, GPWW_ERR_GENERIC=-1, GPWW_ERR_INVALID_ARG=-2, GPWW_ERR_NOMEM=-3, GPWW_ERR_STATE=-4, GPWW_ERR_NOTFOUND=-5 } gpww_status;
GPWW_API gpww_status GPWW_CALL gpwWeb_Process(const char* image_path,const char* json_params,char** out_b64_png,int* out_len,int* out_w,int* out_h);
GPWW_API gpww_status GPWW_CALL gpwWeb_Create(const char* image_path,const char* json_params,uint64_t* out_session);
GPWW_API gpww_status GPWW_CALL gpwWeb_Update(uint64_t session,const char* json_params);
GPWW_API gpww_status GPWW_CALL gpwWeb_Render(uint64_t session,char** out_b64_png,int* out_len,int* out_w,int* out_h);
GPWW_API void        GPWW_CALL gpwWeb_Destroy(uint64_t session);
GPWW_API void        GPWW_CALL gpwWeb_Free(void* p);
GPWW_API gpww_status GPWW_CALL gpwWeb_SetResourcePath(const char* dir_utf8);
GPWW_API const char* GPWW_CALL gpwWeb_GetLastError(void);
#ifdef __cplusplus
}
#endif
