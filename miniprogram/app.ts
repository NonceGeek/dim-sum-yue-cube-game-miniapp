// app.ts

import { IAppOption, SceneTypeInfo } from "../typings";

// 主题类型定义
export type ThemeMode = "auto" | "light" | "dark";
export type ThemeValue = "light" | "dark";

App<IAppOption>({
  globalData: {
    userInfo: null,
    accessToken: "",
    refreshToken: "",
    themeMode: "auto",
    theme: "light",
  },

  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync("logs") || [];
    logs.unshift(Date.now());
    wx.setStorageSync("logs", logs);

    // 初始化主题
    this.initTheme();

    // 监听系统主题变化
    wx.onThemeChange((result) => {
      console.log("系统主题变化:", result.theme);
      if (this.globalData.themeMode === "auto") {
        this.applyTheme(result.theme as ThemeValue);
      }
    });
  },

  /**
   * 初始化主题设置
   */
  async initTheme() {
    try {
      const savedMode = (await this.getStorage("themeMode")) as ThemeMode;
      const systemInfo = wx.getSystemInfoSync();
      const systemTheme = (systemInfo.theme || "light") as ThemeValue;

      if (savedMode && ["auto", "light", "dark"].includes(savedMode)) {
        this.globalData.themeMode = savedMode;
        if (savedMode === "auto") {
          this.applyTheme(systemTheme);
        } else {
          this.applyTheme(savedMode as ThemeValue);
        }
      } else {
        // 默认跟随系统
        this.globalData.themeMode = "auto";
        this.applyTheme(systemTheme);
      }
    } catch (e) {
      console.error("初始化主题失败:", e);
      this.applyTheme("light");
    }
  },

  /**
   * 应用主题到页面
   */
  applyTheme(theme: ThemeValue) {
    this.globalData.theme = theme;

    // 设置页面根节点的主题类
    const pages = getCurrentPages();
    pages.forEach((page: any) => {
      if (typeof page.onThemeChange === "function") {
        page.onThemeChange({ theme });
      } else if (page.setData) {
        page.setData({ currentTheme: theme });
      }
    });

    // 设置导航栏样式
    const navBarStyle =
      theme === "dark"
        ? { backgroundColor: "#161B22", frontColor: "#ffffff" }
        : { backgroundColor: "#FFFFFF", frontColor: "#000000" };

    wx.setNavigationBarColor({
      frontColor: navBarStyle.frontColor as "#ffffff" | "#000000",
      backgroundColor: navBarStyle.backgroundColor,
      animation: { duration: 300, timingFunc: "easeInOut" },
    });

    console.log("主题已应用:", theme);
  },

  /**
   * 获取当前主题模式
   */
  getThemeMode(): ThemeMode {
    return this.globalData.themeMode as ThemeValue;
  },

  /**
   * 获取当前实际主题
   */
  getTheme(): ThemeValue {
    return this.globalData.theme as ThemeValue;
  },

  /**
   * 设置主题模式
   */
  async setThemeMode(mode: ThemeMode) {
    this.globalData.themeMode = mode;
    await this.setStorage("themeMode", mode);

    if (mode === "auto") {
      const systemInfo = wx.getSystemInfoSync();
      this.applyTheme((systemInfo.theme || "light") as ThemeValue);
    } else {
      this.applyTheme(mode as ThemeValue);
    }

    console.log("主题模式已设置:", mode);
  },

  // 封装异步获取 storage
  getStorage(key: string): Promise<any> {
    return new Promise((resolve) => {
      wx.getStorage({
        key,
        success: (res) => resolve(res.data),
        fail: () => resolve(null),
      });
    });
  },

  setStorage(key: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.setStorage({
        key,
        data,
        success: () => resolve(),
        fail: reject,
      });
    });
  },

  /**
   * 退出登录
   */
  logout() {
    // 清除用户信息和token
    this.globalData.userInfo = null;
    this.globalData.accessToken = "";
    this.globalData.refreshToken = "";

    // 清除本地存储
    wx.removeStorageSync("accessToken");
    wx.removeStorageSync("refreshToken");
    wx.removeStorageSync("userInfo");

    // 跳转回登录页
    wx.reLaunch({
      url: "/pages/login/login",
    });
  },
  getSceneMap(): Record<string, SceneTypeInfo> {
    const sceneMap: Record<string, SceneTypeInfo> = {
      context: { icon: "chat-checked", text: "语境填空" },
      image: { icon: "image", text: "传图识音" },
      sound: { icon: "sound", text: "识字辨音" },
    };
    return sceneMap;
  },

  /**
   * 获取场景类型信息
   */
  getSceneType(scene: string): SceneTypeInfo {
    const sceneMap = this.getSceneMap();
    return sceneMap[scene] || sceneMap["context"];
  },
});
