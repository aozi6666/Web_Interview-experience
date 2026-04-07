/**
 * RTC 服务凭据集中管理
 * ASR 与 TTS 使用不同的 AppId/Token，务必区分
 */

export const RTC_CREDENTIALS = {
  rtc: {
    appId: '694226ef7425870173c9fa42',
  },
  server: {
    apiUrl: 'https://service-api.fancytech.online/ai-proxy',
  },
  asr: {
    appId: '9934702733',
    accessToken: 'WIG86BTrlHUsfx5pZefYgkGXCwtb44mV',
    apiResourceId: 'volc.bigasr.sauc.duration',
  },
  tts: {
    appId: '5576283710',
    token: 'oulStLb28Fj2Z8HWtKeZgO56p-ByDuvT',
  },
  llm: {
    endPointId: 'ep-20251223145959-tdvd5',
  },
};
