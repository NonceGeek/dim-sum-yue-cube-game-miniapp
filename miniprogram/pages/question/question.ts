interface Question {
  scene?: string;
  imageUrl?: string;
  text?: string;
  dialogueLines?: Array<{
    role: "system" | "user";
    icon: string;
    text: string;
  }>;
  options?: Array<{
    text: string;
    pronunciation?: string;
  }>;
  jyutping?: string;
  audio_url?: string;
  correctIndex: number;
}

// 模拟题目数据
const MOCK_QUESTIONS: Record<string, Question[]> = {
  context: [
    {
      scene: "茶餐厅",
      dialogueLines: [
        { role: "system", icon: "Q", text: "你想食啲乜？" },
        { role: "user", icon: "A", text: "唔该，我要一个___" },
      ],
      options: [
        { text: "叉烧饭", pronunciation: "chaa1 siu1 faan6" },
        { text: "白切鸡", pronunciation: "baak6 cit3 gai1" },
        { text: "烧鹅", pronunciation: "siu1 ngo5" },
        { text: "云吞面", pronunciation: "wan4 tan1 min6" },
      ],
      correctIndex: 0,
    },
    {
      scene: "便利店",
      dialogueLines: [
        { role: "system", icon: "Q", text: "今日好热喎！" },
        { role: "user", icon: "A", text: "系啊，我要买支___" },
      ],
      options: [
        { text: "水", pronunciation: "seoi2" },
        { text: "雪糕", pronunciation: "syut3 gou1" },
        { text: "汽水", pronunciation: "hei3 seoi2" },
        { text: "咖啡", pronunciation: "gaa3 fe1" },
      ],
      correctIndex: 2,
    },
    {
      scene: "问路",
      dialogueLines: [
        { role: "system", icon: "Q", text: "唔该，地铁站喺边度呀？" },
        { role: "user", icon: "A", text: "直行，然后___就系了" },
      ],
      options: [
        { text: "左转", pronunciation: "zo2 zyun2" },
        { text: "右转", pronunciation: "jau6 zyun2" },
        { text: "掉头", pronunciation: "diu3 tau4" },
        { text: "转弯", pronunciation: "waan1 zyun1" },
      ],
      correctIndex: 0,
    },
  ],
  image: [],
  sound: [
    {
      text: "我不吃辣的东西",
      jyutping: "我(ngo5)唔(m4)食(sik6)辣(laat6)嘅(ge3)嘢(je5)",
      audio_url: "https://example.com/我不吃辣的东西.mp3",
      correctIndex: 0,
    },
    {
      text: "我不吃甜的东西",
      jyutping: "我(ngo5)唔(m4)食(sik6)甜(tim4)嘅(ge3)嘢(je5)",
      audio_url: "https://example.com/我不吃甜的东西.mp3",
      correctIndex: 1,
    },
    {
      text: "我不吃香菜",
      jyutping: "我 (ngo5) 唔 (m4) 食 (sik6) 香菜 (hoeng1 coi3)",
      audio_url: "https://example.com/我不吃香菜.mp3",
      correctIndex: 2,
    },
  ],
};

Page({
  data: {
    scene: "",
    questions: [] as Question[],
    currentIndex: 0,
    totalCount: 0,
    currentQuestion: {} as Question,
    selectedIndex: null as number | null,
    selectedBtn: null as string | null,
    progressPercent: 0,
    // 结果弹窗相关状态
    showResultDialog: false,
    isCorrect: false,
    resultMessage: "",
    correctCount: 0,
    // 倒计时
    time: 15 * 1000,
    countDownRunning: true,
    countDownUrgent: false,
    // 录音相关状态
    recording: false,
    recordTime: 0,
    recordTimer: null as number | null,
    url: "",
    touchStartTime: 0,
    touchStartTimer: null as number | null,
    touchStartX: 0,
    touchStartY: 0,
    justFinishedRecording: false,
    // 主题相关
    currentTheme: "light" as "light" | "dark",
    themeMode: "auto" as "auto" | "light" | "dark",
    // 提醒/提示
    showConfirm: false,
    title: "",
    content: "",
    showCancel: false,
    cancelBtn: "取消",
    // image
    imageUrl: "",
  },

  onLoad(options) {
    this.syncTheme();
    const scene = options.scene || "context";
    const app = getApp<any>();
    const info = app.getSceneType(scene);
    console.log("scene:", scene);
    this.setData({ scene, pageIcon: info.icon, pageText: info.text });
    this.loadQuestions(scene);
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    const app = getApp<any>();
    const themeMode = app.getThemeMode();
    const currentTheme = app.getTheme();

    this.setData({
      themeMode,
      currentTheme,
    });
  },

  loadQuestions(scene: string) {
    // 从后端API获取题目，这里用模拟数据
    const questions = MOCK_QUESTIONS[scene] || MOCK_QUESTIONS["context"];
    const totalCount = questions.length;
    console.log("questions:", questions[0]);
    this.setData({
      questions,
      totalCount,
      currentQuestion: questions[0],
      progressPercent: Math.round((1 / totalCount) * 100),
      countDownRunning: true,
      countDownUrgent: false,
    });
  },

  onOptionSelect(e: any) {
    console.log("dddd:", e.currentTarget.dataset.index);
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedIndex: index }, () => {
      this.onSubmit();
    });
  },

  onBtnSelect(e: any) {
    const btn = e.currentTarget.dataset.btn;
    this.setData({ selectedBtn: btn }, () => {
      this.onShowConfirm();
    });
  },

  onShowConfirm() {
    const { selectedBtn } = this.data;
    if (selectedBtn === "cancel") {
      this.setData({
        showConfirm: true,
        title: "确认返回",
        content: `是否要返回上一级？`,
        showCancel: true,
      });
    } else {
      //点击了ai评分
    }
  },

  onSubmit() {
    const { currentQuestion, selectedIndex, correctCount } = this.data;
    if (selectedIndex === null) {
      console.log("selectedIndex is null, returning");
      return;
    }

    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
    this.setData(
      {
        showResultDialog: true,
        isCorrect,
        resultMessage: isCorrect ? "恭喜，答对了！" : "再接再厉！",
        correctCount: newCorrectCount,
      },
      () => {
        // 3秒后自动关闭弹窗
        setTimeout(() => {
          this.setData({ showResultDialog: false, time: 15 * 1000 });
          // 延迟一点再进入下一题，让用户看到结果
          setTimeout(() => {
            this.onResultConfirm();
          }, 300);
        }, 2000);
      },
    );
  },

  onResultConfirm() {
    const { currentIndex, totalCount, questions } = this.data;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= totalCount) {
      // 答题结束，停止倒计时
      this.setData({
        showConfirm: true,
        title: "答题完成",
        content: `你答对了 ${this.data.correctCount} / ${totalCount} 题`,
        showCancel: false,
        time: 0,
      });
      return;
    }

    this.setData({
      showResultDialog: false,
      currentIndex: nextIndex,
      currentQuestion: questions[nextIndex],
      selectedIndex: null,
      progressPercent: Math.round(((nextIndex + 1) / totalCount) * 100),
      countDownRunning: true,
      countDownUrgent: false,
    });
  },
  onCountDownChange(e: any) {
    const remainingMs = e.detail.ss;
    // 最后3秒变紧急状态
    if (remainingMs <= 3 && remainingMs > 0) {
      this.setData({ countDownUrgent: true });
    } else {
      this.setData({ countDownUrgent: false });
    }
  },

  onCountDownFinish() {
    this.setData(
      {
        showResultDialog: true,
        isCorrect: false,
        resultMessage: "时间到！",
        countDownRunning: false,
        countDownUrgent: false,
      },
      () => {
        // 3秒后自动关闭弹窗
        setTimeout(() => {
          this.setData({
            showResultDialog: false,
            time:
              this.data.totalCount !== this.data.currentIndex + 1
                ? 15 * 1000
                : 0,
          });
          // 延迟一点再进入下一题，让用户看到结果
          setTimeout(() => {
            this.onResultConfirm();
          }, 300);
        }, 2000);
      },
    );
  },

  // 开始录音
  onStartRecord(e: any) {
    const touch = e.touches[0];
    this.setData({
      touchStartTime: Date.now(),
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
    });

    if (this.data.touchStartTimer) {
      clearTimeout(this.data.touchStartTimer);
    }

    const timer = setTimeout(() => {
      this.checkAndStartRecord();
    }, 200) as unknown as number;

    this.setData({ touchStartTimer: timer });
  },

  onRecordTouchMove(e: any) {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.data.touchStartX);
    const deltaY = Math.abs(touch.clientY - this.data.touchStartY);

    if (deltaX > 15 || deltaY > 15) {
      if (this.data.touchStartTimer) {
        clearTimeout(this.data.touchStartTimer);
        this.setData({ touchStartTimer: null });
      }

      if (this.data.recording) {
        const recorderManager = (this as any).recorderManager;
        if (recorderManager) {
          recorderManager.stop();
        }
        this.setData({ recording: false, recordTime: 0 });
        if (this.data.recordTimer) {
          clearInterval(this.data.recordTimer);
          this.setData({ recordTimer: null });
        }
        wx.hideToast();
      }
    }
  },

  checkAndStartRecord() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting["scope.record"]) {
          wx.authorize({
            scope: "scope.record",
            success: () => {
              this.doStartRecord();
            },
            fail: () => {
              wx.showModal({
                title: "提示",
                content: "需要录音权限才能使用此功能",
                showCancel: false,
              });
            },
          });
        } else {
          this.doStartRecord();
        }
      },
    });
  },

  doStartRecord() {
    this.setData({ recording: true, recordTime: 0 });

    const timer = setInterval(() => {
      this.setData({ recordTime: this.data.recordTime + 1 });
    }, 1000);
    this.setData({ recordTimer: timer });

    const recorderManager = wx.getRecorderManager();
    recorderManager.start({
      format: "mp3",
      sampleRate: 44100,
      numberOfChannels: 1,
      encodeBitRate: 128000,
    });

    recorderManager.onStop((res) => {
      console.log("录音完成", res);
      const { tempFilePath } = res;
      this.saveAudioUrl(tempFilePath);
    });

    (this as any).recorderManager = recorderManager;

    wx.showToast({ title: "正在录音...", icon: "loading", duration: 1000 });
  },

  onStopRecord(e: any) {
    if (this.data.touchStartTimer) {
      clearTimeout(this.data.touchStartTimer);
      this.setData({ touchStartTimer: null });
    }

    if (!this.data.recording) return;

    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }

    this.setData({ recording: false, recordTime: 0, recordTimer: null });

    const recorderManager = (this as any).recorderManager;
    if (recorderManager) {
      recorderManager.stop();
    }

    wx.hideToast();
    this.setData({ justFinishedRecording: true });
    setTimeout(() => {
      this.setData({ justFinishedRecording: false });
    }, 300);
  },

  saveAudioUrl(filePath: string) {
    // 此处上传到 OSS，简化处理直接存本地临时路径
    this.setData({ url: filePath });
    wx.showToast({ title: "录音完成", icon: "success", duration: 1500 });
  },

  onPlayAudio() {
    if (this.data.recording || this.data.justFinishedRecording) return;

    const { url } = this.data;
    if (!url) {
      wx.showToast({ title: "暂无录音", icon: "none" });
      return;
    }

    const backgroundAudioManager = wx.getBackgroundAudioManager();
    if (backgroundAudioManager.src) {
      backgroundAudioManager.stop();
    }
    backgroundAudioManager.title = "录音播放";
    backgroundAudioManager.src = url;
    wx.showToast({ title: "正在播放...", icon: "loading", duration: 1000 });
  },
  onConfirm() {
    wx.navigateBack();
  },
  onCancel() {
    this.setData({ showConfirm: false });
  },

  // 选择图片
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({ imageUrl: tempFilePath });
      },
      fail: (err) => {
        console.error("选择图片失败", err);
      },
    });
  },
});
