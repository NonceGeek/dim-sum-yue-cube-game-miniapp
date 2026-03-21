// pages/question/question.ts

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

// 模拟题目数据
const MOCK_QUESTIONS: Record<string, Question[]> = {
  context: [
    {
      text: "佢今日喺公司好忙，撞正咗老板嚟巡逻，佢——嘢？",
      options: ["执行", "撞手", "撞彩", "撞手运势"],
      correctIndex: 2,
    },
    {
      text: "听日要去深圳开会，今晚要——定机票。",
      options: ["整", "买", "订", "攞"],
      correctIndex: 2,
    },
    {
      text: "你唔好咁急性啦，慢慢嚟——嘢？",
      options: ["做", "整", "搵", "揾"],
      correctIndex: 2,
    },
  ],
  image: [
    {
      text: "请听音频，选择正确答案",
      options: ["选项A", "选项B", "选项C", "选项D"],
      correctIndex: 0,
    },
    {
      text: "请看图，选择正确答案",
      options: ["选项A", "选项B", "选项C", "选项D"],
      correctIndex: 1,
    },
    {
      text: "请听音频，选择正确答案",
      options: ["选项A", "选项B", "选项C", "选项D"],
      correctIndex: 2,
    },
  ],
  sound: [
    {
      text: "请听音频，选择正确的字",
      options: ["听", "厅", "停", "艇"],
      correctIndex: 0,
    },
    {
      text: "请听音频，选择正确的词",
      options: ["知", "之", "支", "只"],
      correctIndex: 1,
    },
    {
      text: "请听音频，选择正确的词",
      options: ["人", "仁", "银", "忍"],
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
    progressPercent: 0,
    showResultDialog: false,
    isCorrect: false,
    resultMessage: "",
    correctCount: 0,
  },

  onLoad(options) {
    const scene = options.scene || "context";
    const app = getApp<any>();
    const info = app.getSceneType(scene);
    this.setData({ scene, pageIcon: info.icon, pageText: info.text });
    this.loadQuestions(scene);
  },

  loadQuestions(scene: string) {
    // 从后端API获取题目，这里用模拟数据
    const questions = MOCK_QUESTIONS[scene] || MOCK_QUESTIONS["context"];
    const totalCount = questions.length;

    this.setData({
      questions,
      totalCount,
      currentQuestion: questions[0],
      progressPercent: Math.round((1 / totalCount) * 100),
    });
  },

  onOptionSelect(e: any) {
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedIndex: index });
  },

  onSubmit() {
    const {
      currentIndex,
      questions,
      currentQuestion,
      selectedIndex,
      correctCount,
    } = this.data;

    if (selectedIndex === null) return;

    const isCorrect = selectedIndex === currentQuestion.correctIndex;
    const newCorrectCount = isCorrect ? correctCount + 1 : correctCount;

    this.setData({
      showResultDialog: true,
      isCorrect,
      resultMessage: isCorrect ? "叻喎！继续加油！" : "再试多次啦～",
      correctCount: newCorrectCount,
    });
  },

  onResultConfirm() {
    const { currentIndex, totalCount, questions } = this.data;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= totalCount) {
      // 答题结束
      wx.showModal({
        title: "答题完成",
        content: `你答对了 ${this.data.correctCount} / ${totalCount} 题`,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
      return;
    }

    this.setData({
      showResultDialog: false,
      currentIndex: nextIndex,
      currentQuestion: questions[nextIndex],
      selectedIndex: null,
      progressPercent: Math.round(((nextIndex + 1) / totalCount) * 100),
    });
  },
});
