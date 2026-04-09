// components/page-wrapper/index.js

// 主题选项
const THEME_OPTIONS = [
  { label: '跟随系统', value: 'auto' },
  { label: '浅色模式', value: 'light' },
  { label: '深色模式', value: 'dark' },
];

// 主题模式文本映射
const THEME_MODE_TEXT: Record<string, string> = {
  auto: '跟随系统',
  light: '浅色模式',
  dark: '深色模式',
};

Component({
  options: {
    multipleSlots: true // 启用多个插槽
  },

  properties: {
    // 页面图标
    pageIcon: {
      type: String,
      value: 'home'
    },
    // 页面文字
    pageText: {
      type: String,
      value: '首页'
    }
  },

  data: {
    currentSwiperIndex: 0,
    titleAnimate: false,
    // 主题相关
    currentTheme: 'light' as 'light' | 'dark',
    themeMode: 'auto' as 'auto' | 'light' | 'dark',
    themeModeText: '跟随系统',
    showThemeSheet: false,
    themeOptions: THEME_OPTIONS,
  },

  lifetimes: {
    attached() {
      this.syncTheme();
    }
  },

  methods: {
    // swiper切换事件
    onSwiperChange(e) {
      const index = e.detail.current;
      this.setData({
        currentSwiperIndex: index,
        titleAnimate: false,
      });
      // 切到个人中心页时触发光波动画
      if (index === 1) {
        setTimeout(() => {
          this.setData({ titleAnimate: true });
        }, 50);
      }
    },

    // tab-bar触发swiper切换
    onTabBarSwiperChange(e) {
      const index = e.detail.index;
      this.setData({
        currentSwiperIndex: index,
        titleAnimate: false,
      });
      if (index === 1) {
        setTimeout(() => {
          this.setData({ titleAnimate: true });
        }, 50);
      }
    },

    // 同步主题状态
    syncTheme() {
      const app = getApp<any>();
      const themeMode = app.getThemeMode();
      const currentTheme = app.getTheme();

      if (themeMode) {
        this.setData({
          themeMode,
          currentTheme,
          themeModeText: THEME_MODE_TEXT[themeMode],
        });
      }
    },

    // 点击主题设置
    onThemeSettingTap() {
      this.setData({
        showThemeSheet: true,
      });
    },

    // 选择主题
    onThemeSelect(e: any) {
      const { value } = e.detail.selected;
      const app = getApp<any>();

      app.setThemeMode(value);

      // 更新组件状态
      setTimeout(() => {
        const currentTheme = app.getTheme();
        this.setData({
          themeMode: value,
          currentTheme,
          themeModeText: THEME_MODE_TEXT[value],
          showThemeSheet: false,
        });
      }, 100);
    },

    // 关闭主题选择弹窗
    onThemeSheetClose() {
      this.setData({
        showThemeSheet: false,
      });
    },

    // 退出登录
    onLogout() {
      wx.showModal({
        title: "提示",
        content: "确定要退出登录吗？",
        success: (res) => {
          if (res.confirm) {
            getApp<any>().logout();
          }
        },
      });
    }
  }
});
