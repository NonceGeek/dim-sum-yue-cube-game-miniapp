Page({
  /**
   * 页面的初始数据
   */
  data: {
    sceneType: "",
    pageIcon: "home",
    pageText: "",
    activeCell: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    const scene = options.scene || "context";
    this.setSceneInfo(scene);
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
