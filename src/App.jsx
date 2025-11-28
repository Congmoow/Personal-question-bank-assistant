import React, { useState, useEffect, useRef } from 'react';
import { PlusCircle, Trash2, Eye, EyeOff, Search, BookOpen, ChevronLeft, Folder, Edit2, Shuffle, X, Download, Upload, Check, Save, Sun, Moon } from 'lucide-react';

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-8 w-16 items-center rounded-full border transition-colors ${
        isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-200 border-slate-300'
      }`}
    >
      <span className="sr-only">切换明暗模式</span>
      <span
        className={`inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow-md transition-transform ${
          isDark ? 'translate-x-8' : 'translate-x-1'
        }`}
      >
        {isDark ? (
          <Moon className="w-4 h-4 text-slate-700" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400" />
        )}
      </span>
    </button>
  );
}

// --- 组件：题目管理页 (原功能) ---
function QuestionManager({ bank, onBack, onUpdateBank, theme, onToggleTheme }) {
  const [questions, setQuestions] = useState(bank.questions || []);
  // 编辑模式状态：null 表示新增模式，string (ID) 表示正在编辑该题
  const [editingId, setEditingId] = useState(null);
  
  // 辅助：生成默认选项 A-D
  const getDefaultOptions = () => [
    { key: 'A', text: '', isCorrect: false },
    { key: 'B', text: '', isCorrect: false },
    { key: 'C', text: '', isCorrect: false },
    { key: 'D', text: '', isCorrect: false }
  ];

  // options: [{ key: 'A', text: '...', isCorrect: false }]
  const [newQuestion, setNewQuestion] = useState({ 
    question: '', 
    answer: '', 
    category: '单选题', 
    options: getDefaultOptions() 
  });
  
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAnswers, setShowAnswers] = useState({});
  const [storagePath, setStoragePath] = useState('');
  const fileInputRef = useRef(null);

  // 抽题模式状态
  const [isTesting, setIsTesting] = useState(false);
  const [testQuestion, setTestQuestion] = useState(null);
  const [showTestAnswer, setShowTestAnswer] = useState(false);
  const [testSelectedKeys, setTestSelectedKeys] = useState([]);

  // 随机练习模式状态：一次性打乱题库顺序，按顺序练习
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [showPracticeAnswer, setShowPracticeAnswer] = useState(false);
  const [practiceSelectedKeys, setPracticeSelectedKeys] = useState([]);

  // 当内部 questions 改变时，通知父组件更新整个 bank
  useEffect(() => {
    onUpdateBank({ ...bank, questions });
  }, [questions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const env = window.appEnv;
    if (env && env.isElectron && env.userDataPath) {
      setStoragePath(env.userDataPath);
    } else {
      setStoragePath('浏览器 LocalStorage（仅当前浏览器生效）');
    }
  }, []);

  const QUESTION_TYPES = ['单选题', '多选题', '填空题', '判断题'];
  const categories = ['全部', ...new Set([...QUESTION_TYPES, ...questions.map(q => q.category).filter(Boolean)])];

  // 辅助：是否为选择题
  const isChoiceQuestion = (category) => ['单选题', '多选题'].includes(category);

  // 辅助：是否为判断题
  const isJudgeQuestion = (category) => category === '判断题';

  // 处理选项变化
  const handleOptionChange = (index, field, value) => {
    const updatedOptions = [...newQuestion.options];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };
    
    // 如果是单选题且当前设为正确，则取消其他正确
    if (newQuestion.category === '单选题' && field === 'isCorrect' && value === true) {
      updatedOptions.forEach((opt, i) => {
        if (i !== index) opt.isCorrect = false;
      });
    }
    
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  const addOption = () => {
    const nextKey = String.fromCharCode(65 + (newQuestion.options?.length || 0)); // A, B, C...
    setNewQuestion({
      ...newQuestion,
      options: [...(newQuestion.options || []), { key: nextKey, text: '', isCorrect: false }]
    });
  };

  const removeOption = (index) => {
    const updatedOptions = newQuestion.options.filter((_, i) => i !== index);
    // 重新生成 Key (A, B, C...)
    const rekeyedOptions = updatedOptions.map((opt, i) => ({ ...opt, key: String.fromCharCode(65 + i) }));
    setNewQuestion({ ...newQuestion, options: rekeyedOptions });
  };

  const escapeCsvCell = (value) => {
    if (value == null) return '';
    const s = String(value).replace(/"/g, '""');
    return /[",\r\n]/.test(s) ? `"${s}"` : s;
  };

  const buildCsvContent = (qs) => {
    const headers = ['题型', '题目', '题目答案', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F'];
    const rows = qs.map((q) => {
      const category = q.category || '单选题';
      const questionText = q.question || '';
      const options = Array.isArray(q.options) ? q.options : [];
      const correctFromOptions = options.filter((o) => o.isCorrect).map((o) => o.key);
      const answerText = (correctFromOptions.length ? correctFromOptions.join(';') : (q.answer || ''));
      const optionTexts = [];
      for (let i = 0; i < 6; i += 1) {
        const key = String.fromCharCode(65 + i);
        const found = options.find((o) => o.key === key);
        optionTexts.push(found ? (found.text || '') : '');
      }
      return [category, questionText, answerText, ...optionTexts];
    });
    const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
    return lines.join('\r\n');
  };

  const splitCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  };

  const parseCsvToQuestions = (text) => {
    if (!text) return [];
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length <= 1) return [];
    const [headerLine, ...dataLines] = lines;
    const headers = splitCsvLine(headerLine);
    const idxType = headers.indexOf('题型');
    const idxQuestion = headers.indexOf('题目');
    const idxAnswer = headers.indexOf('题目答案');
    const optionLabels = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F'];
    const optionIdx = optionLabels.map((label) => headers.indexOf(label));

    if (idxQuestion === -1) {
      throw new Error('CSV 中缺少“题目”列表头');
    }

    const parsed = dataLines.map((line) => {
      const cells = splitCsvLine(line);
      const rawCategory = idxType >= 0 ? (cells[idxType] || '').trim() : '单选题';
      let category = rawCategory || '单选题';
      if (!['单选题', '多选题', '填空题', '判断题'].includes(category)) {
        category = '单选题';
      }
      const questionText = (cells[idxQuestion] || '').trim();
      const rawAnswer = idxAnswer >= 0 ? (cells[idxAnswer] || '').trim() : '';
      const options = [];

      optionIdx.forEach((colIdx, i) => {
        if (colIdx >= 0) {
          const textCell = (cells[colIdx] || '').trim();
          if (textCell) {
            const key = String.fromCharCode(65 + i);
            options.push({ key, text: textCell, isCorrect: false });
          }
        }
      });

      let answer = rawAnswer;
      if (category === '单选题' || category === '多选题') {
        const keys = rawAnswer
          .split(/[;,、，；\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (keys.length && options.length) {
          options.forEach((o) => {
            o.isCorrect = keys.includes(o.key);
          });
          answer = keys.join('、');
        }
      }

      if (!questionText) {
        return null;
      }

      const isChoice = isChoiceQuestion(category);

      return {
        question: questionText,
        answer: answer || (isJudgeQuestion(category) ? '正确' : ''),
        category,
        options: isChoice ? (options.length ? options : getDefaultOptions()) : options,
      };
    });

    return parsed.filter(Boolean);
  };

  const handleExportCsv = () => {
    if (!questions || questions.length === 0) {
      alert('当前题库没有题目，无法导出 CSV');
      return;
    }
    if (typeof window === 'undefined') return;
    const csv = buildCsvContent(questions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const datePart = new Date().toISOString().slice(0, 10);
    link.download = `${bank.title || '题库'}_${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCsvClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportCsv = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target.result || '');
        const imported = parseCsvToQuestions(text);
        if (!imported.length) {
          alert('CSV 中没有有效的题目数据');
          return;
        }
        const withIds = imported.map((q) => ({
          ...q,
          id: `${Date.now().toString()}_${Math.random().toString(36).slice(2, 8)}`,
        }));
        setQuestions((prev) => [...withIds, ...prev]);
        alert(`成功导入 ${withIds.length} 道题目`);
      } catch (err) {
        console.error(err);
        alert('导入失败：请检查 CSV 格式是否正确');
      } finally {
        // 允许再次选择同一个文件
        e.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // 处理提交（新增或更新）
  const handleSubmit = (e) => {
    e.preventDefault();
    // 基础校验
    if (!newQuestion.question) {
      alert('请输入题目描述');
      return;
    }

    // 根据题型构建最终数据
    let finalQuestion = { ...newQuestion };
    
    if (isChoiceQuestion(newQuestion.category)) {
      if (!newQuestion.options || newQuestion.options.length < 2) {
        alert('选择题至少需要2个选项');
        return;
      }
      // 自动生成答案文本（用于显示和搜索）
      const correctOptions = newQuestion.options.filter(o => o.isCorrect);
      if (correctOptions.length === 0) {
        alert('请至少标记一个正确选项');
        return;
      }
      finalQuestion.answer = correctOptions.map(o => o.key).join('、'); // 例如 "A、C"
    } else {
      // 判断题或填空题
      if (!newQuestion.answer) {
        alert(isJudgeQuestion(newQuestion.category) ? '请选择正确或错误' : '请输入答案/解析');
        return;
      }
    }

    if (editingId) {
      // 更新现有题目
      setQuestions(questions.map(q => q.id === editingId ? { ...q, ...finalQuestion, id: editingId } : q));
      setEditingId(null);
    } else {
      // 新增题目
      const question = {
        id: Date.now().toString(),
        ...finalQuestion,
        category: newQuestion.category || '单选题'
      };
      setQuestions([question, ...questions]);
    }
    // 重置表单
    setNewQuestion({ question: '', answer: '', category: '单选题', options: getDefaultOptions() });
  };

  // 点击编辑按钮
  const handleEdit = (question) => {
    setEditingId(question.id);
    setNewQuestion({ 
      question: question.question, 
      answer: question.answer, 
      category: question.category,
      options: question.options || getDefaultOptions() // 兼容旧数据，如果没有options则给默认
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setNewQuestion({ question: '', answer: '', category: '单选题', options: getDefaultOptions() });
  };

  // ... (保持 handleDelete, startTest, nextTestQuestion 等逻辑不变)
  const handleDelete = (id) => {
    if (window.confirm('确定要删除这道题吗？')) {
      setQuestions(questions.filter(q => q.id !== id));
      if (editingId === id) cancelEdit();
    }
  };
  
  const startTest = () => {
    if (questions.length === 0) {
      alert('题库为空，无法抽题！');
      return;
    }
    // 开始单题抽题时，退出随机练习模式
    setIsPracticeMode(false);
    const randomQ = questions[Math.floor(Math.random() * questions.length)];
    setTestQuestion(randomQ);
    setShowTestAnswer(false);
    setTestSelectedKeys([]);
    setIsTesting(true);
  };

  const nextTestQuestion = () => {
    let nextQ;
    if (questions.length > 1) {
      do {
        nextQ = questions[Math.floor(Math.random() * questions.length)];
      } while (nextQ.id === testQuestion.id);
    } else {
      nextQ = questions[0];
    }
    setTestQuestion(nextQ);
    setShowTestAnswer(false);
    setTestSelectedKeys([]);
  };

  const handleTestOptionClick = (key) => {
    if (!testQuestion || !Array.isArray(testQuestion.options)) return;
    const isMulti = testQuestion.category === '多选题';
    setTestSelectedKeys((prev) => {
      if (isMulti) {
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      }
      return prev.includes(key) ? [] : [key];
    });
  };

  const shuffleQuestionsOnce = () => {
    const arr = [...questions];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const startPractice = () => {
    if (questions.length === 0) {
      alert('题库为空，无法开始随机练习！');
      return;
    }
    const shuffled = shuffleQuestionsOnce();
    setPracticeQuestions(shuffled);
    setPracticeIndex(0);
    setShowPracticeAnswer(false);
    setPracticeSelectedKeys([]);
    setIsPracticeMode(true);
    // 进入随机练习时，关闭抽题模式
    setIsTesting(false);
  };

  const closePractice = () => {
    setIsPracticeMode(false);
    setPracticeQuestions([]);
    setPracticeIndex(0);
    setShowPracticeAnswer(false);
    setPracticeSelectedKeys([]);
  };

  const togglePracticeAnswer = () => {
    setShowPracticeAnswer(prev => !prev);
  };

  const prevPracticeQuestion = () => {
    if (!practiceQuestions.length) return;
    if (practiceIndex === 0) {
      alert('已经是第一题了');
      return;
    }
    setPracticeIndex(practiceIndex - 1);
    setShowPracticeAnswer(false);
    setPracticeSelectedKeys([]);
  };

  const nextPracticeQuestion = () => {
    if (!practiceQuestions.length) return;
    if (practiceIndex >= practiceQuestions.length - 1) {
      alert('已经是最后一题了');
      return;
    }
    setPracticeIndex(practiceIndex + 1);
    setShowPracticeAnswer(false);
    setPracticeSelectedKeys([]);
  };

  const handlePracticeOptionClick = (key) => {
    const current = currentPracticeQuestion;
    if (!current || !Array.isArray(current.options)) return;
    const isMulti = current.category === '多选题';
    setPracticeSelectedKeys((prev) => {
      if (isMulti) {
        return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      }
      return prev.includes(key) ? [] : [key];
    });
  };

  const toggleAnswer = (id) => {
    setShowAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };
  
  // ... (filteredQuestions 逻辑不变)
  const filteredQuestions = questions.filter(q => {
    const matchesCategory = selectedCategory === '全部' || q.category === selectedCategory;
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         q.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentPracticeQuestion = isPracticeMode && practiceQuestions.length > 0
    ? practiceQuestions[practiceIndex]
    : null;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto relative bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* 随机练习模态框 */}
      {isPracticeMode && currentPracticeQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-purple-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Shuffle className="w-6 h-6" /> 随机练习
              </h3>
              <button onClick={closePractice} className="hover:bg-purple-700 p-2 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1">
              <div className="mb-4 text-xs text-gray-500 dark:text-slate-400">
                当前进度：第 {practiceIndex + 1} / {practiceQuestions.length} 题
              </div>
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-purple-100/90 text-purple-900 dark:bg-purple-900/60 dark:text-purple-100 rounded-full text-sm font-medium mb-3">
                  {currentPracticeQuestion.category}
                </span>
                <h2 className="text-2xl font-medium text-gray-800 dark:text-slate-50 leading-relaxed mb-4">
                  {currentPracticeQuestion.question}
                </h2>

                {currentPracticeQuestion.options && currentPracticeQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    {currentPracticeQuestion.options.map(opt => {
                      const isSelected = practiceSelectedKeys.includes(opt.key);
                      const isCorrect = !!opt.isCorrect;
                      const show = showPracticeAnswer;

                      let containerClass = 'bg-gray-50 border-gray-100 dark:bg-slate-800 dark:border-slate-700';
                      let badgeClass = 'bg-white text-gray-500 border dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600';
                      let textClass = 'text-gray-700 dark:text-slate-100';

                      if (!show && isSelected) {
                        containerClass = 'bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-500/60';
                        badgeClass = 'bg-blue-600 text-white border-blue-700';
                        textClass = 'text-blue-900 dark:text-blue-100';
                      }

                      if (show) {
                        if (isSelected && isCorrect) {
                          containerClass = 'bg-green-50 border-green-200 dark:bg-emerald-900/40 dark:border-emerald-500/60';
                          badgeClass = 'bg-green-600 text-white border-green-700';
                          textClass = 'text-green-800 dark:text-emerald-300 font-medium';
                        } else if (isSelected && !isCorrect) {
                          containerClass = 'bg-red-50 border-red-200 dark:bg-red-900/40 dark:border-red-500/60';
                          badgeClass = 'bg-red-600 text-white border-red-700';
                          textClass = 'text-red-800 dark:text-red-200 font-medium';
                        } else if (!isSelected && isCorrect) {
                          containerClass = 'bg-green-50/60 border-green-200 dark:bg-emerald-900/20 dark:border-emerald-500/40';
                          badgeClass = 'bg-green-100 text-green-700 border-green-300 dark:bg-emerald-800 dark:text-emerald-200 dark:border-emerald-500/60';
                          textClass = 'text-green-800 dark:text-emerald-300';
                        }
                      }

                      return (
                        <button
                          type="button"
                          key={opt.key}
                          onClick={() => {!showPracticeAnswer && handlePracticeOptionClick(opt.key);}}
                          className={`w-full text-left p-3 border rounded-lg flex items-start gap-3 transition-colors ${containerClass}`}
                        >
                          <span
                            className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-sm shrink-0 ${badgeClass}`}
                          >
                            {opt.key}
                          </span>
                          <span className={textClass}>
                            {opt.text}
                          </span>
                          {show && isCorrect && <Check className="w-5 h-5 text-green-600 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {showPracticeAnswer ? (
                <div className="bg-green-50 dark:bg-emerald-900/30 border border-green-100 dark:border-emerald-500/50 p-6 rounded-xl animate-fadeIn">
                  <h4 className="text-green-800 dark:text-emerald-300 font-bold mb-2 flex items-center gap-2">
                    <Check className="w-5 h-5" /> 正确答案
                  </h4>
                  <p className="text-gray-700 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {currentPracticeQuestion.answer}
                  </p>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400">
                  ??? 思考一下，点击下方“查看答案” ???
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-xs text-gray-500 dark:text-slate-400">
                提示：随机练习会按照打乱后的顺序依次展示所有题目
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={prevPracticeQuestion}
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  上一题
                </button>
                <button
                  onClick={togglePracticeAnswer}
                  className={`px-3 py-2 rounded-xl text-xs font-medium flex-1 md:flex-none flex items-center justify-center gap-2 ${
                    showPracticeAnswer
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                  }`}
                >
                  {showPracticeAnswer ? <><EyeOff className="w-4 h-4" /> 隐藏答案</> : <><Eye className="w-4 h-4" /> 查看答案</>}
                </button>
                <button
                  onClick={nextPracticeQuestion}
                  className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  下一题
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 抽题模式模态框 */}
      {isTesting && testQuestion && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Shuffle className="w-6 h-6" /> 随机测试
              </h3>
              <button onClick={() => setIsTesting(false)} className="hover:bg-blue-700 p-2 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 bg-blue-100/90 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100 rounded-full text-sm font-medium mb-3">
                  {testQuestion.category}
                </span>
                <h2 className="text-2xl font-medium text-gray-800 dark:text-slate-50 leading-relaxed mb-4">
                  {testQuestion.question}
                </h2>
                
                {/* 如果是选择题，显示选项，可点击作答 */}
                {testQuestion.options && testQuestion.options.length > 0 && (
                  <div className="space-y-2">
                    {testQuestion.options.map(opt => {
                      const isSelected = testSelectedKeys.includes(opt.key);
                      const isCorrect = !!opt.isCorrect;
                      const show = showTestAnswer;

                      let containerClass = 'bg-gray-50 border-gray-100 dark:bg-slate-800 dark:border-slate-700';
                      let badgeClass = 'bg-white text-gray-500 border dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600';
                      let textClass = 'text-gray-700 dark:text-slate-100';

                      if (!show && isSelected) {
                        containerClass = 'bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-500/60';
                        badgeClass = 'bg-blue-600 text-white border-blue-700';
                        textClass = 'text-blue-900 dark:text-blue-100';
                      }

                      if (show) {
                        if (isSelected && isCorrect) {
                          containerClass = 'bg-green-50 border-green-200 dark:bg-emerald-900/40 dark:border-emerald-500/60';
                          badgeClass = 'bg-green-600 text-white border-green-700';
                          textClass = 'text-green-800 dark:text-emerald-300 font-medium';
                        } else if (isSelected && !isCorrect) {
                          containerClass = 'bg-red-50 border-red-200 dark:bg-red-900/40 dark:border-red-500/60';
                          badgeClass = 'bg-red-600 text-white border-red-700';
                          textClass = 'text-red-800 dark:text-red-200 font-medium';
                        } else if (!isSelected && isCorrect) {
                          containerClass = 'bg-green-50/60 border-green-200 dark:bg-emerald-900/20 dark:border-emerald-500/40';
                          badgeClass = 'bg-green-100 text-green-700 border-green-300 dark:bg-emerald-800 dark:text-emerald-200 dark:border-emerald-500/60';
                          textClass = 'text-green-800 dark:text-emerald-300';
                        }
                      }

                      return (
                        <button
                          type="button"
                          key={opt.key}
                          onClick={() => {!showTestAnswer && handleTestOptionClick(opt.key);}}
                          className={`w-full text-left p-3 border rounded-lg flex items-start gap-3 transition-colors ${containerClass}`}
                        >
                          <span
                            className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-sm shrink-0 ${badgeClass}`}
                          >
                            {opt.key}
                          </span>
                          <span className={textClass}>
                            {opt.text}
                          </span>
                          {show && isCorrect && <Check className="w-5 h-5 text-green-600 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {showTestAnswer ? (
                <div className="bg-green-50 dark:bg-emerald-900/30 border border-green-100 dark:border-emerald-500/50 p-6 rounded-xl animate-fadeIn">
                  <h4 className="text-green-800 dark:text-emerald-300 font-bold mb-2 flex items-center gap-2">
                    <Check className="w-5 h-5" /> 正确答案
                  </h4>
                  <p className="text-gray-700 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                    {testQuestion.answer}
                  </p>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-400">
                  ??? 思考一下，点击下方查看答案 ???
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex gap-4">
              <button 
                onClick={() => setShowTestAnswer(!showTestAnswer)}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors flex justify-center items-center gap-2 ${showTestAnswer ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}
              >
                {showTestAnswer ? <><EyeOff className="w-5 h-5" /> 隐藏答案</> : <><Eye className="w-5 h-5" /> 查看答案</>}
              </button>
              <button 
                onClick={nextTestQuestion}
                className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-100 py-3 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 transition-all flex justify-center items-center gap-2"
              >
                <Shuffle className="w-5 h-5" /> 下一题
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors text-gray-600 dark:text-slate-200"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2">
              {bank.title}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm">题库ID: {bank.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button 
            onClick={startTest}
            className="flex-1 md:flex-none bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Shuffle className="w-5 h-5" /> 随机抽题
          </button>
          <button
            onClick={startPractice}
            className="hidden sm:inline-flex bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-100 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-all items-center gap-2"
          >
            <BookOpen className="w-4 h-4" /> 随机练习
          </button>
          <div className="hidden md:block text-sm text-gray-500 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700">
            共 <span className="font-bold text-blue-600 text-lg">{questions.length}</span> 题
          </div>
        </div>
      </header>

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-gray-500 dark:text-slate-400">
        <div className="truncate">
          <span className="font-medium">数据存储位置：</span>
          <span className="font-mono break-all">{storagePath || '获取中...'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-100 text-xs flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3 h-3" /> 导出 CSV
          </button>
          <button
            type="button"
            onClick={handleImportCsvClick}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-100 text-xs flex items-center gap-1 hover:bg-gray-50 dark:hover:bg-slate-800"
          >
            <Upload className="w-3 h-3" /> 导入 CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportCsv}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：添加/编辑表单 */}
        <div className="lg:col-span-1">
          <div className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md sticky top-8 border ${editingId ? 'border-orange-200 ring-2 ring-orange-100' : 'border-gray-100 dark:border-slate-700'}`}>
            <h2 className={`text-xl font-semibold mb-4 flex items-center gap-2 ${editingId ? 'text-orange-600' : 'text-gray-800 dark:text-slate-50'}`}>
              {editingId ? <><Edit2 className="w-5 h-5" /> 编辑题目</> : <><PlusCircle className="w-5 h-5 text-green-600" /> 添加新题目</>}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">题目类型</label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => {
                     const newType = e.target.value;
                     const isChoice = isChoiceQuestion(newType);
                     setNewQuestion(prev => ({ 
                       ...prev, 
                       category: newType,
                       // 如果切换到选择题且没有选项，则填充默认A-D；如果切到非选择题，保留选项数据也没关系，或者清空
                       options: isChoice && (!prev.options || prev.options.length === 0) ? getDefaultOptions() : (prev.options || [])
                     }));
                  }}
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white dark:bg-slate-900 dark:text-slate-100"
                >
                  {QUESTION_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">题目描述</label>
                <textarea
                  value={newQuestion.question}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24 bg-white dark:bg-slate-900 dark:text-slate-100"
                  placeholder="请输入题目..."
                  required
                />
              </div>

              {/* 动态渲染：如果是选择题，显示选项编辑器；如果是判断题，显示开关；否则显示普通文本框 */}
              {isChoiceQuestion(newQuestion.category) ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">选项设置 <span className="text-xs text-gray-400 dark:text-slate-400 font-normal">(勾选即为正确答案)</span></label>
                  {newQuestion.options?.map((opt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOptionChange(index, 'isCorrect', !opt.isCorrect)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${opt.isCorrect ? 'bg-green-500 text-white border-green-600' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-500'}`}
                        title={opt.isCorrect ? "正确答案" : "点击设为正确答案"}
                      >
                        {opt.key}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                        className={`flex-1 p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm ${opt.isCorrect ? 'border-green-500 bg-green-50 dark:bg-emerald-900/40 dark:border-emerald-500/70 dark:text-slate-100' : 'border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}
                        placeholder={`选项 ${opt.key} 内容`}
                        required
                      />
                      <button type="button" onClick={() => removeOption(index)} className="text-gray-300 hover:text-red-500 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={addOption}
                    className="w-full py-2 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-lg text-gray-500 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm flex justify-center items-center gap-1"
                  >
                    <PlusCircle className="w-4 h-4" /> 添加选项
                  </button>
                </div>
              ) : isJudgeQuestion(newQuestion.category) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2">正确答案</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setNewQuestion({ ...newQuestion, answer: '正确' })}
                      className={`flex-1 py-3 rounded-xl border font-medium flex items-center justify-center gap-2 transition-all ${newQuestion.answer === '正确' ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-500' : 'bg-white border-gray-200 text-gray-500 hover:border-green-300 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}
                    >
                      <Check className="w-5 h-5" /> 正确
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewQuestion({ ...newQuestion, answer: '错误' })}
                      className={`flex-1 py-3 rounded-xl border font-medium flex items-center justify-center gap-2 transition-all ${newQuestion.answer === '错误' ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200 dark:bg-red-900/40 dark:text-red-200 dark:border-red-500' : 'bg-white border-gray-200 text-gray-500 hover:border-red-300 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300'}`}
                    >
                      <X className="w-5 h-5" /> 错误
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">答案/解析</label>
                  <textarea
                    value={newQuestion.answer}
                    onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24 bg-white dark:bg-slate-900 dark:text-slate-100"
                    placeholder="请输入答案..."
                    required
                  />
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button type="submit" className={`flex-1 text-white py-3 rounded-lg transition-colors font-medium flex justify-center items-center gap-2 shadow-lg ${editingId ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
                  {editingId ? <><Save className="w-5 h-5" /> 保存修改</> : <><PlusCircle className="w-5 h-5" /> 保存题目</>}
                </button>
                {editingId && (
                  <button 
                    type="button" 
                    onClick={cancelEdit}
                    className="px-4 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>


        {/* 右侧：题目列表 */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索题目..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-4">
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                <div className="text-gray-400 dark:text-slate-500 mb-2">📭</div>
                <p className="text-gray-500 dark:text-slate-300">暂无题目，快去添加一个吧！</p>
              </div>
            ) : (
              filteredQuestions.map(q => (
                <div key={q.id} className={`bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border transition-all group ${editingId === q.id ? 'border-orange-300 ring-1 ring-orange-100 bg-orange-50/30' : 'border-gray-100 dark:border-slate-700 hover:shadow-md'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-md font-medium ${editingId === q.id ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{q.category}</span>
                        <span className="text-gray-400 dark:text-slate-500 text-xs">{new Date(parseInt(q.id)).toLocaleDateString()}</span>
                        {editingId === q.id && <span className="text-xs text-orange-600 font-bold animate-pulse">正在编辑...</span>}
                      </div>
                      <h3 className="text-lg font-medium text-gray-800 dark:text-slate-50 leading-relaxed">{q.question}</h3>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleEdit(q)} className="text-gray-300 hover:text-blue-500 transition-colors p-2 hover:bg-blue-50 rounded-lg" title="编辑">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(q.id)} className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 如果有选项，始终显示选项列表（仅题目，不含答案） */}
                  {q.options && q.options.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {q.options.map(opt => (
                        <div key={opt.key} className={`p-2 rounded-lg border flex items-center gap-3 text-sm ${showAnswers[q.id] && opt.isCorrect ? 'bg-green-50 border-green-200 dark:bg-emerald-900/40 dark:border-emerald-500/60' : 'bg-gray-50 border-transparent dark:bg-slate-800 dark:border-slate-700'}`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${showAnswers[q.id] && opt.isCorrect ? 'bg-green-500 text-white border-green-600' : 'bg-white text-gray-500 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600'}`}>
                            {opt.key}
                          </span>
                          <span className={showAnswers[q.id] && opt.isCorrect ? 'text-green-700 dark:text-emerald-300 font-medium' : 'text-gray-600 dark:text-slate-200'}>{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700">
                    {showAnswers[q.id] ? (
                      <div className="animate-fadeIn">
                        <div className="flex items-center gap-2 text-green-600 font-medium mb-2"><Eye className="w-4 h-4" /> 答案：</div>
                        
                        {/* 如果是纯文本答案，显示文本；如果是选择题，上面的选项已经高亮了，这里只显示结论 */}
                        <p className="text-gray-600 dark:text-slate-100 bg-gray-50 dark:bg-slate-900 p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                          {q.answer}
                        </p>

                        <button onClick={() => toggleAnswer(q.id)} className="mt-3 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" /> 隐藏答案
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => toggleAnswer(q.id)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 px-4 py-2 rounded-lg transition-colors w-fit">
                        <Eye className="w-4 h-4" /> 查看答案
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- 组件：题库列表页 (首页) ---
function BankList({ banks, onSelectBank, onCreateBank, onDeleteBank, theme, onToggleTheme }) {
  const [newBankTitle, setNewBankTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newBankTitle.trim()) return;
    onCreateBank(newBankTitle);
    setNewBankTitle('');
    setIsCreating(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-4xl font-bold text-blue-600 flex items-center justify-center md:justify-start gap-3 mb-2">
            <BookOpen className="w-10 h-10" />
            我的题库集合
          </h1>
          <p className="text-gray-500 dark:text-slate-300">集中管理你的所有知识库</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">明 / 暗</span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 创建新题库卡片 */}
        <div 
          className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-center items-center min-h-[200px] group"
          onClick={() => !isCreating && setIsCreating(true)}
        >
          {isCreating ? (
            <form onSubmit={handleCreate} className="w-full" onClick={e => e.stopPropagation()}>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2 text-center">输入题库名称</label>
              <input
                autoFocus
                type="text"
                value={newBankTitle}
                onChange={e => setNewBankTitle(e.target.value)}
                className="w-full p-2 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3 text-center bg-white dark:bg-slate-900 dark:text-slate-100"
                placeholder="例如：期末复习"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700">创建</button>
                <button type="button" onClick={() => setIsCreating(false)} className="flex-1 bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-200 py-2 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-slate-700">取消</button>
              </div>
            </form>
          ) : (
            <>
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 dark:text-slate-200">创建新题库</h3>
            </>
          )}
        </div>

        {/* 现有题库列表 */}
        {banks.map(bank => (
          <div 
            key={bank.id}
            onClick={() => onSelectBank(bank.id)}
            className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer relative group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <Folder className="w-8 h-8 text-amber-500" />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteBank(bank.id); }}
                className="text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除题库"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-50 mb-2">{bank.title}</h3>
            <p className="text-gray-500 dark:text-slate-300 text-sm mb-4 line-clamp-2">{bank.description || '暂无描述'}</p>
            <div className="flex items-center justify-between text-sm text-gray-400 dark:text-slate-400 border-t border-gray-100 dark:border-slate-700 pt-4">
              <span>{new Date(parseInt(bank.id)).toLocaleDateString()}</span>
              <span className="bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-600 dark:text-slate-100 font-medium">
                {bank.questions?.length || 0} 题
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- 主程序 ---
export default function App() {
  // 数据结构：Array<{ id: string, title: string, questions: Array, ... }>
  const [banks, setBanks] = useState(() => {
    const savedBanks = localStorage.getItem('questionBanks');
    if (savedBanks) return JSON.parse(savedBanks);

    // 迁移旧数据逻辑：如果发现旧的 'questionBank' 数据，将其自动转为一个默认题库
    const oldQuestions = localStorage.getItem('questionBank');
    if (oldQuestions) {
      try {
        const parsed = JSON.parse(oldQuestions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [{
            id: Date.now().toString(),
            title: '我的默认题库',
            questions: parsed,
            description: '从旧版本自动迁移的数据'
          }];
        }
      } catch (e) {
        console.error("Migration failed", e);
      }
    }
    return [];
  });

  const [activeBankId, setActiveBankId] = useState(null);

  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('questionBank-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('questionBanks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('questionBank-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleCreateBank = (title) => {
    const newBank = {
      id: Date.now().toString(),
      title,
      questions: [],
      description: '新创建的题库'
    };
    setBanks([newBank, ...banks]);
  };

  const handleDeleteBank = (id) => {
    if (window.confirm('删除题库将清空其中的所有题目，确定继续吗？')) {
      setBanks(banks.filter(b => b.id !== id));
      if (activeBankId === id) setActiveBankId(null);
    }
  };

  const handleUpdateBank = (updatedBank) => {
    setBanks(banks.map(b => b.id === updatedBank.id ? updatedBank : b));
  };

  const handleImportBanks = (importedBanks) => {
    // 简单的合并策略：保留所有现有题库，追加导入的题库（重新生成ID以防冲突，或者直接覆盖）
    // 这里我们选择：如果 ID 冲突则跳过，否则追加
    const currentIds = new Set(banks.map(b => b.id));
    const newBanks = importedBanks.filter(b => !currentIds.has(b.id));
    
    if (newBanks.length === 0) {
      alert('所有导入的题库ID已存在，没有新增内容。');
      return;
    }
    
    setBanks([...banks, ...newBanks]);
    alert(`成功导入 ${newBanks.length} 个新题库！`);
  };

  // 视图渲染
  if (activeBankId) {
    const activeBank = banks.find(b => b.id === activeBankId);
    if (!activeBank) {
      setActiveBankId(null); // 容错处理
      return null;
    }
    return (
      <QuestionManager 
        bank={activeBank} 
        onBack={() => setActiveBankId(null)}
        onUpdateBank={handleUpdateBank}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <BankList 
      banks={banks} 
      onSelectBank={setActiveBankId} 
      onCreateBank={handleCreateBank}
      onDeleteBank={handleDeleteBank}
      onImportBanks={handleImportBanks}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}
