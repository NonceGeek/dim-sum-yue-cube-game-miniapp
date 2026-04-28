Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeCell: "",
    showAnimation: false,
    hasAnimated: false,
    sceneList: [] as Array<{ id: string; icon: string; text: string }>,
    currentTheme: "light" as "light" | "dark",
    themeMode: "auto" as "auto" | "light" | "dark",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.syncTheme();
    this.initSceneList();
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
   * 初始化场景列表
   */
  initSceneList() {
    const app = getApp<any>();
    const sceneMap = app.getSceneMap();
    const sceneList = Object.keys(sceneMap).map((id) => ({
      id,
      ...sceneMap[id],
    }));
    this.setData({ sceneList });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    if (!this.data.hasAnimated) {
      setTimeout(() => {
        this.setData({
          showAnimation: true,
          hasAnimated: true,
        });
      }, 100);
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 重置active状态
    this.setData({ activeCell: "" });
  },
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: "粤玩粤醒",
      path: "/pages/index/index",
    };
  },
  onShareTimeline() {
    return {
      title: "粤玩粤醒",
      path: "/pages/index/index",
    };
  },

  /**
   * 重置swiper到第一页
   */
  onResetSwiper(e: any) {
    // 不需要任何操作
  },

  /**
   * 点击游戏卡片
   */
  onGameCellTap(e: any) {
    const sceneId = e.currentTarget.dataset.id;
    this.setData({
      activeCell: sceneId,
    });
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/scene/scene?scene=${sceneId}`,
      });
    }, 200);
  },

});
