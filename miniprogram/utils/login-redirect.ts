const LOGIN_PATH = "/pages/login/login";
const HOME_PATH = "/pages/index/index";
let redirectPending = false;

// 在清空页面栈前记录当前路由和参数，避免登录后丢失场景、题目等入口信息。
export function redirectToLogin() {
  if (redirectPending) return;
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  if (page?.route === LOGIN_PATH.slice(1)) return;

  const query = Object.entries(page?.options || {})
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  const returnUrl = page?.route
    ? `/${page.route}${query ? `?${query}` : ""}`
    : HOME_PATH;
  redirectPending = true;

  wx.removeStorageSync("accessToken");
  wx.removeStorageSync("refreshToken");
  const app = getApp<{ globalData: { accessToken: string; refreshToken: string } }>();
  app.globalData.accessToken = "";
  app.globalData.refreshToken = "";
  wx.showToast({ title: "登录已过期，请重新登录", icon: "none", duration: 2000 });
  setTimeout(() => {
    wx.reLaunch({
      url: `${LOGIN_PATH}?returnUrl=${encodeURIComponent(returnUrl)}`,
      complete: () => { redirectPending = false; },
    });
  }, 2000);
}

export function getLoginReturnUrl(returnUrl?: string): string {
  if (!returnUrl) return HOME_PATH;
  try {
    const url = decodeURIComponent(returnUrl);
    // 只接受本小程序内已注册的页面，且不能回到登录页。
    const path = url.split("?")[0];
    const pages = ["/pages/index/index", "/pages/scene/scene", "/pages/question/question", "/pages/webview/webview"];
    return pages.includes(path) ? url : HOME_PATH;
  } catch {
    return HOME_PATH;
  }
}
