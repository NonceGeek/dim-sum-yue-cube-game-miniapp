// components/custom-tab-bar/index.js
Component({
  properties: {
    // 当前页面图标
    pageIcon: {
      type: String,
      value: "home",
    },
    // 当前页面文字
    pageText: {
      type: String,
      value: "首页",
    },
    // 当前swiper索引
    swiperIndex: {
      type: Number,
      value: 0,
    },
  },

  data: {
    selectedValue: "current",
    currentIndex: 0,
    currentPageIcon: "home",
    currentPageText: "首页",
  },

  observers: {
    pageIcon: function (pageIcon) {
      console.log('pageIcon changed:', pageIcon);
      this.setData({
        currentPageIcon: pageIcon,
      });
    },
    pageText: function (pageText) {
      console.log('pageText changed:', pageText);
      this.setData({
        currentPageText: pageText,
      });
    },
    swiperIndex: function (swiperIndex) {
      this.setData({
        currentIndex: swiperIndex,
        selectedValue: swiperIndex === 0 ? "current" : "profile",
      });
    },
  },

  lifetimes: {
    attached() {
      console.log('custom-tab-bar attached, pageIcon:', this.properties.pageIcon, 'pageText:', this.properties.pageText);
      this.setData({
        currentPageIcon: this.properties.pageIcon,
        currentPageText: this.properties.pageText,
      });
    }
  },

  methods: {
    onTabBarChange(e) {
      const value = e.detail.value;

      if (value === "current") {
        // 当前页面，通知父组件滑动到第一个swiper-item
        this.triggerEvent("swiperchange", { index: 0 });
      } else if (value === "profile") {
        // 通知父组件滑动到第二个swiper-item（profile-preview）
        this.triggerEvent("swiperchange", { index: 1 });
      }
    },
  },
});
