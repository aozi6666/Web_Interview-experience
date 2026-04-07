import { AltXShortcutListener } from './AltXShortcutListener';
import { AppearanceButtonClickListener } from './AppearanceButtonClickListener';
import { BodyPartClickListener } from './BodyPartClickListener';
import BGMAudioListener from './BGMAudioListener';
import { CharacterSwitchManager } from './CharacterSwitchManager';
import { CommentMessageListener } from './CommentMessageListener';
import { GenerateFaceMessageListener } from './GenerateFaceMessageListener';
import { IpcAnalyticsListener } from './IpcAnalyticsListener';
import { LoginMessageListener } from './LoginMessageListener';
import { RecordingCallbackListener } from './RecordingCallbackListener';
import RequestChatModeListener from './RequestChatModeListener';
import { UEAppearanceListener } from './UEAppearanceListener';
import UETextMessageListener from './UETextMessageListener';
import WallpaperConfigListener from './WallpaperConfigListener';

export function CommonListener() {
  return (
    <>
      <LoginMessageListener />
      <CommentMessageListener />
      <GenerateFaceMessageListener />
      <UEAppearanceListener />
      <UETextMessageListener />
      <RequestChatModeListener />
      <IpcAnalyticsListener />
      <CharacterSwitchManager />
      <BodyPartClickListener />
      <AppearanceButtonClickListener />
      <WallpaperConfigListener />
      <BGMAudioListener />
      <AltXShortcutListener />
      <RecordingCallbackListener />
    </>
  );
}

export default CommonListener;
