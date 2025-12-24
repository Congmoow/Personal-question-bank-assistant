import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  RotateCcw,
  Trophy,
  Target,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';

// 题型标签
const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题'
};

const Practice = () => {
  const navigate = useNavigate();
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();
  
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [practicing, setPracticing] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

  useEffect(() => {
    refreshBanks();
  }, []);

  // 打乱数组顺序
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // 开始练习
  const startPractice = async () => {
    if (!selectedBankId) return;
    
    setLoading(true);
    try {
      // 获取题库所有题目
      const result = await api.question.getByBankId(selectedBankId, { page: 1, pageSize: 1000 });
      
      if (result.data.length === 0) {
        alert('该题库暂无题目');
        return;
      }
      
      // 随机打乱题目顺序，并打乱单选题和多选题的选项顺序
      const shuffled = shuffleArray(result.data).map(q => {
        if ((q.type === 'single' || q.type === 'multiple') && q.options) {
          return { ...q, options: shuffleArray(q.options) };
        }
        return q;
      });
      setQuestions(shuffled);
      setCurrentIndex(0);
      setUserAnswers({});
      setShowResult(false);
      setSubmitted(false);
      setPracticing(true);
      setPracticeResult(null);
    } catch (error) {
      console.error('加载题目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 选择答案
  const handleAnswer = (questionId, answer) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // 多选题切换选项
  const toggleMultipleAnswer = (questionId, option) => {
    if (submitted) return;
    const current = userAnswers[questionId] || [];
    const newAnswer = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option].sort();
    setUserAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
  };

  // 提交当前题目
  const submitAnswer = () => {
    setSubmitted(true);
    setShowResult(true);
  };

  // 下一题
  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSubmitted(false);
      setShowResult(false);
    } else {
      // 练习结束，计算结果
      finishPractice();
    }
  };

  // 完成练习
  const finishPractice = async () => {
    let correct = 0;
    questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'multiple') {
        const correctArr = q.answer.split('|').sort();
        const userArr = (userAnswer || []).sort();
        if (JSON.stringify(correctArr) === JSON.stringify(userArr)) {
          correct++;
        }
      } else {
        if (userAnswer === q.answer) {
          correct++;
        }
      }
    });

    const accuracy = Math.round((correct / questions.length) * 100);
    const result = {
      total: questions.length,
      correct,
      wrong: questions.length - correct,
      accuracy,
      bankId: selectedBankId,
      timestamp: new Date().toISOString()
    };

    setPracticeResult(result);

    // 保存练习记录
    try {
      await api.practice.saveRecord(result);
    } catch (error) {
      console.error('保存练习记录失败:', error);
    }
  };

  // 重新开始
  const restart = () => {
    setPracticing(false);
    setPracticeResult(null);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers({});
  };

  // 当前题目
  const currentQuestion = questions[currentIndex];

  // 检查答案是否正确
  const isCorrect = (question) => {
    const userAnswer = userAnswers[question.id];
    if (question.type === 'multiple') {
      const correctArr = question.answer.split('|').sort();
      const userArr = (userAnswer || []).sort();
      return JSON.stringify(correctArr) === JSON.stringify(userArr);
    }
    return userAnswer === question.answer;
  };

  // 练习结果页面
  if (practiceResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-lg"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">练习完成！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            {banks.find(b => b.id === selectedBankId)?.name}
          </p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{practiceResult.total}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">总题数</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">{practiceResult.correct}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">正确</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{practiceResult.wrong}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">错误</p>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-6xl font-bold text-primary mb-2">{practiceResult.accuracy}%</div>
            <p className="text-gray-500 dark:text-gray-400">正确率</p>
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={restart}
              className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={20} />
              重新选择
            </button>
            <button
              onClick={startPractice}
              className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Play size={20} />
              再练一次
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 练习中页面
  if (practicing && currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto">
        {/* 进度条 */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span>第 {currentIndex + 1} 题 / 共 {questions.length} 题</span>
            <span>{Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
          >
            {/* 题型标签 */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                {TYPE_LABELS[currentQuestion.type]}
              </span>
            </div>

            {/* 题干 */}
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6 leading-relaxed">
              {currentQuestion.content}
            </h3>

            {/* 选项 */}
            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple') && currentQuestion.options && (
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentQuestion.type === 'multiple'
                    ? (userAnswers[currentQuestion.id] || []).includes(option.id)
                    : userAnswers[currentQuestion.id] === option.id;
                  const isCorrectOption = currentQuestion.type === 'multiple'
                    ? currentQuestion.answer.split('|').includes(option.id)
                    : currentQuestion.answer === option.id;

                  let optionClass = 'border-gray-200 dark:border-gray-600 hover:border-primary';
                  if (showResult) {
                    if (isCorrectOption) {
                      optionClass = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                    } else if (isSelected && !isCorrectOption) {
                      optionClass = 'border-red-500 bg-red-50 dark:bg-red-900/20';
                    }
                  } else if (isSelected) {
                    optionClass = 'border-primary bg-primary/5';
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => currentQuestion.type === 'multiple' 
                        ? toggleMultipleAnswer(currentQuestion.id, option.id)
                        : handleAnswer(currentQuestion.id, option.id)
                      }
                      disabled={submitted}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${optionClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
                          {option.id}
                        </span>
                        <span className="flex-1 text-gray-900 dark:text-white">{option.text}</span>
                        {showResult && isCorrectOption && <CheckCircle className="text-green-500" size={20} />}
                        {showResult && isSelected && !isCorrectOption && <XCircle className="text-red-500" size={20} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 判断题选项 */}
            {currentQuestion.type === 'boolean' && (
              <div className="flex gap-4 mb-6">
                {['正确', '错误'].map((option) => {
                  const isSelected = userAnswers[currentQuestion.id] === option;
                  const isCorrectOption = currentQuestion.answer === option;

                  let optionClass = 'border-gray-200 dark:border-gray-600 hover:border-primary';
                  if (showResult) {
                    if (isCorrectOption) {
                      optionClass = 'border-green-500 bg-green-50 dark:bg-green-900/20';
                    } else if (isSelected && !isCorrectOption) {
                      optionClass = 'border-red-500 bg-red-50 dark:bg-red-900/20';
                    }
                  } else if (isSelected) {
                    optionClass = 'border-primary bg-primary/5';
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(currentQuestion.id, option)}
                      disabled={submitted}
                      className={`flex-1 p-4 rounded-xl border-2 transition-all ${optionClass}`}
                    >
                      <span className="text-gray-900 dark:text-white font-medium">{option}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 填空题/简答题输入 */}
            {(currentQuestion.type === 'fill' || currentQuestion.type === 'short') && (
              <div className="mb-6">
                <textarea
                  value={userAnswers[currentQuestion.id] || ''}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  disabled={submitted}
                  placeholder="请输入答案..."
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none h-32"
                />
                {showResult && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400">
                      <span className="font-medium">参考答案：</span>{currentQuestion.answer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 解析 */}
            {showResult && currentQuestion.analysis && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  <span className="font-medium">解析：</span>{currentQuestion.analysis}
                </p>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3">
              {!submitted ? (
                <button
                  onClick={submitAnswer}
                  disabled={!userAnswers[currentQuestion.id]}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  确认答案
                </button>
              ) : (
                <button
                  onClick={nextQuestion}
                  className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  {currentIndex < questions.length - 1 ? '下一题' : '查看结果'}
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // 选择题库页面
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">随机练题</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">选择题库开始随机练习</p>
      </div>

      {banks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">暂无题库，请先创建题库并添加题目</p>
          <button
            onClick={() => navigate('/question-preview')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            前往题库管理
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((bank) => (
            <motion.button
              key={bank.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedBankId(bank.id)}
              className={`text-left p-6 rounded-2xl border-2 transition-all ${
                selectedBankId === bank.id
                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                {selectedBankId === bank.id && (
                  <CheckCircle className="text-primary" size={24} />
                )}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{bank.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {bank.questionCount || 0} 道题目
              </p>
            </motion.button>
          ))}
        </div>
      )}

      {selectedBankId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <button
            onClick={startPractice}
            disabled={loading}
            className="px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors flex items-center gap-2 text-lg font-medium disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <Play size={24} />
                开始练习
              </>
            )}
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Practice;
