import request from "../../utils/http";
import ENV from "../../config/setting";

interface Question {
  id: string;
  scene_id?: string;
  scenario?: string;
  options?: { text: string; pronunciation: string }[];
  question: string;
  meaning?: string;
  jyutping?: string;
  audio?: string;
  answerIndex?: number;
  stemPre: string;
  stemPost: string;
}

const ERROR_MESSAGE = "，请稍后重试";

Page({
  resultTimer: undefined as ReturnType<typeof setTimeout> | undefined,

  audioLoadTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  audioPageDisposed: false,

  data: {
    scene: "",
    sceneId: "",
    category: "",
    questions: [] as Question[],
    currentIndex: 0,
    totalCount: 0,
    currentQuestion: {} as Question,
    selectedIndex: null as number | null,
    selectedBtn: null as string | null,
    progressPercent: 0,
    // 结果弹窗相关状态
    submittingAnswer: false,
    resultCanAdvance: true,
    showResultDialog: false,
    isCorrect: false,
    resultMessage: "",
    correctCount: 0,
    quizFinished: false,
    // 倒计时
    time: 15 * 1000,
    countDownRunning: true,
    countDownUrgent: false,
    countDownHandled: false, // 防止 onCountDownFinish 和 onCountDownChange 互相触发
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
    // 当前音频播放来源："" 未播放 | "oss" 题目音频 | "record" 录音回放
    playingSource: "",
    // 答题时间统计
    questionStartTime: 0, // 当前题目开始答题的时间戳（毫秒）
    // AI评分按钮是否可用
    canSubmitAI: false,
  },

  async onLoad(options) {
    this.syncTheme();
    console.log("options:", options);
    const scene = options.scene || "context";
    const app = getApp<any>();
    const info = app.getSceneType(scene);
    console.log("scene:", scene);
    this.setData({
      scene,
      pageIcon: info.icon,
      pageText: info.text,
      category: options.category,
      sceneId: options.sceneId,
      ...(scene === "image" ? { questionStartTime: Date.now() } : {}),
    });
    if (scene !== "image") {
      await this.loadQuestions(scene);
    }
  },

  onShow() {
    this.audioPageDisposed = false;
    this.syncTheme();
  },

  onHide() {
    this.stopQuestionAudio();
    this.audioPageDisposed = true;
  },

  onUnload() {
    this.stopQuestionAudio();
    this.audioPageDisposed = true;
    if (this.resultTimer !== undefined) clearTimeout(this.resultTimer);
    if (this.data.touchStartTimer) {
      clearTimeout(this.data.touchStartTimer);
    }
    if (this.data.recordTimer) {
      clearInterval(this.data.recordTimer);
    }
    const recorderManager = (this as any).recorderManager;
    if (this.data.recording && recorderManager) {
      recorderManager.stop();
    }
    wx.hideLoading();
    wx.hideToast();
  },

  syncTheme() {
    const app = getApp<any>();
    app.syncNavigationBarTheme();
    const themeMode = app.getThemeMode();
    const currentTheme = app.getTheme();

    this.setData({
      themeMode,
      currentTheme,
    });
  },

  async loadQuestions(scene: string) {
    const questions = await request(
      `/question_${scene}?scene_id=${this.data.sceneId}&limit=5`,
    );
    const totalCount = questions.length;
    console.log("questions:", questions[0]);
    this.setData(
      {
        questions,
        totalCount,
        currentQuestion: questions[0],
        progressPercent: Math.round((1 / totalCount) * 100),
        countDownRunning: false, // 先不启动倒计时
        countDownUrgent: false,
        time: 15 * 1000, // 重置倒计时时间
      },
      () => {
        // 数据设置完成后，再启动倒计时和开始计时答题时间
        setTimeout(() => {
          this.setData({
            countDownRunning: true,
            questionStartTime: Date.now(),
          }, () => {
            this.selectComponent("#question-countdown")?.start();
          });
        }, 100);
      },
    );
  },

  onOptionSelect(e: any) {
    if (this.data.selectedIndex !== null || this.data.countDownHandled || this.data.quizFinished) return;
    this.selectComponent("#question-countdown")?.pause();
    console.log("dddd:", e.currentTarget.dataset.index);
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedIndex: index, countDownRunning: false, countDownHandled: true }, () => {
      this.submitAnswer();
    });
  },

  onBtnSelect(e: any) {
    const btn = e.currentTarget.dataset.btn;
    this.setData({ selectedBtn: btn }, () => {
      this.onShowConfirm();
    });
  },

  // ai评分
  async onShowConfirm() {
    const { selectedBtn } = this.data;
    if (selectedBtn === "cancel") {
      this.setData({ showConfirm: true });
      this.selectComponent("#return-confirm-dialog").open({
        title: "确认返回",
        content: "是否要返回上一级？",
        showCancel: true,
        cancelText: "取消",
        confirmText: "确认",
        onCancel: () => {
          this.setData({ showConfirm: false, selectedBtn: null });
        },
        onConfirm: () => {
          this.setData({ showConfirm: false, selectedBtn: null });
          wx.navigateBack();
        },
      });
    } else {
      //点击了ai评分
      wx.showLoading({
        title: "正在AI评分中",
      });
      await this.submitAnswer();
    }
  },

  // 提交答案
  onCloseDialogAndNextQuestion() {
    if (this.data.scene === "context" && this.data.showResultDialog) {
      if (this.data.currentIndex + 1 >= this.data.totalCount) {
        if (this.resultTimer !== undefined) {
          clearTimeout(this.resultTimer);
          this.resultTimer = undefined;
        }
        this.setData({
          countDownRunning: false,
          countDownHandled: true,
        });
        this.selectComponent("#context-result-dialog").open({
          title: "答题结果",
          content: this.data.resultMessage,
          showCancel: true,
          cancelText: "返回",
          confirmText: "查看结果",
          onCancel: () => {
            this.setData({ showResultDialog: false });
            wx.navigateBack();
          },
          onConfirm: () => {
            this.showQuizSummary();
          },
        });
        return;
      }
      this.selectComponent("#context-result-dialog").open({
        title: "答题结果",
        content: this.data.resultMessage,
        showCancel: true,
        cancelText: "返回",
        confirmText: this.data.currentIndex + 1 >= this.data.totalCount ? "确定" : "下一题",
        onCancel: () => {
          this.setData({ showResultDialog: false });
          wx.navigateBack();
        },
        onConfirm: () => { this.onResultConfirm(); },
      });
      return;
    }
    if (this.resultTimer !== undefined) clearTimeout(this.resultTimer);
    this.resultTimer = setTimeout(() => {
      this.resultTimer = undefined;
      this.onResultConfirm();
    }, 2000);
  },

  showQuizSummary() {
    if (this.data.quizFinished) return;
    if (this.resultTimer !== undefined) {
      clearTimeout(this.resultTimer);
      this.resultTimer = undefined;
    }
    this.selectComponent("#context-result-dialog").close();
    this.setData({
      showResultDialog: false,
      quizFinished: true,
      countDownRunning: false,
      countDownHandled: true,
    });
    this.selectComponent("#quiz-summary-dialog").open({
      title: "答题完成",
      content: `你答对了 ${this.data.correctCount} / ${this.data.totalCount} 题`,
      showCancel: true,
      cancelText: "返回",
      confirmText: "确认",
      onCancel: () => { wx.navigateBack(); },
      onConfirm: () => { wx.navigateBack(); },
    });
  },

  // 提交答案到服务器
  async submitAnswer() {
    const { scene } = this.data;
    if (this.data.submittingAnswer || this.data.showResultDialog || this.data.quizFinished) return;
    this.setData({ submittingAnswer: true });
    if (scene === "context") wx.showLoading({ title: "提交中...", mask: true });
    try {
      if (scene === "context") await this.doContextSceneSubmit();
      if (scene === "sound") {
        await this.doSoundSceneSubmit();
        this.openSoundResultDialog();
      }
      if (scene === "image") await this.doImageSceneSubmit();

      if (scene === "context") {
        this.onCloseDialogAndNextQuestion();
      }
    } catch (error) {
      console.error("提交答案失败:", error);
      if (scene === "sound") {
        this.setData({
          showResultDialog: true,
          isCorrect: false,
          resultCanAdvance: false,
          resultMessage: "评分失败，请稍后重试。录音已保留。",
        });
        this.openSoundResultDialog();
      } else if (scene === "context") {
        this.setData({ showResultDialog: true });
        this.selectComponent("#context-result-dialog").open({
          title: "提交失败",
          content: "答案未能确认，请稍后重新选择提交。",
          showCancel: true,
          cancelText: "返回",
          confirmText: "重新作答",
          onCancel: () => {
            this.setData({ showResultDialog: false });
            wx.navigateBack();
          },
          onConfirm: () => {
            this.setData({
              showResultDialog: false,
              selectedIndex: null,
              countDownHandled: false,
              countDownRunning: true,
            }, () => {
              this.selectComponent("#question-countdown")?.start();
            });
          },
        });
      } else {
        this.onCloseDialogAndNextQuestion();
      }
    } finally {
      this.setData({ submittingAnswer: false });
      if (scene === "sound" || scene === "context") wx.hideLoading();
    }
  },
  async doContextSceneSubmit() {
    const { currentQuestion, selectedIndex, questionStartTime, correctCount } =
      this.data;
    if (selectedIndex === null || !currentQuestion.id) {
      throw new Error("缺少题目或所选答案");
    }
    const answerTime = Math.round((Date.now() - questionStartTime) / 1000);
    const params = {
      mode: "context",
      question_id: currentQuestion.id,
      selected_answer: currentQuestion?.options?.[selectedIndex]?.text || "",
      selected_index: selectedIndex,
      time: answerTime,
    };
    const submitAnswer = await request("/submit_answer", {
      method: "POST",
      data: params,
    });
    if (!submitAnswer || submitAnswer.error || submitAnswer.success === false) {
      throw new Error("提交答案失败");
    }
    const hasServerResult = typeof submitAnswer.is_correct === "boolean";
    const hasLocalAnswer = typeof currentQuestion.answerIndex === "number";
    if (!hasServerResult && !(submitAnswer.success === true && hasLocalAnswer)) {
      throw new Error("提交结果缺少判题信息");
    }
    {
      const isCorrect = hasServerResult
        ? submitAnswer.is_correct
        : selectedIndex === currentQuestion.answerIndex;
      const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
      this.setData({
        showResultDialog: true,
        isCorrect,
        resultMessage: isCorrect ? "恭喜，答对了！" : "再接再厉！",
        correctCount: newCorrectCount,
      });
    }
  },
  openSoundResultDialog() {
    const dialog = this.selectComponent("#sound-result-dialog");
    dialog.open({
      title: this.data.resultCanAdvance ? "发音评分" : "评分暂未完成",
      content: this.data.resultMessage,
      showCancel: true,
      cancelText: "关闭",
      confirmText: this.data.currentIndex + 1 >= this.data.totalCount ? "确定" : "下一题",
      onCancel: () => {
        this.setData({ showResultDialog: false });
      },
      onConfirm: () => {
        this.onResultConfirm();
      },
    });
  },

  async doSoundSceneSubmit() {
    const { currentQuestion, scene, url, questionStartTime } = this.data;
    const id = currentQuestion.id;
    const answerTime = Math.round((Date.now() - questionStartTime) / 1000);
    const params = {
      mode: scene,
      question_id: id,
      time: answerTime,
      audio: url,
    };

    const submitAnswer = await request("/submit_answer", {
      method: "POST",
      data: params,
    });
    wx.hideLoading();
    const dialogInfo = {
      showResultDialog: true,
      isCorrect: false,
      resultCanAdvance: !submitAnswer.error,
      resultMessage: "",
    };
    if (submitAnswer.error) {
      dialogInfo.resultMessage = submitAnswer.error + ERROR_MESSAGE;
    } else if (!submitAnswer.is_correct) {
      dialogInfo.resultMessage = submitAnswer.comment || "再试着听清发音，多练习一下吧。";
    } else {
      dialogInfo.isCorrect = true;
      dialogInfo.resultMessage = submitAnswer.comment || "恭喜，答对了！";
    }
    this.setData(dialogInfo);

  },
  async doImageSceneSubmit() {
    const { category, imageUrl, url, questionStartTime } = this.data;
    console.log("url:", url);
    const answerTime = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const picvoiceReview = await request("/picvoice_review", {
        method: "POST",
        data: {
          scene: category,
          imageUrl,
          audioUrl: url,
          time: answerTime,
        },
      });

      this.setData({
        showResultDialog: true,
        isCorrect: Boolean(picvoiceReview.overallPass && !picvoiceReview.error),
        resultMessage: picvoiceReview.comment ||
          (picvoiceReview.error ? picvoiceReview.error + ERROR_MESSAGE : "评分完成"),
      });
    } catch (error: any) {
      console.error("图片识音评分失败:", error);
      this.setData({
        showResultDialog: true,
        isCorrect: false,
        resultMessage: (error?.errMsg || error?.message || "评分失败") + ERROR_MESSAGE,
      });
    } finally {
      wx.hideLoading();
    }
    this.selectComponent("#image-result-dialog").open({
      title: "答题结果",
      content: this.data.resultMessage,
      showCancel: true,
      cancelText: "关闭",
      confirmText: "确认",
      onCancel: () => {
        this.setData({ showResultDialog: false });
      },
      onConfirm: () => {
        this.setData({ showResultDialog: false });
        wx.navigateBack();
      },
    });
  },

  onResultConfirm() {
    if (this.resultTimer !== undefined) {
      clearTimeout(this.resultTimer);
      this.resultTimer = undefined;
    }
    if (this.data.quizFinished) return;
    if (this.data.scene === "context") {
      this.selectComponent("#context-result-dialog").close();
    }
    const { currentIndex, totalCount, questions } = this.data;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= totalCount) {
      if (this.data.scene === "context") {
        this.showQuizSummary();
        return;
      }
      this.setData({
        showResultDialog: false,
        quizFinished: true,
        countDownRunning: false,
        countDownHandled: true,
      });
      wx.navigateBack();
      return;
    }

    this.clearAudioLoading();
    if (this.data.playingSource || (this as any).bgAudioLoading) {
      wx.getBackgroundAudioManager().stop();
    }
    (this as any).bgAudioLoading = false;

    // 先设置题目数据，不启动倒计时
    this.setData(
      {
        showResultDialog: false,
        currentIndex: nextIndex,
        currentQuestion: questions[nextIndex],
        selectedIndex: null,
        progressPercent: Math.round(((nextIndex + 1) / totalCount) * 100),
        countDownRunning: false,
        countDownUrgent: false,
        countDownHandled: false,
        time: 15 * 1000, // 重置倒计时时间
        url: "",
        imageUrl: "",
        canSubmitAI: false,
        playingSource: "",
      },
      () => {
        // 题目切换完成后，再启动倒计时和开始计时
        setTimeout(() => {
          this.setData({
            countDownRunning: true,
            questionStartTime: Date.now(),
          }, () => {
            this.selectComponent("#question-countdown")?.start();
          });
        }, 100);
      },
    );
  },
  onCountDownChange(e: any) {
    const remainingMs = e.detail.ss;
    const { countDownUrgent, countDownHandled } = this.data;
    // 防止 finish 已处理后继续触发更新
    if (countDownHandled) return;
    // 最后3秒变紧急状态，只在状态真正变化时更新
    if (remainingMs <= 3 && remainingMs > 0 && !countDownUrgent) {
      this.setData({ countDownUrgent: true });
    } else if (remainingMs > 3 && countDownUrgent) {
      this.setData({ countDownUrgent: false });
    }
  },

  onCountDownFinish() {
    const { countDownHandled } = this.data;
    if (countDownHandled || !this.data.countDownRunning || this.data.submittingAnswer || this.data.quizFinished || this.data.showConfirm) return;
    this.setData(
      {
        countDownHandled: true,
        showResultDialog: true,
        isCorrect: false,
        resultMessage: "时间到！",
        countDownRunning: false,
        countDownUrgent: false,
      },
      () => {
        this.onCloseDialogAndNextQuestion();
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
              // 用户拒绝后，引导去设置页
              wx.showModal({
                title: "需要录音权限",
                content: "开启录音权限后才能使用语音功能",
                confirmText: "去开启",
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        // 用户重新开启
                        if (settingRes.authSetting["scope.record"]) {
                          this.doStartRecord();
                        }
                      },
                    });
                  }
                },
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
    const { scene } = this.data;
    console.log("scene:", scene);
    wx.showLoading({
      title: "上传中...",
      mask: true,
    });
    try {
      const token = wx.getStorageSync("accessToken") || "";
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const dateStr = `${year}${month}${day}`;
      const timestamp = Date.now();
      console.log("currentQuestion:", this.data.currentQuestion);
      wx.uploadFile({
        url: `${ENV.API_BASE_URL}/upload`,
        filePath: filePath,
        name: "file",
        formData: {
          taskId: this.data.currentQuestion.id,
          fileName: `${dateStr}_${scene === "image" ? "yue_cube_image" : this.data.currentQuestion.id}_${timestamp}.mp3`,
        },
        header: {
          Authorization: `Bearer ${token}`,
        },
        success: (res) => {
          console.log("上传成功", res);
          wx.hideLoading();

          const statusCode = res.statusCode;
          if (statusCode === 200) {
            const data = JSON.parse(res.data);
            console.log("音频：", data.url);
            this.setData({ url: data.url }, () => {
              this.updateCanSubmitAI();
            });
          } else {
            console.error("解析响应失败：", res.data);
            const data = JSON.parse(res.data);
            wx.showToast({
              title: data.error || "上传失败",
              icon: "none",
              duration: 2000,
            });
          }
        },
        fail: (err) => {
          wx.hideLoading();
          console.error("上传失败", err);
          wx.showToast({
            title: "上传失败",
            icon: "none",
            duration: 2000,
          });
        },
      });
      wx.showToast({ title: "录音完成", icon: "success", duration: 1500 });
    } catch (e) {
      wx.hideLoading();
      console.log("上传音频失败：", e);
      wx.showToast({ title: e.error || "录音失败", icon: "none" });
    }
  },

  onPlayAudio() {
    if (this.data.recording || this.data.justFinishedRecording) return;

    const { url } = this.data;
    if (!url) {
      wx.showToast({ title: "暂无录音", icon: "none" });
      return;
    }

    this.playOSSAudio({ url, title: "录音播放", source: "record" });
  },

  // 播放 OSS 音频
  onPlayOSSAudio(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "音频地址无效", icon: "none" });
      return;
    }
    console.log("准备播放音频:", url);
    this.playOSSAudio({ url, title: "粤语音频", source: "oss" });
  },

  stopQuestionAudio() {
    const ownsPlayback = this.data.playingSource || (this as any).bgAudioLoading;
    this.clearAudioLoading();
    if (ownsPlayback) {
      wx.getBackgroundAudioManager().stop();
      wx.hideLoading();
    }
    (this as any).bgAudioLoading = false;
    this.setData({ playingSource: "" });
  },

  clearAudioLoading() {
    if (this.audioLoadTimer !== undefined) clearTimeout(this.audioLoadTimer);
    this.audioLoadTimer = undefined;
  },

  watchAudioLoading() {
    this.clearAudioLoading();
    this.audioLoadTimer = setTimeout(() => {
      this.audioLoadTimer = undefined;
      if (this.audioPageDisposed) return;
      console.error("[question-audio] 加载超时", {
        questionId: this.data.currentQuestion.id,
        questionNumber: this.data.currentIndex + 1,
        source: (this as any).bgAudioSource,
      });
      wx.getBackgroundAudioManager().stop();
      (this as any).bgAudioLoading = false;
      this.setData({ playingSource: "" });
      wx.hideLoading();
      wx.showToast({ title: "音频加载超时，请点击重试", icon: "none" });
    }, 12000);
  },

  // 给全局播放器注册回调，每个页面实例只注册一次
  ensureBgAudioListeners() {
    if ((this as any).bgAudioListenersReady) return;
    (this as any).bgAudioListenersReady = true;

    const backgroundAudioManager = wx.getBackgroundAudioManager();

    // 播放开始时切换图标
    backgroundAudioManager.onPlay(() => {
      if (this.audioPageDisposed) return;
      this.clearAudioLoading();
      (this as any).bgAudioLoading = false;
      console.log("开始播放");
      wx.hideLoading();
      this.setData({ playingSource: (this as any).bgAudioSource || "" });
    });

    backgroundAudioManager.onWaiting(() => {
      if (this.audioPageDisposed || !(this.data.playingSource || (this as any).bgAudioLoading)) return;
      (this as any).bgAudioLoading = true;
      // 连续 waiting 事件不延长截止时间。
      if (this.audioLoadTimer === undefined) this.watchAudioLoading();
    });
    backgroundAudioManager.onTimeUpdate(() => {
      if (this.audioPageDisposed) return;
      const currentTime = backgroundAudioManager.currentTime;
      if (currentTime > ((this as any).bgAudioLastTime || 0)) {
        this.clearAudioLoading();
        (this as any).bgAudioLoading = false;
        wx.hideLoading();
      }
      (this as any).bgAudioLastTime = currentTime;
    });

    // 自然播放完成
    backgroundAudioManager.onCanplay(() => {
      if (this.audioPageDisposed) return;
      console.log("音频可以播放了");
      wx.hideLoading();
    });

    // 悬浮胶囊/锁屏暂停、来电等打断也要复位状态，否则后续点击会被拦截
    backgroundAudioManager.onPause(() => {
      if (this.audioPageDisposed) return;
      this.clearAudioLoading();
      wx.hideLoading();
      (this as any).bgAudioLoading = false;
      this.setData({ playingSource: "" });
    });

    backgroundAudioManager.onStop(() => {
      if (this.audioPageDisposed) return;
      this.clearAudioLoading();
      wx.hideLoading();
      (this as any).bgAudioLoading = false;
      this.setData({ playingSource: "" });
    });

    // 播放结束时恢复图标
    backgroundAudioManager.onEnded(() => {
      if (this.audioPageDisposed) return;
      this.clearAudioLoading();
      wx.hideLoading();
      (this as any).bgAudioLoading = false;
      console.log("播放结束");
      this.setData({ playingSource: "" });
    });

    // 播放错误时恢复图标
    backgroundAudioManager.onError((err) => {
      if (this.audioPageDisposed) return;
      this.clearAudioLoading();
      wx.hideLoading();
      (this as any).bgAudioLoading = false;
      console.error("[question-audio] 播放失败", { questionId: this.data.currentQuestion.id, questionNumber: this.data.currentIndex + 1, err });
      console.error("音频播放错误:", err);
      backgroundAudioManager.stop();
      wx.hideLoading();
      this.setData({ playingSource: "" });
      wx.showToast({
        title: "播放失败",
        icon: "none",
        duration: 2000,
      });
    });
  },

  playOSSAudio({ url, title, source }: { url: string; title: string; source: "oss" | "record" }) {
    this.ensureBgAudioListeners();
    const backgroundAudioManager = wx.getBackgroundAudioManager();

    // 再次点击正在播放的那一个 = 停止；点另一个则切换过去播放
    if (this.data.playingSource === source && backgroundAudioManager.src === url) {
      backgroundAudioManager.stop();
      this.setData({ playingSource: "" });
      return;
    }

    wx.showLoading({
      title: "加载音频中...",
    });

    // 记下本次播放来源，onPlay 回调据此更新对应图标
    (this as any).bgAudioSource = source;

    // 先 stop 再赋值 src，保证重复播放同一 URL 也能重新触发播放
    backgroundAudioManager.stop();
    backgroundAudioManager.title = title;
    (this as any).bgAudioLastTime = 0;
    (this as any).bgAudioLoading = true;
    console.log("[question-audio] 开始加载", {
      questionId: this.data.currentQuestion.id,
      questionNumber: this.data.currentIndex + 1,
      source,
    });
    this.watchAudioLoading();
    try {
      backgroundAudioManager.src = url;
    } catch (err) {
      this.clearAudioLoading();
      (this as any).bgAudioLoading = false;
      wx.hideLoading();
      wx.showToast({ title: "音频播放失败，请重试", icon: "none" });
      console.error("[question-audio] 设置音频失败", err);
    }
  },

  onConfirm() {
    const { currentIndex, totalCount, selectedBtn } = this.data;
    if (selectedBtn === "cancel") {
      this.setData({ showConfirm: false, selectedBtn: null });
      wx.navigateBack();
      return;
    }
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalCount) {
      this.setData({ showConfirm: false });
      wx.navigateBack();
    } else {
      this.setData({ showConfirm: false });
    }
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
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const token = wx.getStorageSync("accessToken") || "";

        // 压缩图片
        wx.showLoading({
          title: "图片处理中...",
          mask: true,
        });

        const compressedFilePath = await new Promise<string>(
          (resolve, reject) => {
            wx.compressImage({
              src: tempFilePath,
              quality: 80, // 压缩质量 0-100
              success: (compressRes) => {
                console.log("压缩成功:", compressRes.tempFilePath);
                resolve(compressRes.tempFilePath);
              },
              fail: (err) => {
                console.error("压缩失败，使用原图:", err);
                resolve(tempFilePath); // 压缩失败时使用原图
              },
            });
          },
        );

        wx.hideLoading();

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const dateStr = `${year}${month}${day}`;
        const timestamp = Date.now();
        try {
          wx.showLoading({
            title: "上传中...",
            mask: true,
          });
          wx.uploadFile({
            url: `${ENV.API_BASE_URL}/upload`,
            filePath: compressedFilePath,
            name: "file",
            formData: {
              taskId: this.data.currentQuestion.id,
              fileName: `${dateStr}_yue_cube_image_${timestamp}.png`,
            },
            header: {
              Authorization: `Bearer ${token}`,
            },
            success: async (uploadRes) => {
              wx.hideLoading();

              const statusCode = uploadRes.statusCode;
              console.log("上传响应:", uploadRes);

              if (statusCode === 200) {
                let data;
                try {
                  data = JSON.parse(uploadRes.data);

                  // 获取服务器返回的音频URL
                  const serverUrl = data.url;
                  console.log("data:", data);
                  const image_moderation = await request("/image_moderation", {
                    method: "POST",
                    data: { imageUrl: serverUrl },
                  });
                  console.log("image_moderation:", image_moderation);
                  if (image_moderation.error) {
                    console.error("图片审核失败:", image_moderation);
                    wx.showToast({
                      title: image_moderation.error || "图片审核失败",
                      icon: "error",
                      duration: 2000,
                    });
                    return;
                  } else if (!image_moderation.pass) {
                    wx.showToast({
                      title: image_moderation.comment || "图片审核失败",
                      icon: "error",
                      duration: 2000,
                    });
                    return;
                  } else {
                    this.setData({ imageUrl: serverUrl }, () => {
                      this.updateCanSubmitAI();
                    });
                    wx.showToast({
                      title: "上传图片成功",
                      icon: "success",
                      duration: 1500,
                    });
                  }
                } catch (e) {
                  console.error("解析响应失败:", e);
                  wx.showToast({
                    title: e.errMsg || "上传失败",
                    icon: "error",
                    duration: 2000,
                  });
                  return;
                }
              } else {
                console.error("上传失败，状态码:", statusCode);
                const data = JSON.parse(uploadRes.data);
                wx.showToast({
                  title: data.error || "上传失败",
                  icon: "error",
                  duration: 2000,
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error("上传失败:", err);
              wx.showToast({
                title: "上传失败",
                icon: "error",
                duration: 2000,
              });
            },
          });
        } catch (err) {
          wx.hideLoading();
          console.log("上传图片出错：", err);
          wx.showToast({ title: err.errMsg || "上传图片失败", icon: "none" });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error("选择图片失败", err);
      },
    });
  },

  // 更新 AI 评分按钮是否可用
  updateCanSubmitAI() {
    const { scene, url, imageUrl } = this.data;
    let canSubmit = false;

    if (scene === "image") {
      // image 模式：需要 url 和 imageUrl 都存在
      canSubmit = !!url && !!imageUrl;
    } else if (scene === "sound") {
      // sound 模式：只需要 url 存在
      canSubmit = !!url;
    }

    this.setData({ canSubmitAI: canSubmit });
  },
});
