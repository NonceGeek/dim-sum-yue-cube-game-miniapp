Page({
  /**
   * 页面的初始数据
   */
  data: {
    activeCell: "",
    sceneList: [] as Array<{ id: string; icon: string; text: string }>,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.initSceneList();
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
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 重置active状态
    this.setData({ activeCell: "" });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

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
