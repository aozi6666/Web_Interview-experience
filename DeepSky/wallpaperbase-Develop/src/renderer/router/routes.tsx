import { RouteObject } from 'react-router-dom';
import Character from '../pages/Character';
import Chat from '../pages/Chat';
import Creation from '../pages/Creation';
import ForVc from '../pages/ForVc';
import Home from '../pages/Home';
import MyAssets from '../pages/myAssets';
import User from '../pages/User';
import Wallpapers from '../pages/Wallpapers';
import WallpaperBabyTest from '../pages/WallpaperBabyTest';
import WEWallpaper from '../Pages/WEWallpaper';
import ProtectedRoute from './ProtectedRoute';

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MyAssets />
      </ProtectedRoute>
    ),
  },
  {
    path: '/wallpapers',
    element: (
      <ProtectedRoute>
        <Wallpapers />
      </ProtectedRoute>
    ),
  },
  {
    path: '/my-assets',
    element: (
      <ProtectedRoute>
        <MyAssets />
      </ProtectedRoute>
    ),
  },
  {
    path: '/character',
    element: (
      <ProtectedRoute>
        <Character />
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat',
    element: (
      <ProtectedRoute>
        <Chat analyticsContext="big" />
      </ProtectedRoute>
    ),
  },
  {
    path: '/creation',
    element: (
      <ProtectedRoute>
        <Creation />
      </ProtectedRoute>
    ),
  },
  {
    path: '/wallpaper-baby-test',
    element: (
      <ProtectedRoute>
        <WallpaperBabyTest />
      </ProtectedRoute>
    ),
  },
  {
    path: '/we-wallpaper',
    element: (
      <ProtectedRoute>
        <WEWallpaper />
      </ProtectedRoute>
    ),
  },
  {
    path: '/home',
    element: (
      <ProtectedRoute>
        <Home />
      </ProtectedRoute>
    ),
  },
  {
    path: '/for-vc',
    element: (
      <ProtectedRoute>
        <ForVc />
      </ProtectedRoute>
    ),
  },
  {
    path: '/user',
    element: (
      <ProtectedRoute>
        <User />
      </ProtectedRoute>
    ),
  },
];

export default routes;
