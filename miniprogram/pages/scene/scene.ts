Page({
  /**
   * 页面的初始数据
   */
  data: {
    sceneType: "",
    pageIcon: "home",
    pageText: "",
    activeCell: "",
    currentTheme: "light" as "light" | "dark",
    themeMode: "auto" as "auto" | "light" | "dark",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.syncTheme();
    const scene = options.scene || "context";
    this.setSceneInfo(scene);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    this.syncTheme();
    // 重置active状态
    this.setData({ activeCell: "" });
  },

  /**
   * 同步主题状态
   */
  syncTheme() {
    const app = getApp<any>();
    const themeMode = app.getThemeMode();
    const currentTheme = app.getTheme();

    this.setData({
      themeMode,
      currentTheme,
    });
  },

  /**
   * 设置场景信息
   */
  setSceneInfo(scene: string) {
    const app = getApp<any>();
    const info = app.getSceneType(scene);
    this.setData({
      sceneType: scene,
      pageIcon: info.icon,
      pageText: info.text,
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 重置active状态
    this.setData({ activeCell: "" });
  },

  /**
   * 点击场景卡片
   */
  onSceneCellTap(e: any) {
    const sceneId = e.currentTarget.dataset.id;
    this.setData({
      activeCell: sceneId,
    });
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/question/question?scene=${this.data.sceneType}&category=${sceneId}`,
      });
    }, 200);
  },
});
