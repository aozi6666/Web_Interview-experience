export enum AnalyticsEvent {
  // ==================== 壁纸相关事件 ====================
  /** 设为壁纸：用户点击"设为壁纸"按钮并成功应用壁纸 */
  WALLPAPER_SET = 'wallpaper_set',

  /** 点击壁纸：用户点击壁纸卡片查看详情 */
  WALLPAPER_CLICK = 'wallpaper_click',

  /** 壁纸启动：WallpaperBaby动态壁纸启动 */
  WALLPAPER_START = 'wallpaper_start',

  /** 壁纸菜单点击：用户点击壁纸右上角三个点菜单时记录 */
  WALLPAPER_MENU_CLICK = 'Wallpaper_menu_click',

  /** 壁纸预览点击：用户点击预览按钮 */
  WALLPAPER_PREVIEW_CLICK = 'Wallpaper_preview_click',

  /** 壁纸下载点击：用户点击下载资源按钮 */
  WALLPAPER_DOWNLOAD_CLICK = 'Wallpaper_download_click',

  /** 壁纸翻页点击：用户点击翻页按钮 */
  WALLPAPER_PAGE_TURN_CLICK = 'Wallpaper_page_turn_click',

  /** 推荐、我的壁纸、我的角色页：点击对话静音按钮 */
  CHAT_EMBED_VOICE_MUTE_CLICK = 'Chat_embed_voice_mute_click',

  /** 推荐、我的壁纸、我的角色页：点击挂断语音通话按钮 */
  CHAT_EMBED_VOICE_CHAT_END_CLICK = 'Chat_embed_voice_chat_end_click',

  /** 推荐、我的壁纸、我的角色页：点击麦克风静音按钮 */
  CHAT_EMBED_MIC_MUTE_CLICK = 'Chat_embed_mic_mute_click',

  /** 推荐、我的壁纸、我的角色页：点击切换打字语音聊天模式按钮 */
  CHAT_EMBED_MODE_SWITCH_CLICK = 'Chat_embed_mode_switch_click',

  /** 推荐、我的壁纸、我的角色页：点击按住开启对话按钮 */
  CHAT_EMBED_VOICE_RECORD_CLICK = 'Chat_embed_voice_record_click',

  /** 推荐、我的壁纸、我的角色页：点击文本输入框 */
  CHAT_EMBED_TEXT_INPUT_CLICK = 'Chat_embed_text_input_click',

  /** 推荐、我的壁纸、我的角色页：点击发送文本按钮 */
  CHAT_EMBED_CHAT_SEND_CLICK = 'Chat_embed_chat_send_click',

  /** 推荐、我的壁纸、我的角色页：点击语音通话按钮 */
  CHAT_EMBED_VOICE_CHAT_START_CLICK = 'Chat_embed_voice_chat_start_click',

  /** 聊天页：点击对话静音按钮 */
  CHAT_BIG_VOICE_MUTE_CLICK = 'Chat_big_voice_mute_click',

  /** 聊天页：点击挂断语音通话按钮 */
  CHAT_BIG_VOICE_CHAT_END_CLICK = 'Chat_big_voice_chat_end_click',

  /** 聊天页：点击麦克风静音按钮 */
  CHAT_BIG_MIC_MUTE_CLICK = 'Chat_big_mic_mute_click',

  /** 聊天页：点击切换打字语音聊天模式按钮 */
  CHAT_BIG_MODE_SWITCH_CLICK = 'Chat_big_mode_switch_click',

  /** 聊天页：点击按住开启对话按钮 */
  CHAT_BIG_VOICE_RECORD_CLICK = 'Chat_big_voice_record_click',

  /** 聊天页：点击文本输入框 */
  CHAT_BIG_TEXT_INPUT_CLICK = 'Chat_big_text_input_click',

  /** 聊天页：点击发送文本按钮 */
  CHAT_BIG_CHAT_SEND_CLICK = 'Chat_big_chat_send_click',

  /** 聊天页：点击语音通话按钮 */
  CHAT_BIG_VOICE_CHAT_START_CLICK = 'Chat_big_voice_chat_start_click',

  /** 聊天小窗：点击对话静音按钮 */
  CHAT_SMALL_VOICE_MUTE_CLICK = 'Chat_small_voice_mute_click',

  /** 聊天小窗：点击挂断语音通话按钮 */
  CHAT_SMALL_VOICE_CHAT_END_CLICK = 'Chat_small_voice_chat_end_click',

  /** 聊天小窗：点击麦克风静音按钮 */
  CHAT_SMALL_MIC_MUTE_CLICK = 'Chat_small_mic_mute_click',

  /** 聊天小窗：点击切换打字语音聊天模式按钮 */
  CHAT_SMALL_MODE_SWITCH_CLICK = 'Chat_small_mode_switch_click',

  /** 聊天小窗：点击按住开启对话按钮 */
  CHAT_SMALL_VOICE_RECORD_CLICK = 'Chat_small_voice_record_click',

  /** 聊天小窗：点击文本输入框 */
  CHAT_SMALL_TEXT_INPUT_CLICK = 'Chat_small_text_input_click',

  /** 聊天小窗：点击发送文本按钮 */
  CHAT_SMALL_CHAT_SEND_CLICK = 'Chat_small_chat_send_click',

  /** 聊天小窗：点击语音通话按钮 */
  CHAT_SMALL_VOICE_CHAT_START_CLICK = 'Chat_small_voice_chat_start_click',

  // ==================== 壁纸交互相关事件 ====================
  /** 语音录音开始：用户开始语音录音（按下录音按钮） */
  WALLPAPER_VOICE_RECORD_START = 'wallpaper_voice_record_start',

  /** 语音录音发送：用户发送语音录音消息 */
  WALLPAPER_VOICE_RECORD_SEND = 'wallpaper_voice_record_send',

  /** 实时语音对话：用户完成语音对话，AI返回回复 */
  WALLPAPER_VOICE_CHAT = 'wallpaper_voice_chat',

  /** 壁纸文字聊天：用户发送文字消息给AI角色 */
  WALLPAPER_CHAT_SEND = 'wallpaper_chat_send',

  /** 点击角色部位：用户点击UE中角色的某个身体部位 */
  WALLPAPER_BODY_PART_CLICK = 'wallpaper_body_part_click',

  // ==================== 角色生成相关事件 ====================
  /** PC端上传照片：用户通过PC端上传照片用于生成角色 */
  PHOTO_UPLOAD_PC = 'photo_upload_pc',

  /** 手机端上传照片：用户通过手机端上传照片用于生成角色 */
  PHOTO_UPLOAD_PHONE = 'photo_upload_phone',

  /** 自动补全照片：用户使用自动补全功能补充照片 */
  AUTO_COMPLETE_PHOTO = 'auto_complete_photo',

  /** 角色生成：用户开始生成角色 */
  CHARACTER_GENERATE = 'character_generate',

  /** 删除角色：用户删除角色 */
  DELECT_CHARACTER = 'delect_character',

  /** 创建角色入口-角色库：用户在角色库页面点击创建角色 */
  CREAT_ENTRY_LIB = 'creat_entry_lib',

  /** 创建角色入口-侧边栏：用户通过侧边栏点击创建角色 */
  CREAT_ENTRY_TAB = 'creat_entry_tab',

  /** 上传照片页：点击更多选择照片技巧按钮 */
  CREATE_PHOTO_UPLOAD_TIPS_CLICK = 'Create_photo_upload_tips_click',

  /** 上传照片：点击添加按钮 */
  CREATE_PHOTO_UPLOAD_ADD_CLICK = 'Create_photo_upload_add_click',

  /** 上传照片：点击移动设备上传按钮 */
  CREATE_PHOTO_UPLOAD_MOBILE_CLICK = 'Create_photo_upload_mobile_click',

  /** 上传照片：点击删除按钮 */
  CREATE_PHOTO_UPLOAD_ICON_DELETE_CLICK = 'Create_photo_upload_icon_delete_click',

  /** 上传照片：点击照片图标打开预览 */
  CREATE_PHOTO_UPLOAD_ICON_CLICK = 'Create_photo_upload_icon_click',

  /** 上传照片：点击男按钮 */
  CREATE_PHOTO_UPLOAD_MALE_CLICK = 'Create_photo_upload_male_click',

  /** 上传照片：点击女按钮 */
  CREATE_PHOTO_UPLOAD_FEMALE_CLICK = 'Create_photo_upload_female_click',

  /** 预览照片：点击删除按钮 */
  CREATE_PHOTO_PREVIEW_DELETE_CLICK = 'Create_photo_preview_delete_click',

  /** 预览照片：点击关闭按钮 */
  CREATE_PHOTO_PREVIEW_CLOSE_CLICK = 'Create_photo_preview_close_click',

  /** 预览照片：点击左翻页按钮 */
  CREATE_PHOTO_UPLOAD_PREVIEW_LEFT_CLICK = 'Create_photo_upload_preview_left_click',

  /** 预览照片：点击右翻页按钮 */
  CREATE_PHOTO_UPLOAD_PREVIEW_RIGHT_CLICK = 'Create_photo_upload_preview_right_click',

  /** 更多技巧弹窗：点击知道了按钮 */
  CREATE_TIPS_CLOSE_CLICK = 'Create_tips_close_click',

  /** 生成过程：点击右上角后台生成按钮 */
  CREATE_IN_BACKGROUND_CLICK = 'Create_in_background_click',

  // ==================== 角色预览相关事件 ====================
  /** 静态预览关闭：用户在静态预览阶段关闭预览窗口 */
  STATIC_PREVIEW_CLOSE = 'static_preview_close',

  /** 动态预览关闭：用户在动态预览阶段关闭预览窗口 */
  DYNAMIC_PREVIEW_CLOSE = 'dynamic_preview_close',

  /** 动态预览确定：用户在动态预览阶段点击确定按钮 */
  DYNAMIC_PREVIEW_CONFIRM = 'dynamic_preview_confirm',

  /** 动态预览装扮：用户在动态预览阶段进行装扮操作 */
  DYNAMIC_PREVIEW_DRESS_UP = 'dynamic_preview_dress_up',

  /** 静态预览重新生成：用户在静态预览阶段点击重新生成按钮 */
  STATIC_PREVIEW_RETRY = 'static_preview_retry',

  /** 静态预览下一步：用户在静态预览阶段点击下一步按钮 */
  STATIC_PREVIEW_NEXT = 'static_preview_next',

  // ==================== 应用功能相关事件 ====================
  /** 菜单点击：用户点击导航栏菜单项 */
  MENU_CLICK = 'menu_click',

  /** 页面浏览：用户浏览页面时触发 */
  PAGE_VIEW = 'page_view',

  /** 应用启动：应用程序启动时触发 */
  APP_LAUNCH = 'app_launch',

  /** 退出应用：用户退出应用程序 */
  APP_QUIT = 'app_quit',

  /** 退出登录：用户退出登录 */
  LOGOUT = 'logout',

  // ==================== 登录相关事件 ====================
  /** 邮箱登录：用户使用邮箱登录 */
  EMAIL_LOGIN = 'email_login',

  /** 手机登录：用户使用手机号登录 */
  PHONE_LOGIN = 'phone_login',

  /** 用户注册：新用户首次注册成功 */
  USER_REGISTER = 'user_register',

  /** 用户登录：老用户登录成功 */
  USER_LOGIN = 'user_login',

  /** 邮箱验证码发送：用户点击发送邮箱验证码按钮 */
  EMAIL_VERIFICATION_CODE_SEND = 'email_verification_code_send',

  /** 手机验证码发送：用户点击发送手机验证码按钮 */
  PHONE_VERIFICATION_CODE_SEND = 'phone_verification_code_send',

  /** 账号输入框点击：用户点击账号输入框时记录设备信息 */
  ACCOUNT_INPUT_CLICK = 'Account_input_click',

  /** 密码输入框点击：用户点击密码/验证码输入框时记录 */
  PASSWORD_INPUT_CLICK = 'Password_input_click',

  /** 邀请码输入框点击：用户点击邀请码输入框时记录 */
  INVITATION_INPUT_CLICK = 'Invitation_input_click',

  /** 检查更新：用户点击检查更新按钮时记录 */
  UPDATE_CHECK = 'Update_check',

  // ==================== 角色记忆相关事件 ====================
  /** 重置记忆：用户重置AI角色的记忆 */
  MEMORY_RESET = 'memory_reset',

  /** 查看记忆：用户查看AI角色的记忆 */
  MEMORY_VIEW = 'memory_view',

  // ==================== 外观设置相关事件 ====================
  /** 化妆捏脸保存：用户保存化妆捏脸设置 */
  APPEARANCE_SAVE = 'appearance_save',

  /** 重置外貌：用户在装扮页面点击重置外貌按钮 */
  WALLPAPER_RESET = 'wallpaper_reset',

  /** 装扮页：点击对照模式按钮 */
  APPEARANCE_COMPARE_CLICK = 'Appearance_compare_click',
  /** 装扮页：点击恢复至保存按钮 */
  APPEARANCE_RESET_TO_LAST_SAVE_CLICK = 'Appearance_reset_to_last_save_click',
  /** 装扮页：点击重置外貌按钮 */
  APPEARANCE_RESET_CLICK = 'Appearance_reset_click',
  /** 装扮页：点击阴影淡化按钮 */
  APPEARANCE_SHADOW_FADE_CLICK = 'Appearance_shadow_fade_click',
  /** 装扮页：点击切换灯光按钮 */
  APPEARANCE_SWITCH_LIGHT_CLICK = 'Appearance_switch_light_click',
  /** 装扮页：点击返回按钮 */
  APPEARANCE_BACK_BUTTON_CLICK = 'Appearance_back_button_click',
  /** 装扮页：点击妆容按钮 */
  APPEARANCE_MAKEUP_CLICK = 'Appearance_makeup_click',
  /** 装扮页：点击捏脸按钮 */
  APPEARANCE_FACE_ADJUST_CLICK = 'Appearance_face_adjust_click',
  /** 装扮页：点击发型按钮 */
  APPEARANCE_HAIR_CLICK = 'Appearance_hair_click',
  /** 装扮页：点击眼镜按钮 */
  APPEARANCE_GLASSES_CLICK = 'Appearance_glasses_click',
  /** 装扮页：点击服装按钮 */
  APPEARANCE_CLOTHING_CLICK = 'Appearance_clothing_click',
  /** 装扮页：点击全妆按钮 */
  APPEARANCE_FULL_MAKEUP_CLICK = 'Appearance_full_makeup_click',
  /** 装扮页：点击底妆按钮 */
  APPEARANCE_BASE_MAKEUP_CLICK = 'Appearance_base_makeup_click',
  /** 装扮页：点击肤色按钮 */
  APPEARANCE_SKIN_COLOR_CLICK = 'Appearance_skin_color_click',
  /** 装扮页：点击修容按钮 */
  APPEARANCE_CONTOUR_CLICK = 'Appearance_contour_click',
  /** 装扮页：点击睫毛按钮 */
  APPEARANCE_EYELASHES_CLICK = 'Appearance_eyelashes_click',
  /** 装扮页：点击眼部按钮 */
  APPEARANCE_EYE_CLICK = 'Appearance_eye_click',
  /** 装扮页：点击眼妆按钮 */
  APPEARANCE_EYE_MAKEUP_CLICK = 'Appearance_eye_makeup_click',
  /** 装扮页：点击眼线按钮 */
  APPEARANCE_EYELINER_CLICK = 'Appearance_eyeliner_click',
  /** 装扮页：点击唇妆按钮 */
  APPEARANCE_LIP_MAKEUP_CLICK = 'Appearance_lip_makeup_click',
  /** 装扮页：点击腮红按钮 */
  APPEARANCE_BLUSH_CLICK = 'Appearance_blush_click',
  /** 装扮页：点击脸型按钮 */
  APPEARANCE_FACE_SHAPE_CLICK = 'Appearance_face_shape_click',
  /** 装扮页：点击额头按钮 */
  APPEARANCE_FOREHEAD_CLICK = 'Appearance_forehead_click',
  /** 装扮页：点击颧骨按钮 */
  APPEARANCE_CHEEKBONE_CLICK = 'Appearance_cheekbone_click',
  /** 装扮页：点击下颌按钮 */
  APPEARANCE_JAW_CLICK = 'Appearance_jaw_click',
  /** 装扮页：点击下巴按钮 */
  APPEARANCE_CHIN_CLICK = 'Appearance_chin_click',
  /** 装扮页：点击双下巴按钮 */
  APPEARANCE_DOUBLE_CHIN_CLICK = 'Appearance_double_chin_click',
  /** 装扮页：点击眼睛按钮 */
  APPEARANCE_EYEBALL_CLICK = 'Appearance_eyeball_click',
  /** 装扮页：点击鼻子按钮 */
  APPEARANCE_NOSE_CLICK = 'Appearance_nose_click',
  /** 装扮页：点击鼻子整体按钮 */
  APPEARANCE_NOSE_OVERALL_CLICK = 'Appearance_nose_overall_click',
  /** 装扮页：点击山根按钮 */
  APPEARANCE_NOSE_TOP_BRIDGE_CLICK = 'Appearance_nose_top_bridge_click',
  /** 装扮页：点击鼻梁按钮 */
  APPEARANCE_NOSE_BOTTOM_BRIDGE_CLICK = 'Appearance_nose_bottom_bridge_click',
  /** 装扮页：点击鼻头按钮 */
  APPEARANCE_NOSE_TIP_CLICK = 'Appearance_nose_tip_click',
  /** 装扮页：点击鼻底按钮 */
  APPEARANCE_NOSE_BASE_CLICK = 'Appearance_nose_base_click',
  /** 装扮页：点击鼻翼按钮 */
  APPEARANCE_NOSE_EDGE_CLICK = 'Appearance_nose_edge_click',
  /** 装扮页：点击鼻孔按钮 */
  APPEARANCE_NOSE_HOLES_CLICK = 'Appearance_nose_holes_click',
  /** 装扮页：点击嘴巴按钮 */
  APPEARANCE_MOUTH_CLICK = 'Appearance_mouth_click',
  /** 装扮页：点击耳朵按钮 */
  APPEARANCE_EAR_CLICK = 'Appearance_ear_click',

  /** 修改角色名称：用户重命名角色 */
  CHANGE_CHARACTER_NAME = 'change_character_name',

  // ==================== 我的角色页埋点 ====================
  /** 点击创建角色按钮 */
  MY_ROLES_CREAT_CLICK = 'My_roles_creat_click',
  /** 点击顶部所有按钮 */
  MY_ROLES_ALL_CLICK = 'My_roles_all_click',
  /** 点击顶部男按钮 */
  MY_ROLES_MALE_CLICK = 'My_roles_male_click',
  /** 点击顶部女按钮 */
  MY_ROLES_FEMALE_CLICK = 'My_roles_female_click',
  /** 点击角色卡片右上角三个点菜单 */
  MY_ROLES_MENU_CLICK = 'My_roles_menu_click',
  /** 点击角色图预览按钮 */
  MY_ROLES_PREVIEW_CLICK = 'My_roles_preview_click',
  /** 点击重新下载按钮 */
  MY_ROLES_REDOWNLOAD_CLICK = 'My_roles_redownload_click',
  /** 点击删除按钮 */
  MY_ROLES_DELETE_CLICK = 'My_roles_delete_click',
  /** 点击重命名按钮（菜单内） */
  MY_ROLES_ICON_PREVIEW_CLICK = 'My_roles_icon_preview_click',
  /** 点击重命名角色的文本框 */
  MY_ROLES_RENAME_CLICK = 'My_roles_rename_click',
  /** 重命名角色，点击取消按钮 */
  MY_ROLES_RENAME_CANCLE_CLICK = 'My_roles_rename_cancle_click',
  /** 重命名角色，点击确定按钮 */
  MY_ROLES_RENAME_CONFIRM_CLICK = 'My_roles_rename_confirm_click',
  /** 点击更换角色按钮 */
  MY_ROLES_CHANGE_CHARACTER_CLICK = 'My_roles_change_character_click',
  /** 点击装扮按钮 */
  MY_ROLES_APPEARANCE_CLICK = 'My_roles_appearance_click',
  /** 后台生成中的角色，点击预览按钮 */
  MY_ROLES_STATIC_PREVIEW_CLICK = 'My_roles_static_preview_click',
  /** 后台生成中的角色，点击下一步按钮 */
  MY_ROLES_NEXT_STEP_CLICK = 'My_roles_next_step_click',
  /** 点击翻页按钮 */
  MY_ROLES_PAGE_TURN_CLICK = 'My_roles_page_turn_click',
  /** 点击没有资源的角色的下载按钮 */
  MY_ROLES_DOWNLOAD_CLICK = 'My_roles_download_click',

  /** 点击我的壁纸按钮 */
  SIDEBAR_MY_WALLPAPER_CLICK = 'Sidebar_my_wallpaper_click',
  /** 点击我的角色按钮 */
  SIDEBAR_MY_ROLES_CLICK = 'Sidebar_my_roles_click',
  /** 点击侧边栏聊天按钮 */
  SIDEBAR_CHAT_CLICK = 'Sidebar_chat_click',
  /** 侧边栏点击账号按钮 */
  SIDEBAR_ACCOUNT_CLICK = 'Sidebar_account_click',
  /** 顶部最小化按钮点击 */
  UI_TOP_MINIMIZE_CLICK = 'UI_top_minimize_click',
  /** 顶部最大化按钮点击 */
  UI_TOP_MAXIMIZE_CLICK = 'UI_top_maxmize_click',
  /** 顶部关闭按钮点击 */
  UI_TOP_CLOSE_CLICK = 'UI_top_close_click',

  /** 系统托盘静音：用户在系统托盘点击静音按钮 */
  TRAY_MUTE = 'tray_mute',

  /** 系统托盘菜单：用户在系统托盘点击打开主页面 */
  TRAY_MENU = 'tray_menu',

  /** 系统托盘聊天窗口：用户在系统托盘点击打开聊天窗口 */
  TRAY_CHAT_WINDOW = 'tray_chat_window',

  /** 托盘icon右键菜单点击对话静音按钮 */
  TRAY_VOICE_MUTE_CLICK = 'Tray_voice_mute_click',
  /** 托盘icon右键菜单点击取消对话静音按钮 */
  TRAY_VOICE_UNMUTE_CLICK = 'Tray_voice_ummute_click',
  /** 托盘icon右键菜单点击暂停按钮 */
  TRAY_WALLPAPER_STOP_CLICK = 'Tray_wallpaper_stop_click',
  /** 托盘icon右键菜单点击解除暂停按钮 */
  TRAY_WALLPAPER_RESUME_CLICK = 'Tray_wallpaper_resume_click',

  // ==================== 系统设置相关事件 ====================
  /** 开机自启动开关：用户切换开机自启动设置 */
  AUTO_LAUNCH_TOGGLE = 'auto_launch_toggle',

  // ==================== 数据收集相关事件 ====================
  /** 消息收集：收集设备信息等消息 */
  MESSAGE_COLLECT = 'message_collect',
}

export const EVENT_DESCRIPTIONS: Record<string, string> = {
  // ==================== 壁纸相关事件 ====================
  [AnalyticsEvent.WALLPAPER_SET]:
    '设为壁纸：用户点击"设为壁纸"按钮并成功应用壁纸',
  [AnalyticsEvent.WALLPAPER_CLICK]: '点击壁纸：用户点击壁纸卡片查看详情',
  [AnalyticsEvent.WALLPAPER_START]: '壁纸启动：WallpaperBaby动态壁纸启动',
  [AnalyticsEvent.WALLPAPER_MENU_CLICK]:
    '壁纸菜单点击：用户点击壁纸右上角三个点菜单时记录',
  [AnalyticsEvent.WALLPAPER_PREVIEW_CLICK]: '壁纸预览点击：用户点击预览按钮',
  [AnalyticsEvent.WALLPAPER_DOWNLOAD_CLICK]:
    '壁纸下载点击：用户点击下载资源按钮',
  [AnalyticsEvent.WALLPAPER_PAGE_TURN_CLICK]: '壁纸翻页点击：用户点击翻页按钮',
  [AnalyticsEvent.CHAT_EMBED_VOICE_MUTE_CLICK]:
    '推荐、我的壁纸、我的角色页,点击对话静音按钮,记录时间',
  [AnalyticsEvent.CHAT_EMBED_VOICE_CHAT_END_CLICK]:
    '推荐、我的壁纸、我的角色页,点击挂断语音通话按钮,记录时间',
  [AnalyticsEvent.CHAT_EMBED_MIC_MUTE_CLICK]:
    '推荐、我的壁纸、我的角色页,点击麦克风静音按钮,记录时间',
  [AnalyticsEvent.CHAT_EMBED_MODE_SWITCH_CLICK]:
    '推荐、我的壁纸、我的角色页,点击切换打字语音聊天模式按钮,记录时间',
  [AnalyticsEvent.CHAT_EMBED_VOICE_RECORD_CLICK]:
    '推荐、我的壁纸、我的角色页,点击按住开启对话按钮,记录时间',
  [AnalyticsEvent.CHAT_EMBED_TEXT_INPUT_CLICK]:
    '推荐、我的壁纸、我的角色页,点击文本输入框,记录时间',
  [AnalyticsEvent.CHAT_EMBED_CHAT_SEND_CLICK]:
    '推荐、我的壁纸、我的角色页,点击发送文本按钮',
  [AnalyticsEvent.CHAT_EMBED_VOICE_CHAT_START_CLICK]:
    '推荐、我的壁纸、我的角色页,点击语音通话按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_VOICE_MUTE_CLICK]:
    '聊天页,点击对话静音按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_VOICE_CHAT_END_CLICK]:
    '聊天页,点击挂断语音通话按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_MIC_MUTE_CLICK]:
    '聊天页,点击麦克风静音按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_MODE_SWITCH_CLICK]:
    '聊天页,点击切换打字语音聊天模式按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_VOICE_RECORD_CLICK]:
    '聊天页,点击按住开启对话按钮,记录时间',
  [AnalyticsEvent.CHAT_BIG_TEXT_INPUT_CLICK]:
    '聊天页,点击文本输入框,记录时间',
  [AnalyticsEvent.CHAT_BIG_CHAT_SEND_CLICK]: '聊天页,点击发送文本按钮',
  [AnalyticsEvent.CHAT_BIG_VOICE_CHAT_START_CLICK]:
    '聊天页,点击语音通话按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_VOICE_MUTE_CLICK]:
    '聊天小窗,点击对话静音按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_VOICE_CHAT_END_CLICK]:
    '聊天小窗,点击挂断语音通话按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_MIC_MUTE_CLICK]:
    '聊天小窗,点击麦克风静音按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_MODE_SWITCH_CLICK]:
    '聊天小窗,点击切换打字语音聊天模式按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_VOICE_RECORD_CLICK]:
    '聊天小窗,点击按住开启对话按钮,记录时间',
  [AnalyticsEvent.CHAT_SMALL_TEXT_INPUT_CLICK]:
    '聊天小窗,点击文本输入框,记录时间',
  [AnalyticsEvent.CHAT_SMALL_CHAT_SEND_CLICK]: '聊天小窗,点击发送文本按钮',
  [AnalyticsEvent.CHAT_SMALL_VOICE_CHAT_START_CLICK]:
    '聊天小窗,点击语音通话按钮,记录时间',
  // ==================== 壁纸交互相关事件 ====================
  [AnalyticsEvent.WALLPAPER_VOICE_RECORD_START]:
    '语音录音开始：用户开始语音录音（按下录音按钮）',
  [AnalyticsEvent.WALLPAPER_VOICE_RECORD_SEND]:
    '语音录音发送：用户发送语音录音消息',
  [AnalyticsEvent.WALLPAPER_VOICE_CHAT]:
    '实时语音对话：用户完成语音对话，AI返回回复',
  [AnalyticsEvent.WALLPAPER_CHAT_SEND]:
    '壁纸文字聊天：用户发送文字消息给AI角色',
  [AnalyticsEvent.WALLPAPER_BODY_PART_CLICK]:
    '点击角色部位：用户点击UE中角色的某个身体部位',

  // ==================== 角色生成相关事件 ====================
  [AnalyticsEvent.PHOTO_UPLOAD_PC]:
    'PC端上传照片：用户通过PC端上传照片用于生成角色',
  [AnalyticsEvent.PHOTO_UPLOAD_PHONE]:
    '手机端上传照片：用户通过手机端上传照片用于生成角色',
  [AnalyticsEvent.AUTO_COMPLETE_PHOTO]:
    '自动补全照片：用户使用自动补全功能补充照片',
  [AnalyticsEvent.CHARACTER_GENERATE]: '角色生成：用户开始生成角色',
  [AnalyticsEvent.DELECT_CHARACTER]: '删除角色：用户删除角色',
  [AnalyticsEvent.CREAT_ENTRY_LIB]:
    '创建角色入口-角色库：用户在角色库页面点击创建角色',
  [AnalyticsEvent.CREAT_ENTRY_TAB]:
    '创建角色入口-侧边栏：用户通过侧边栏点击创建角色',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_TIPS_CLICK]:
    '上传照片页,点击更多选择照片技巧按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_ADD_CLICK]:
    '上传照片点击添加按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_MOBILE_CLICK]:
    '上传照片点击移动设备上传按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_ICON_DELETE_CLICK]:
    '上传照片点击删除按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_ICON_CLICK]:
    '点击照片图标打开预览,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_MALE_CLICK]:
    '上传照片点击男按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_FEMALE_CLICK]:
    '上传照片点击女按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_PREVIEW_DELETE_CLICK]:
    '预览照片,点击删除按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_PREVIEW_CLOSE_CLICK]:
    '预览照片,点击关闭按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_PREVIEW_LEFT_CLICK]:
    '预览照片,点击左翻页按钮,记录时间',
  [AnalyticsEvent.CREATE_PHOTO_UPLOAD_PREVIEW_RIGHT_CLICK]:
    '预览照片,点击右翻页按钮,记录时间',
  [AnalyticsEvent.CREATE_TIPS_CLOSE_CLICK]:
    '更多技巧弹窗,点击知道了按钮,记录时间',
  [AnalyticsEvent.CREATE_IN_BACKGROUND_CLICK]:
    '生成过程,点击右上角后台生成按钮,记录时间',

  // ==================== 角色预览相关事件 ====================
  [AnalyticsEvent.STATIC_PREVIEW_CLOSE]:
    '静态预览关闭：用户在静态预览阶段关闭预览窗口',
  [AnalyticsEvent.DYNAMIC_PREVIEW_CLOSE]:
    '动态预览关闭：用户在动态预览阶段关闭预览窗口',
  [AnalyticsEvent.DYNAMIC_PREVIEW_CONFIRM]:
    '动态预览确定：用户在动态预览阶段点击确定按钮',
  [AnalyticsEvent.DYNAMIC_PREVIEW_DRESS_UP]:
    '动态预览装扮：用户在动态预览阶段进行装扮操作',
  [AnalyticsEvent.STATIC_PREVIEW_RETRY]:
    '静态预览重新生成：用户在静态预览阶段点击重新生成按钮',
  [AnalyticsEvent.STATIC_PREVIEW_NEXT]:
    '静态预览下一步：用户在静态预览阶段点击下一步按钮',

  // ==================== 应用功能相关事件 ====================
  [AnalyticsEvent.MENU_CLICK]: '菜单点击：用户点击导航栏菜单项',
  [AnalyticsEvent.PAGE_VIEW]: '页面浏览：用户浏览页面时触发',
  [AnalyticsEvent.APP_LAUNCH]: '应用启动：应用程序启动时触发',
  [AnalyticsEvent.APP_QUIT]: '退出应用：用户退出应用程序',
  [AnalyticsEvent.LOGOUT]: '退出登录：用户退出登录',

  // ==================== 登录相关事件 ====================
  [AnalyticsEvent.EMAIL_LOGIN]: '邮箱登录：用户使用邮箱登录',
  [AnalyticsEvent.PHONE_LOGIN]: '手机登录：用户使用手机号登录',
  [AnalyticsEvent.USER_REGISTER]: '用户注册：新用户首次注册成功',
  [AnalyticsEvent.USER_LOGIN]: '用户登录：老用户登录成功',
  [AnalyticsEvent.EMAIL_VERIFICATION_CODE_SEND]:
    '邮箱验证码发送：用户点击发送邮箱验证码按钮',
  [AnalyticsEvent.PHONE_VERIFICATION_CODE_SEND]:
    '手机验证码发送：用户点击发送手机验证码按钮',
  [AnalyticsEvent.ACCOUNT_INPUT_CLICK]:
    '账号输入框点击：用户点击账号输入框时记录设备信息',
  [AnalyticsEvent.PASSWORD_INPUT_CLICK]:
    '密码输入框点击：用户点击密码/验证码输入框时记录',
  [AnalyticsEvent.INVITATION_INPUT_CLICK]:
    '邀请码输入框点击：用户点击邀请码输入框时记录',
  [AnalyticsEvent.UPDATE_CHECK]: '检查更新：用户点击检查更新按钮时记录',

  // ==================== 角色记忆相关事件 ====================
  [AnalyticsEvent.MEMORY_RESET]: '重置记忆：用户重置AI角色的记忆',
  [AnalyticsEvent.MEMORY_VIEW]: '查看记忆：用户查看AI角色的记忆',

  // ==================== 外观设置相关事件 ====================
  [AnalyticsEvent.APPEARANCE_SAVE]: '化妆捏脸保存：用户保存化妆捏脸设置',
  [AnalyticsEvent.WALLPAPER_RESET]: '重置外貌：用户在装扮页面点击重置外貌按钮',
  [AnalyticsEvent.APPEARANCE_COMPARE_CLICK]: '点击对照模式按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_RESET_TO_LAST_SAVE_CLICK]: '点击恢复至保存按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_RESET_CLICK]: '点击重置外貌按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_SHADOW_FADE_CLICK]: '点击阴影淡化按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_SWITCH_LIGHT_CLICK]: '点击切换灯光按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_BACK_BUTTON_CLICK]: '点击返回按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_MAKEUP_CLICK]: '点击妆容按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_FACE_ADJUST_CLICK]: '点击捏脸按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_HAIR_CLICK]: '点击发型按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_GLASSES_CLICK]: '点击眼镜按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_CLOTHING_CLICK]: '点击服装按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_FULL_MAKEUP_CLICK]: '点击全妆按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_BASE_MAKEUP_CLICK]: '点击底妆按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_SKIN_COLOR_CLICK]: '点击肤色按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_CONTOUR_CLICK]: '点击修容按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EYELASHES_CLICK]: '点击睫毛按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EYE_CLICK]: '点击眼部按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EYE_MAKEUP_CLICK]: '点击眼妆按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EYELINER_CLICK]: '点击眼线按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_LIP_MAKEUP_CLICK]: '点击唇妆按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_BLUSH_CLICK]: '点击腮红按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_FACE_SHAPE_CLICK]: '点击脸型按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_FOREHEAD_CLICK]: '点击额头按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_CHEEKBONE_CLICK]: '点击颧骨按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_JAW_CLICK]: '点击下颌按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_CHIN_CLICK]: '点击下巴按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_DOUBLE_CHIN_CLICK]: '点击双下巴按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EYEBALL_CLICK]: '点击眼睛按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_CLICK]: '点击鼻子按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_OVERALL_CLICK]: '点击鼻子整体按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_TOP_BRIDGE_CLICK]: '点击山根按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_BOTTOM_BRIDGE_CLICK]: '点击鼻梁按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_TIP_CLICK]: '点击鼻头按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_BASE_CLICK]: '点击鼻底按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_EDGE_CLICK]: '点击鼻翼按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_NOSE_HOLES_CLICK]: '点击鼻孔按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_MOUTH_CLICK]: '点击嘴巴按钮,记录时间',
  [AnalyticsEvent.APPEARANCE_EAR_CLICK]: '点击耳朵按钮,记录时间',
  [AnalyticsEvent.CHANGE_CHARACTER_NAME]: '修改角色名称：用户重命名角色',

  // ==================== 我的角色页埋点 ====================
  [AnalyticsEvent.MY_ROLES_CREAT_CLICK]: '点击创建角色按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_ALL_CLICK]: '点击顶部所有按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_MALE_CLICK]: '点击顶部男按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_FEMALE_CLICK]: '点击顶部女按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_MENU_CLICK]: '点击右上角菜单按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_PREVIEW_CLICK]: '点击角色图预览按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_REDOWNLOAD_CLICK]:
    '点击重新下载按钮,记录时间,是否下载成功',
  [AnalyticsEvent.MY_ROLES_DELETE_CLICK]: '点击删除按钮,记录时间,是否删除成功',
  [AnalyticsEvent.MY_ROLES_ICON_PREVIEW_CLICK]: '点击重命名按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_RENAME_CLICK]: '点击重命名角色的文本框,记录时间',
  [AnalyticsEvent.MY_ROLES_RENAME_CANCLE_CLICK]:
    '重命名角色,点击取消按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_RENAME_CONFIRM_CLICK]:
    '重命名角色,点击确定按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_CHANGE_CHARACTER_CLICK]:
    '点击更换角色按钮,记录时间,是否更换成功',
  [AnalyticsEvent.MY_ROLES_APPEARANCE_CLICK]:
    '点击装扮按钮,记录时间,角色chunkid,性别',
  [AnalyticsEvent.MY_ROLES_STATIC_PREVIEW_CLICK]:
    '后台生成中的角色,点击预览按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_NEXT_STEP_CLICK]:
    '后台生成中的角色,点击下一步按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_PAGE_TURN_CLICK]: '点击翻页按钮,记录时间',
  [AnalyticsEvent.MY_ROLES_DOWNLOAD_CLICK]:
    '点击没有资源的角色的下载按钮,记录时间,是否下载成功',

  [AnalyticsEvent.SIDEBAR_MY_WALLPAPER_CLICK]: '点击我的壁纸按钮,记录时间',
  [AnalyticsEvent.SIDEBAR_MY_ROLES_CLICK]: '点击我的角色按钮,记录时间',
  [AnalyticsEvent.SIDEBAR_CHAT_CLICK]: '点击侧边栏聊天按钮,记录时间',
  [AnalyticsEvent.SIDEBAR_ACCOUNT_CLICK]: '侧边栏点击账号按钮,记录时间',
  [AnalyticsEvent.UI_TOP_MINIMIZE_CLICK]: '顶部最小化按钮点击,记录时间',
  [AnalyticsEvent.UI_TOP_MAXIMIZE_CLICK]: '顶部最大化按钮点击,记录时间',
  [AnalyticsEvent.UI_TOP_CLOSE_CLICK]: '顶部关闭按钮点击,记录时间',

  [AnalyticsEvent.TRAY_MUTE]: '系统托盘静音：用户在系统托盘点击静音按钮',
  [AnalyticsEvent.TRAY_MENU]: '系统托盘菜单：用户在系统托盘点击打开主页面',
  [AnalyticsEvent.TRAY_CHAT_WINDOW]:
    '系统托盘聊天窗口：用户在系统托盘点击打开聊天窗口',
  [AnalyticsEvent.TRAY_VOICE_MUTE_CLICK]:
    '托盘icon右键菜单点击对话静音按钮,记录时间',
  [AnalyticsEvent.TRAY_VOICE_UNMUTE_CLICK]:
    '托盘icon右键菜单点击取消对话静音按钮,记录时间',
  [AnalyticsEvent.TRAY_WALLPAPER_STOP_CLICK]:
    '托盘icon右键菜单点击暂停按钮,记录时间',
  [AnalyticsEvent.TRAY_WALLPAPER_RESUME_CLICK]:
    '托盘icon右键菜单点击解除暂停按钮,记录时间',

  // ==================== 系统设置相关事件 ====================
  [AnalyticsEvent.AUTO_LAUNCH_TOGGLE]: '开机自启动开关：用户切换开机自启动设置',

  // ==================== 数据收集相关事件 ====================
  [AnalyticsEvent.MESSAGE_COLLECT]: '消息收集：收集设备信息等消息',
};

// 统一事件定义，后续新事件请优先在这里消费，避免调用方维护多份映射。
export const EVENT_DEFINITIONS: Record<
  string,
  { name: string; description: string }
> = Object.values(AnalyticsEvent).reduce(
  (acc, name) => {
    acc[name] = {
      name,
      description: EVENT_DESCRIPTIONS[name] || `事件：${name}`,
    };
    return acc;
  },
  {} as Record<string, { name: string; description: string }>,
);
