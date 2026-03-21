/// <reference path="./types/index.d.ts" />

import { ThemeMode, ThemeValue } from "../miniprogram/app";

// 场景类型信息
export interface SceneTypeInfo {
  icon: string;
  text: string;
}

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo | null;
    accessToken: string;
    refreshToken: string;
    themeMode: string;
    theme: string;
  };
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback;
  ensureLogin(retries?: number): Promise<string>;
  tryLogin(retries: number): Promise<string>;
  doLogin(): Promise<string>;
  logout(): void;
  getStorage(key: string): Promise<any>;
  setStorage(key: string, data: any): Promise<void>;
  initTheme: () => void;
  applyTheme: (theme: ThemeValue) => void;
  getThemeMode: () => any;
  getTheme: any;
  getSceneMap(): Record<string, SceneTypeInfo>;
  getSceneType(scene: string): SceneTypeInfo;
}
