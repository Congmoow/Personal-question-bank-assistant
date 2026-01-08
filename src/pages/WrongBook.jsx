import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Play,
  Loader2,
  Trash2,
  XCircle,
  CheckCircle,
  ChevronRight,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import CodeAwareText from '../components/CodeAwareText';

const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题'
};

const WrongBook = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();

  const [selectedBankId, setSelectedBankId] = useState(null);
  const [practiceCount, setPracticeCount] = useState(20);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [loading, setLoading] = useState(false);

  const [practicing, setPracticing] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [practiceResult, setPracticeResult] = useState(null);

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    refreshBanks();
  }, []);

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const shuffleQuestionOptions = (question) => {
    const originalOptions = Array.isArray(question.options) ? question.options : [];
    const shuffledOptions = shuffleArray(originalOptions);

    const idMap = new Map();
    const remappedOptions = shuffledOptions.map((opt, index) => {
      const newId = String.fromCharCode(65 + index);
      if (opt && opt.id != null) idMap.set(String(opt.id), newId);
      return { ...opt, id: newId };
    });

    let remappedAnswer = question.answer;
    if (typeof question.answer === 'string' && question.answer.length > 0) {
      if (question.type === 'multiple') {
        remappedAnswer = question.answer
          .split('|')
          .map(a => idMap.get(a) || a)
          .sort()
          .join('|');
      } else if (question.type === 'single') {
        remappedAnswer = idMap.get(question.answer) || question.answer;
      }
    }

    return { ...question, options: remappedOptions, answer: remappedAnswer };
  };

  const getBlankCount = (text) => (String(text || '').match(/_{2,}/g) || []).length;

  const normalizeFillAnswer = (value, blankCount) => {
    const n = Math.max(0, Number(blankCount) || 0);
    const arr = Array.isArray(value)
      ? value
      : (typeof value === 'string' ? value.split('|') : []);

    const normalized = arr.map((v) => String(v ?? ''));
    while (normalized.length < n) normalized.push('');
    if (normalized.length > n) normalized.length = n;
    return normalized;
  };

  const isFillAnswerCorrect = (question, userValue) => {
    const blankCount = getBlankCount(question?.content);
    const correctArr = normalizeFillAnswer(question?.answer, blankCount).map((a) => a.trim());
    const userArr = normalizeFillAnswer(userValue, blankCount).map((a) => a.trim());
    if (blankCount <= 0) return false;
    for (let i = 0; i < blankCount; i++) {
      if (correctArr[i] !== userArr[i]) return false;
    }
    return true;
  };

  const loadItems = async (bankId, targetPage = 1) => {
    setLoading(true);
    try {
      const result = await api.wrongBook.getItems(bankId, { page: targetPage, pageSize });
      setItems(result.data || []);
      setTotal(result.total || 0);
      setPage(result.page || 1);
      setTotalPages(result.totalPages || 0);
    } catch (error) {
      console.error('加载错题本失败:', error);
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(selectedBankId, 1);
  }, [selectedBankId]);

  const currentBankName = useMemo(() => {
    if (!selectedBankId) return '全部题库';
    return banks.find(b => b.id === selectedBankId)?.name || `题库 ${selectedBankId}`;
  }, [banks, selectedBankId]);

  const startPractice = async () => {
    setLoading(true);
    try {
      const count = Number(practiceCount) > 0 ? Number(practiceCount) : 20;
      const result = await api.wrongBook.getRandomQuestions(selectedBankId, count);

      if (!result || result.length === 0) {
        alert('错题本暂无题目');
        return;
      }

      const shuffled = shuffleArray(result).map(q => {
        if ((q.type === 'single' || q.type === 'multiple') && q.options) {
          return shuffleQuestionOptions(q);
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
      console.error('加载错题练习失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    if (submitted) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFillAnswer = (questionId, blankCount, index, value) => {
    if (submitted) return;
    setUserAnswers((prev) => {
      const current = normalizeFillAnswer(prev[questionId], blankCount);
      current[index] = value;
      return { ...prev, [questionId]: current };
    });
  };

  const toggleMultipleAnswer = (questionId, option) => {
    if (submitted) return;
    const current = userAnswers[questionId] || [];
    const newAnswer = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option].sort();
    setUserAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
  };

  const submitAnswer = () => {
    setSubmitted(true);
    setShowResult(true);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSubmitted(false);
      setShowResult(false);
    } else {
      finishPractice();
    }
  };

  const finishPractice = async () => {
    let correct = 0;
    const perQuestionResults = [];

    questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'multiple') {
        const correctArr = q.answer.split('|').sort();
        const userArr = (userAnswer || []).sort();
        const isCorrect = JSON.stringify(correctArr) === JSON.stringify(userArr);
        if (isCorrect) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect });
      } else if (q.type === 'fill') {
        const ok = isFillAnswerCorrect(q, userAnswer);
        if (ok) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect: ok });
      } else {
        const isCorrect = userAnswer === q.answer;
        if (isCorrect) correct++;
        perQuestionResults.push({ questionId: q.id, bankId: q.bankId, isCorrect });
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

    if (selectedBankId) {
      try {
        await api.practice.saveRecord(result);
      } catch (error) {
        console.error('保存练习记录失败:', error);
      }
    }

    try {
      await api.wrongBook.updateFromPractice(perQuestionResults);
    } catch (error) {
      console.error('同步错题本失败:', error);
    }

    await loadItems(selectedBankId, 1);
  };

  const restart = () => {
    setPracticing(false);
    setPracticeResult(null);
    setQuestions([]);
    setCurrentIndex(0);
    setUserAnswers({});
  };

  const currentQuestion = questions[currentIndex];

  const isCorrect = (question) => {
    const userAnswer = userAnswers[question.id];
    if (question.type === 'multiple') {
      const correctArr = question.answer.split('|').sort();
      const userArr = (userAnswer || []).sort();
      return JSON.stringify(correctArr) === JSON.stringify(userArr);
    }
    if (question.type === 'fill') {
      return isFillAnswerCorrect(question, userAnswer);
    }
    return userAnswer === question.answer;
  };

  const handleRemoveItem = async (questionId) => {
    setRemovingId(questionId);
    try {
      await api.wrongBook.removeItem(questionId);
      await loadItems(selectedBankId, page);
    } catch (error) {
      console.error('移除错题失败:', error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleClear = async () => {
    try {
      await api.wrongBook.clear(selectedBankId);
      await loadItems(selectedBankId, 1);
    } catch (error) {
      console.error('清空错题本失败:', error);
    }
  };

  if (practiceResult) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center shadow-lg"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">练习完成！</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{currentBankName}</p>

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
              返回错题本
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

  if (practicing && currentQuestion) {
    const blankCount = currentQuestion.type === 'fill' ? getBlankCount(currentQuestion.content) : 0;
    const fillValues = currentQuestion.type === 'fill'
      ? normalizeFillAnswer(userAnswers[currentQuestion.id], blankCount)
      : [];
    const fillCorrectValues = currentQuestion.type === 'fill'
      ? normalizeFillAnswer(currentQuestion.answer, blankCount)
      : [];

    const canSubmit = (() => {
      const v = userAnswers[currentQuestion.id];
      if (currentQuestion.type === 'multiple') return (v || []).length > 0;
      if (currentQuestion.type === 'fill') {
        if (blankCount <= 0) return false;
        return normalizeFillAnswer(v, blankCount).every((a) => a.trim() !== '');
      }
      return v != null && String(v).trim() !== '';
    })();

    return (
      <div className="max-w-3xl mx-auto">
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

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                {TYPE_LABELS[currentQuestion.type]}
              </span>
            </div>

            <div className="text-lg font-medium text-gray-900 dark:text-white mb-6 leading-relaxed">
              <CodeAwareText text={currentQuestion.content} />
            </div>

            {(currentQuestion.type === 'single' || currentQuestion.type === 'multiple') && currentQuestion.options && (
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                  const optionLabel = String.fromCharCode(65 + index);
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
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
                          {optionLabel}
                        </span>
                        <CodeAwareText
                          text={option.text}
                          className="flex-1 text-gray-900 dark:text-white"
                        />
                        {showResult && isCorrectOption && <CheckCircle className="text-green-500" size={20} />}
                        {showResult && isSelected && !isCorrectOption && <XCircle className="text-red-500" size={20} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

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

            {/* 填空题输入（支持多个空） */}
            {currentQuestion.type === 'fill' && (
              <div className="mb-6 space-y-3">
                {blankCount > 0 && Array.from({ length: blankCount }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                      第 {index + 1} 空
                    </span>
                    <input
                      type="text"
                      value={fillValues[index] || ''}
                      onChange={(e) => handleFillAnswer(currentQuestion.id, blankCount, index, e.target.value)}
                      disabled={submitted}
                      placeholder="请输入答案..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
                {showResult && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-1">
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">参考答案：</p>
                    {fillCorrectValues.map((a, i) => (
                      <p key={i} className="text-sm text-green-700 dark:text-green-400">
                        第 {i + 1} 空：{a}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 简答题输入 */}
            {currentQuestion.type === 'short' && (
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

            {showResult && currentQuestion.analysis && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6">
                <div className="text-sm text-blue-700 dark:text-blue-400">
                  <span className="font-medium">解析：</span>
                  <div className="mt-1">
                    <CodeAwareText text={currentQuestion.analysis} className="bg-transparent p-0" />
                  </div>
                </div>
              </div>
            )}

            {showResult && (
              <div className="mb-6 flex items-center gap-2">
                {isCorrect(currentQuestion)
                  ? <CheckCircle className="text-green-500" size={18} />
                  : <XCircle className="text-red-500" size={18} />}
                <span className={`text-sm ${isCorrect(currentQuestion) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isCorrect(currentQuestion) ? '回答正确' : '回答错误'}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {!submitted ? (
                <button
                  onClick={submitAnswer}
                  disabled={!canSubmit}
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">错题本</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">记录每次练习做错的题目，并支持随机练错题</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">题库筛选</label>
            <select
              value={selectedBankId || ''}
              onChange={(e) => setSelectedBankId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">全部题库</option>
              {banks.map(bank => (
                <option key={bank.id} value={bank.id}>{bank.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">练习题数</label>
            <input
              type="number"
              min={1}
              max={200}
              value={practiceCount}
              onChange={(e) => setPracticeCount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={startPractice}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              随机练错题
            </button>
            <button
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || total === 0}
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={18} />
              清空
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          当前筛选：{currentBankName}，共 {total} 道错题
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-500 dark:text-gray-400">加载中...</span>
        </div>
      ) : total === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">错题本暂无题目</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {TYPE_LABELS[item.question?.type] || '题目'}
                        </span>
                        <span className="text-xs text-gray-400 ml-auto">
                          错 {item.wrongCount} 次 / 对 {item.correctCount} 次
                        </span>
                      </div>

                      <div className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                        <CodeAwareText text={item.question?.content} />
                      </div>

                      {item.question?.analysis && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <CodeAwareText text={item.question.analysis} className="bg-transparent p-0" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemoveItem(item.questionId)}
                        disabled={removingId === item.questionId}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="移除"
                      >
                        {removingId === item.questionId ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const next = page - 1;
                  setPage(next);
                  loadItems(selectedBankId, next);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                上一页
              </button>
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {page} / {totalPages}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  loadItems(selectedBankId, next);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        onConfirm={handleClear}
        title="清空错题本"
        message={selectedBankId ? '确定要清空该题库下的全部错题吗？' : '确定要清空全部题库的错题吗？'}
        confirmText="清空"
        type="danger"
        loading={loading}
      />
    </div>
  );
};

export default WrongBook;
