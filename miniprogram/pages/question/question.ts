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
    showResultDialog: false,
    isCorrect: false,
    resultMessage: "",
    correctCount: 0,
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
    // OSS 音频播放状态
    ossAudioPlaying: false,
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
          });
        }, 100);
      },
    );
  },

  onOptionSelect(e: any) {
    console.log("dddd:", e.currentTarget.dataset.index);
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedIndex: index }, () => {
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
      this.setData({
        showConfirm: true,
        title: "确认返回",
        content: `是否要返回上一级？`,
        showCancel: true,
      });
    } else {
      //点击了ai评分
      wx.showLoading({
        title: "正在ai评分中",
      });
      await this.submitAnswer();
    }
  },

  // 提交答案
  onCloseDialogAndNextQuestion() {
    // 3秒后自动关闭弹窗
    setTimeout(() => {
      this.setData({
        showResultDialog: false,
        countDownHandled: false,
        time: 15 * 1000,
      });
      // 延迟一点再进入下一题，让用户看到结果
      setTimeout(() => {
        this.onResultConfirm();
      }, 300);
    }, 2000);
  },

  // 提交答案到服务器
  async submitAnswer() {
    const { scene } = this.data;
    try {
      if (scene === "context") await this.doContextSceneSubmit();
      if (scene === "sound") await this.doSoundSceneSubmit();
      if (scene === "image") await this.doImageSceneSubmit();

      if (["context", "sound"].includes(scene)) {
        this.onCloseDialogAndNextQuestion();
      }
    } catch (error) {
      console.error("提交答案失败:", error);
      // 即使提交失败，也显示结果
      this.onCloseDialogAndNextQuestion();
    }
  },
  async doContextSceneSubmit() {
    const { currentQuestion, selectedIndex, questionStartTime, correctCount } =
      this.data;
    if (selectedIndex === null || !currentQuestion.id) {
      console.log("selectedIndex is null or no question id, returning");
      return;
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
    if (submitAnswer.success) {
      const isCorrect = selectedIndex === currentQuestion.answerIndex;
      const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;
      this.setData({
        showResultDialog: true,
        isCorrect,
        resultMessage: isCorrect ? "恭喜，答对了！" : "再接再厉！",
        correctCount: newCorrectCount,
      });
    }
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
      resultMessage: "",
    };
    if (submitAnswer.error) {
      dialogInfo.resultMessage = submitAnswer.error + ERROR_MESSAGE;
    } else if (!submitAnswer.is_correct) {
      dialogInfo.resultMessage = submitAnswer.comment + ERROR_MESSAGE;
    } else {
      dialogInfo.isCorrect = true;
      dialogInfo.resultMessage = submitAnswer.comment;
    }
    this.setData(dialogInfo);
    setTimeout(() => {
      this.setData({
        showResultDialog: false,
      });
    }, 2000);
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

      wx.hideLoading();
      console.log("picvoiceReview:", picvoiceReview);

      if (!picvoiceReview.overallPass || picvoiceReview.error) {
        this.setData({
          showResultDialog: true,
          isCorrect: false,
          resultMessage:
            picvoiceReview.comment || picvoiceReview.error + ERROR_MESSAGE,
        });
        // 2秒后自动关闭弹窗
        setTimeout(() => {
          this.setData({
            showResultDialog: false,
          });
        }, 2000);
      } else {
        console.log("picvoiceReview:", picvoiceReview);
        this.setData({
          showResultDialog: true,
          isCorrect: true,
          resultMessage: picvoiceReview.comment,
        });
        // 2秒后自动关闭弹窗并返回上一页
        setTimeout(() => {
          this.setData({
            showResultDialog: false,
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 300);
        }, 2000);
      }
    } catch (error) {
      wx.hideLoading();
      console.error("图片识音评分失败:", error);
      this.setData({
        showResultDialog: true,
        isCorrect: false,
        resultMessage: error.errMsg + ERROR_MESSAGE,
      });
      setTimeout(() => {
        this.setData({
          showResultDialog: false,
        });
      }, 2000);
    }
  },

  onResultConfirm() {
    const { currentIndex, totalCount, questions, scene } = this.data;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= totalCount) {
      if (scene === "context") {
        // 答题结束，停止倒计时
        this.setData({
          showConfirm: true,
          title: "答题完成",
          content: `你答对了 ${this.data.correctCount} / ${totalCount} 题`,
          showCancel: false,
          time: 0,
        });
        return;
      } else {
        wx.navigateBack();
      }
    }

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
      },
      () => {
        // 题目切换完成后，再启动倒计时和开始计时
        setTimeout(() => {
          this.setData({
            countDownRunning: true,
            questionStartTime: Date.now(),
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
    if (countDownHandled) return;
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
          console.error("上传失败", err);
        },
      });
      wx.showToast({ title: "录音完成", icon: "success", duration: 1500 });
    } catch (e) {
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

    const backgroundAudioManager = wx.getBackgroundAudioManager();
    if (backgroundAudioManager.src) {
      backgroundAudioManager.stop();
    }
    backgroundAudioManager.title = "录音播放";
    backgroundAudioManager.src = url;
    wx.showToast({ title: "正在播放...", icon: "loading", duration: 1000 });
  },

  // 播放 OSS 音频
  onPlayOSSAudio(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: "音频地址无效", icon: "none" });
      return;
    }
    console.log("准备播放音频:", url);

    wx.showLoading({
      title: "加载音频中...",
    });

    // 使用 BackgroundAudioManager 播放网络音频
    const backgroundAudioManager = wx.getBackgroundAudioManager();

    // 设置必要属性
    backgroundAudioManager.title = "粤语音频";
    backgroundAudioManager.src = url;

    // 播放开始时切换图标
    backgroundAudioManager.onPlay(() => {
      console.log("开始播放");
      wx.hideLoading();
      this.setData({ ossAudioPlaying: true });
    });

    // 播放结束时恢复图标
    backgroundAudioManager.onEnded(() => {
      console.log("播放结束");
      this.setData({ ossAudioPlaying: false });
    });

    // 播放错误时恢复图标
    backgroundAudioManager.onError((err) => {
      console.error("音频播放错误:", err);
      wx.hideLoading();
      this.setData({ ossAudioPlaying: false });
      wx.showToast({
        title: "播放失败",
        icon: "none",
        duration: 2000,
      });
    });

    // 自然播放完成
    backgroundAudioManager.onCanplay(() => {
      console.log("音频可以播放了");
      wx.hideLoading();
    });
  },

  onConfirm() {
    const { currentIndex, totalCount, questions } = this.data;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalCount) {
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
          console.log("上传图片出错：", err);
          wx.showToast({ title: err.errMsg || "上传图片失败", icon: "none" });
        }
      },
      fail: (err) => {
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
