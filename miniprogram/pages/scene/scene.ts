import request from "../../utils/http";

const sceneIconMap = {
  daily: "task",
  food: "hamburger",
  travel: "map",
  shopping: "cart",
  campus: "education",
  leisure: "music-1",
  medical: "hospital-1",
  greeting: "chat-bubble-smile",
  housing: "houses",
  commute: "traffic",
  sport: "logo-dribbble",
  work: "desktop",
  job: "desktop",
  stroll: "cart",
  bank: "saving-pot",
  weather: "sunny",
  thanks: "chat-heart",
  post: "send",
  direction: "map",
  hobby: "heart",
  beauty: "cut",
  communication: "chat",
  gathering: "palette-1",
  help: "help-circle",
  accommodation: "houses-1",
};

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
  async initSceneList() {
    wx.showLoading({
      title: "加载中...",
      mask: true,
    });
    try {
      const sceneType = this.data.sceneType;
      const res = await request(`/question_scenes?mode=${sceneType}`);
      console.log("res", res, sceneType);
      const sceneList = res.map((scene) => {
        return {
          ...scene,
          icon: sceneIconMap[scene.id as keyof typeof sceneIconMap],
          ...(scene.total ? { description: `共有${scene.total}句常用语` } : {}),
        };
      });
      wx.hideLoading();
      this.setData({ sceneList });
    } catch (e) {
      console.log("获取scene列表失败", e);
      wx.hideLoading();
      wx.showToast({
        title: e.error || "获取scene列表失败",
        icon: "none",
        duration: 2000,
      });
    }
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
      async () => {
        await this.initSceneList();
      },
    );
  },

  /**
   * 点击场景卡片
   */
  onSceneCellTap(e: any) {
    const { sceneType } = this.data;
    const sceneId = e.currentTarget.dataset.id;
    const category = e.currentTarget.dataset.category;
    const total = e.currentTarget.dataset.total;
    this.setData({
      activeCell: sceneId,
    });
    if (sceneType !== "image" && total === 0) {
      wx.showModal({
        title: "提示",
        content: "该场景下题目还在准备中，请稍后再试",
        showCancel: false
      })
      return;
    }
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/question/question?scene=${this.data.sceneType}&sceneId=${sceneId}&category=${category}`,
      });
    }, 200);
  },
});
