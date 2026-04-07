import SiderIcon from '../SiderIcon';
// 导入SVG图标
import MyAssetsIcon from '$assets/icons/Sider/MyAsset.svg';
import MyAssetsLightIcon from '$assets/icons/Sider/MyAsset_light.svg';
import CharacterIcon from '$assets/icons/Sider/character.svg';
import CharacterLightIcon from '$assets/icons/Sider/character_light.svg';
import ChatIcon from '$assets/icons/Sider/chat.svg';
import ChatLightIcon from '$assets/icons/Sider/chat_light.svg';
import CreationCenterIcon from '$assets/icons/Sider/cretioncenter.svg';
import CreationCenterLightIcon from '$assets/icons/Sider/cretioncenter_light.svg';
import HomeIcon from '$assets/icons/Sider/home.svg';
import HomeLightIcon from '$assets/icons/Sider/home_light.svg';
import SettingIcon from '$assets/icons/Sider/setting.svg';
import SettingLightIcon from '$assets/icons/Sider/setting_light.svg';
import MyUserIcon from '$assets/icons/Sider/user.svg';
import MyUserLightIcon from '$assets/icons/Sider/user_active.svg';
import CreateCharacterIcon from '$assets/icons/Sider/users.svg';
import CreateCharacterLightIcon from '$assets/icons/Sider/users_active.svg';

// 创作图标（星形图标）
const CreationIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z"
      fill="currentColor"
    />
    <path
      d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z"
      fill="currentColor"
      opacity="0.5"
    />
  </svg>
);

const CreationLightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L13.09 8.26L19 9L13.09 9.74L12 16L10.91 9.74L5 9L10.91 8.26L12 2Z"
      fill="currentColor"
    />
  </svg>
);

// const MyAssetsIcon = () => (
//   <svg
//     width="20"
//     height="20"
//     viewBox="0 0 24 24"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//   >
//     <path
//       d="M9.75 20.7467L11.223 21.565C11.5066 21.7225 11.6484 21.8013 11.7986 21.8322C11.9315 21.8595 12.0685 21.8595 12.2015 21.8322C12.3516 21.8013 12.4934 21.7225 12.777 21.565L14.25 20.7467M5.25 18.2467L3.82297 17.4539C3.52346 17.2875 3.37368 17.2043 3.26463 17.0859C3.16816 16.9812 3.09515 16.8572 3.05048 16.722C3 16.5692 3 16.3979 3 16.0552V14.4967M3 9.49667V7.93811C3 7.59547 3 7.42415 3.05048 7.27135C3.09515 7.13617 3.16816 7.01209 3.26463 6.9074C3.37368 6.78907 3.52345 6.70586 3.82297 6.53946L5.25 5.74667M9.75 3.24667L11.223 2.42835C11.5066 2.27079 11.6484 2.19201 11.7986 2.16113C11.9315 2.13379 12.0685 2.13379 12.2015 2.16113C12.3516 2.19201 12.4934 2.27079 12.777 2.42835L14.25 3.24667M18.75 5.74667L20.177 6.53946C20.4766 6.70586 20.6263 6.78906 20.7354 6.9074C20.8318 7.01209 20.9049 7.13617 20.9495 7.27135C21 7.42415 21 7.59547 21 7.93811V9.49667M21 14.4967V16.0552C21 16.3979 21 16.5692 20.9495 16.722C20.9049 16.8572 20.8318 16.9812 20.7354 17.0859C20.6263 17.2043 20.4766 17.2875 20.177 17.4539L18.75 18.2467M9.75 10.7467L12 11.9967M12 11.9967L14.25 10.7467M12 11.9967V14.4967M3 6.99667L5.25 8.24667M18.75 8.24667L21 6.99667M12 19.4967V21.9967"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     />
//   </svg>
// );

// const MyAssetsLightIcon = () => (
//   <svg
//     width="20"
//     height="20"
//     viewBox="0 0 24 24"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//   >
//     <path
//       d="M9.75 20.7467L11.223 21.565C11.5066 21.7225 11.6484 21.8013 11.7986 21.8322C11.9315 21.8595 12.0685 21.8595 12.2015 21.8322C12.3516 21.8013 12.4934 21.7225 12.777 21.565L14.25 20.7467M5.25 18.2467L3.82297 17.4539C3.52346 17.2875 3.37368 17.2043 3.26463 17.0859C3.16816 16.9812 3.09515 16.8572 3.05048 16.722C3 16.5692 3 16.3979 3 16.0552V14.4967M3 9.49667V7.93811C3 7.59547 3 7.42415 3.05048 7.27135C3.09515 7.13617 3.16816 7.01209 3.26463 6.9074C3.37368 6.78907 3.52345 6.70586 3.82297 6.53946L5.25 5.74667M9.75 3.24667L11.223 2.42835C11.5066 2.27079 11.6484 2.19201 11.7986 2.16113C11.9315 2.13379 12.0685 2.13379 12.2015 2.16113C12.3516 2.19201 12.4934 2.27079 12.777 2.42835L14.25 3.24667M18.75 5.74667L20.177 6.53946C20.4766 6.70586 20.6263 6.78906 20.7354 6.9074C20.8318 7.01209 20.9049 7.13617 20.9495 7.27135C21 7.42415 21 7.59547 21 7.93811V9.49667M21 14.4967V16.0552C21 16.3979 21 16.5692 20.9495 16.722C20.9049 16.8572 20.8318 16.9812 20.7354 17.0859C20.6263 17.2043 20.4766 17.2875 20.177 17.4539L18.75 18.2467M9.75 10.7467L12 11.9967M12 11.9967L14.25 10.7467M12 11.9967V14.4967M3 6.99667L5.25 8.24667M18.75 8.24667L21 6.99667M12 19.4967V21.9967"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     />
//   </svg>
// );
// const CreationCenterIcon = () => (
//   <svg
//     width="24"
//     height="24"
//     viewBox="0 0 24 24"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//   >
//     <path
//       d="M9 3.5V2M5.06066 5.06066L4 4M5.06066 13L4 14.0607M13 5.06066L14.0607 4M3.5 9H2M15.8645 16.1896L13.3727 20.817C13.0881 21.3457 12.9457 21.61 12.7745 21.6769C12.6259 21.7349 12.4585 21.7185 12.324 21.6328C12.1689 21.534 12.0806 21.2471 11.9038 20.6733L8.44519 9.44525C8.3008 8.97651 8.2286 8.74213 8.28669 8.58383C8.33729 8.44595 8.44595 8.33729 8.58383 8.2867C8.74213 8.22861 8.9765 8.3008 9.44525 8.44519L20.6732 11.9038C21.247 12.0806 21.5339 12.169 21.6327 12.324C21.7185 12.4586 21.7348 12.6259 21.6768 12.7745C21.61 12.9458 21.3456 13.0881 20.817 13.3728L16.1896 15.8645C16.111 15.9068 16.0717 15.9279 16.0374 15.9551C16.0068 15.9792 15.9792 16.0068 15.9551 16.0374C15.9279 16.0717 15.9068 16.111 15.8645 16.1896Z"
//       stroke="#5F6563"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     />
//   </svg>
// );

// const CreationCenterLightIcon = () => (
//   <svg
//     width="24"
//     height="24"
//     viewBox="0 0 24 24"
//     fill="none"
//     xmlns="http://www.w3.org/2000/svg"
//   >
//     <path
//       d="M9 3.5V2M5.06066 5.06066L4 4M5.06066 13L4 14.0607M13 5.06066L14.0607 4M3.5 9H2M15.8645 16.1896L13.3727 20.817C13.0881 21.3457 12.9457 21.61 12.7745 21.6769C12.6259 21.7349 12.4585 21.7185 12.324 21.6328C12.1689 21.534 12.0806 21.2471 11.9038 20.6733L8.44519 9.44525C8.3008 8.97651 8.2286 8.74213 8.28669 8.58383C8.33729 8.44595 8.44595 8.33729 8.58383 8.2867C8.74213 8.22861 8.9765 8.3008 9.44525 8.44519L20.6732 11.9038C21.247 12.0806 21.5339 21.6327 12.324C21.7185 12.4586 21.7348 12.6259 21.6768 12.7745C21.61 12.9458 21.3456 13.0881 20.817 13.3728L16.1896 15.8645C16.111 15.9068 16.0717 15.9279 16.0374 15.9551C16.0068 15.9792 15.9792 16.0068 15.9551 16.0374C15.9279 16.0717 15.9068 16.111 15.8645 16.1896Z"
//       stroke="currentColor"
//       strokeWidth="2"
//       strokeLinecap="round"
//       strokeLinejoin="round"
//     />
//   </svg>
// );

// 具体图标组件
export function NavHomeIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={HomeIcon}
      activeIcon={HomeLightIcon}
      size={20}
    />
  );
}

export function NavMyAssetsIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={MyAssetsIcon}
      activeIcon={MyAssetsLightIcon}
      size={20}
    />
  );
}
export function NavMyUserIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={MyUserIcon}
      activeIcon={MyUserLightIcon}
      size={20}
    />
  );
}

export function NavCreationCenterIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={CreationCenterIcon}
      activeIcon={CreationCenterLightIcon}
      size={20}
    />
  );
}

export function NavCharacterIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={CharacterIcon}
      activeIcon={CharacterLightIcon}
      size={20}
    />
  );
}

export function NavSettingIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={SettingIcon}
      activeIcon={SettingLightIcon}
      size={20}
    />
  );
}
export function NavCreateCharacterIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={CreateCharacterIcon}
      activeIcon={CreateCharacterLightIcon}
      size={20}
    />
  );
}

export function NavChatIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  return (
    <SiderIcon
      isActive={isActive}
      isHovered={isHovered}
      normalIcon={ChatIcon}
      activeIcon={ChatLightIcon}
      size={20}
    />
  );
}

export function NavCreationIcon({
  isActive,
  isHovered,
}: {
  isActive: boolean;
  isHovered: boolean;
}) {
  const isHighlighted = isActive || isHovered;
  return (
    <div
      style={{
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isHighlighted ? <CreationLightIcon /> : <CreationIcon />}
    </div>
  );
}
