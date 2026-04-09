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
    showAnimation: false,
    sceneList: [] as any[],
    hasAnimated: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  // 图没有description
  onLoad(options) {
    this.syncTheme();
    const scene = options.scene || "context";
    this.setSceneInfo(scene);
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    // 只在第一次渲染时触发动画
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
   * 初始化场景列表
   */
  initSceneList() {
    const sceneType = this.data.sceneType;
    const sceneList = [
      {
        id: "food",
        title: "饮食",
        icon: "hamburger",
        description: sceneType === "image" ? "" : "共有14句常用语",
      },
      {
        id: "direction",
        title: "问路",
        icon: "map",
        description: sceneType === "image" ? "" : "共有14句常用语",
      },
      {
        id: "attraction",
        title: "景点",
        icon: "tower-2",
        description: sceneType === "image" ? "" : "共有14句常用语",
      },
      {
        id: "accommodation",
        title: "住宿",
        icon: "houses-1",
        description: sceneType === "image" ? "" : "共有14句常用语",
      },
    ];
    this.setData({ sceneList });
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
    this.setData(
      {
        sceneType: scene,
        pageIcon: info.icon,
        pageText: info.text,
      },
      () => {
        this.initSceneList();
      },
    );
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
