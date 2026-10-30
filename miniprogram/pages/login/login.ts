import { IAppOption } from "../../../typings";
import ENV from "../../config/setting";
import { getLoginReturnUrl } from "../../utils/login-redirect";
const { miniProgram } = wx.getAccountInfoSync();
const SMS_COOLDOWN_KEY = "smsCooldownUntil";

Page({
  data: {
    loading: false,
    returnUrl: "/pages/index/index",
    currentTheme: "light",
    showPhonePopup: false,
    phone: "",
    code: "",
    counting: false,
    cooldownTime: 0,
    codeButtonText: "发送验证码",
    sendingCode: false,
    logining: false,
    agreedToTerms: false,
    version: miniProgram.version || `${ENV.VERSION}`,
  },

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ returnUrl: getLoginReturnUrl(options.returnUrl) });
    this.syncTheme();
  },

  onShow() {
    this.restoreSmsCooldown();
    this.syncTheme();
  },

  syncTheme() {
    const app = getApp<any>();
    app.syncNavigationBarTheme();
    const currentTheme = app.getTheme() || "light";
    this.setData({ currentTheme });
  },

  async handleLogin() {
    if (this.data.loading) return;

    console.log("handleLogin agreedToTerms:", this.data.agreedToTerms);
    if (!this.data.agreedToTerms) {
      wx.showToast({
        title: "请先阅读并同意用户协议",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    this.setData({ loading: true });

    try {
      // Reuse the existing doLogin method which handles wx.login + backend request
      const app = getApp<IAppOption>();
      await app.doLogin();

      wx.showToast({
        title: "登录成功",
        icon: "success",
      });

      // 返回触发登录的页面
      setTimeout(() => {
        wx.reLaunch({
          url: this.data.returnUrl,
        });
      }, 1500);
    } catch (err: any) {
      console.error("Login failed", err);
      wx.showToast({
        title: err?.error || err?.message || err?.errMsg || "登录失败",
        icon: "none",
        duration: 2000,
      });
      this.setData({ loading: false });
    }
  },

  // 打开手机号登录弹窗
  handlePhoneLogin() {
    this.restoreSmsCooldown();    this.setData({
      showPhonePopup: true,
      agreedToTerms: false,
    });
  },

  // 关闭弹窗
  onPopupClose(e: any) {
    this.setData({
      showPhonePopup: e.detail.visible,
      agreedToTerms: false,
    });
  },

  // 手机号输入
  onPhoneChange(e: any) {
    this.setData({
      phone: e.detail.value,
    });
  },

  // 验证码输入
  onCodeChange(e: any) {
    this.setData({
      code: e.detail.value,
    });
  },

  // 发送验证码
  async sendCode() {
    const app = getApp<IAppOption>();
    const { phone, sendingCode } = this.data;

    if (sendingCode) return;
    this.restoreSmsCooldown();
    if (this.data.counting) return;

    // 验证手机号
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: "请输入正确的手机号",
        icon: "none",
      });
      return;
    }

    this.setData({ sendingCode: true });

    try {
      console.log("发送验证码到:", phone);
      const res = await app.doSendSms(phone);
      if (!res?.success) {
        throw new Error(
          (typeof res?.error === "string" && res.error) || res?.message || "发送失败，请稍后重试",
        );
      }
      const deadline = Date.now() + 60000;
      wx.setStorageSync(SMS_COOLDOWN_KEY, deadline);
      wx.showToast({
        title: "验证码已发送",
        icon: "success",
        duration: 2000,
      });

      // 开始倒计时
      this.setData({
        counting: true,
        cooldownTime: Math.max(0, deadline - Date.now()),
      });
    } catch (err: any) {
      console.error("发送验证码失败", err);
      wx.showToast({
        title:
          (typeof err?.error === "string" ? err.error : null) ||
          err?.message ||
          err?.errMsg ||
          "发送失败",
        icon: "none",
        duration: 2000,
      });
    } finally {
      this.setData({ sendingCode: false });
    }
  },

  restoreSmsCooldown() {
    const storedDeadline = wx.getStorageSync(SMS_COOLDOWN_KEY);
    const deadline = typeof storedDeadline === "number" && Number.isFinite(storedDeadline) ? storedDeadline : 0;
    const remaining = Math.max(0, deadline - Date.now());
    if (!remaining) wx.removeStorageSync(SMS_COOLDOWN_KEY);
    this.setData({ counting: remaining > 0, cooldownTime: remaining });
  },

  // 倒计时结束
  onCountDownFinish() {
    // 以截止时间为准，避免旧组件的 finish 事件清除新的冷却状态。
    this.restoreSmsCooldown();
  },

  // 确认手机号登录
  async confirmPhoneLogin() {
    const app = getApp<IAppOption>();
    const { phone, code, logining } = this.data;

    if (logining) return;

    // 验证输入
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: "请输入正确的手机号",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    if (!code || code.length !== 6) {
      wx.showToast({
        title: "请输入6位验证码",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    this.setData({ logining: true });

    try {
      await app.doPhoneLogin(phone, code);

      wx.showToast({
        title: "登录成功",
        icon: "success",
        duration: 2000,
      });

      // 关闭弹窗
      this.setData({
        showPhonePopup: false,
      });

      // 返回触发登录的页面
      setTimeout(() => {
        wx.reLaunch({
          url: this.data.returnUrl,
        });
      }, 1500);
    } catch (err: any) {
      console.error("手机号登录失败", err);
      wx.showToast({
        title:
          (typeof err?.error === "string" ? err.error : null) ||
          err?.message ||
          err?.errMsg ||
          "登录失败",
        icon: "none",
        duration: 2000,
      });
      this.setData({ logining: false });
    }
  },

  // 协议复选框变化
  onAgreementChange(e: any) {
    const checked = e.detail.checked;
    this.setData({
      agreedToTerms: checked,
    });
  },

  // 跳转到用户服务协议
  goToTerms() {
    wx.navigateTo({
      url: "/pages/webview/webview?url=https://search.aidimsum.com/terms",
    });
  },

  // 跳转到隐私政策
  goToPrivacy() {
    wx.navigateTo({
      url: "/pages/webview/webview?url=https://search.aidimsum.com/privacy",
    });
  },

});
