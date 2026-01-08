import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Trash2,
  Save,
  FileText,
  Code,
  Wand2
} from 'lucide-react';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import api from '../api';

// 模式切换标签
const MODE_TABS = [
  { id: 'ai', label: 'AI 智能解析', icon: Wand2 },
  { id: 'json', label: 'JSON 批量导入', icon: Code }
];

// 题型标签
const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题'
};

// 题型颜色
const TYPE_COLORS = {
  single: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  multiple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  boolean: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  fill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  short: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
};

const AiImport = () => {
  const { banks, fetchBanks } = useQuestionBanks();
  const [selectedBankId, setSelectedBankId] = useState(null);
  
  const [mode, setMode] = useState('ai'); // 'ai' | 'json'
  const [inputText, setInputText] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  // 检查是否配置了 API Key
  useEffect(() => {
    const checkApiConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setHasApiKey(!!config.apiKey);
      } catch (error) {
        console.error('检查 API 配置失败:', error);
      }
    };
    checkApiConfig();
  }, []);

  // 加载题库列表
  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  // AI 解析题目
  const handleParse = async () => {
    if (!inputText.trim()) {
      setError('请输入要解析的题目内容');
      return;
    }

    setParsing(true);
    setError(null);
    setParsedQuestions([]);
    setImportResult(null);

    try {
      const result = await api.ai.parseQuestions(inputText);
      if (result.questions && result.questions.length > 0) {
        setParsedQuestions(result.questions);
      } else {
        setError('未能识别出有效的题目，请检查输入内容格式');
      }
    } catch (error) {
      setError(error.message || 'AI 解析失败，请稍后重试');
    } finally {
      setParsing(false);
    }
  };

  // 删除单个解析结果
  const handleRemoveQuestion = (index) => {
    setParsedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // 导入题目到题库
  const handleImport = async () => {
    if (!selectedBankId) {
      setError('请先选择目标题库');
      return;
    }

    if (parsedQuestions.length === 0) {
      setError('没有可导入的题目');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (let i = 0; i < parsedQuestions.length; i++) {
        try {
          await api.question.create({
            bankId: selectedBankId,
            ...parsedQuestions[i]
          });
          successCount++;
        } catch (err) {
          failCount++;
          errors.push({ index: i, message: err.message });
        }
      }

      setImportResult({
        success: successCount,
        failed: failCount,
        errors
      });

      if (successCount > 0) {
        // 清空已成功导入的题目
        if (failCount === 0) {
          setParsedQuestions([]);
          setInputText('');
        } else {
          // 只保留失败的题目
          const failedIndices = errors.map(e => e.index);
          setParsedQuestions(prev => prev.filter((_, i) => failedIndices.includes(i)));
        }
        fetchBanks();
      }
    } catch (error) {
      setError(error.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 清空所有
  const handleClear = () => {
    setInputText('');
    setJsonInput('');
    setParsedQuestions([]);
    setError(null);
    setImportResult(null);
  };

  // JSON 解析
  const handleJsonParse = () => {
    if (!jsonInput.trim()) {
      setError('请输入 JSON 格式的题目数据');
      return;
    }

    setError(null);
    setParsedQuestions([]);
    setImportResult(null);

    try {
      let data = JSON.parse(jsonInput.trim());
      
      // 支持单个对象或数组
      if (!Array.isArray(data)) {
        data = [data];
      }

      // 转换并验证数据格式
      const questions = data.map((item, index) => {
        // 支持中文字段名映射
        const type = item.type || item.题型 || 'short';
        const content = item.content || item.题目 || item.question || '';
        // 使用 ?? 运算符处理布尔值 false 的情况
        const answer = item.answer ?? item.答案 ?? '';
        const analysis = item.analysis || item.解析 || '';
        const options = item.options || item.选项 || null;

        // 题型映射
        const typeMap = {
          '单选题': 'single', '单选': 'single', 'single': 'single',
          '多选题': 'multiple', '多选': 'multiple', 'multiple': 'multiple',
          '判断题': 'boolean', '判断': 'boolean', 'boolean': 'boolean',
          '填空题': 'fill', '填空': 'fill', 'fill': 'fill',
          '简答题': 'short', '简答': 'short', 'short': 'short'
        };

        const normalizedType = typeMap[type] || 'short';

        if (!content) {
          throw new Error(`第 ${index + 1} 道题目缺少题目内容`);
        }

        // 处理选项格式
        let normalizedOptions = null;
        if (options && (normalizedType === 'single' || normalizedType === 'multiple')) {
          if (Array.isArray(options)) {
            normalizedOptions = options.map((opt, i) => {
              if (typeof opt === 'string') {
                // "A. xxx" 格式或纯文本
                const match = opt.match(/^([A-Z])[.、．]\s*(.+)$/);
                if (match) {
                  return { id: match[1], text: match[2] };
                }
                return { id: String.fromCharCode(65 + i), text: opt };
              }
              return opt;
            });
          }
        }

        // 处理答案格式
        let normalizedAnswer = String(answer);
        
        // 多选题答案处理：支持多种分隔符格式
        if (normalizedType === 'multiple') {
          if (Array.isArray(answer)) {
            // 数组格式：["A", "B", "C"] -> "A|B|C"
            normalizedAnswer = answer.join('|');
          } else if (typeof answer === 'string') {
            // 字符串格式：支持 "A,B,C" "A、B、C" "ABC" "A B C" 等格式转换为 "A|B|C"
            normalizedAnswer = answer
              .replace(/[,，、\s]+/g, '|')  // 替换各种分隔符为 |
              .split('')
              .filter(c => /[A-Za-z|]/.test(c))  // 只保留字母和 |
              .join('')
              .toUpperCase()
              .split('|')
              .filter(Boolean)
              .join('|');
            
            // 如果没有分隔符，可能是连续字母如 "ABC"
            if (!normalizedAnswer.includes('|') && normalizedAnswer.length > 1) {
              normalizedAnswer = normalizedAnswer.split('').join('|');
            }
          }
        }
        
        // 填空题答案处理：支持多种分隔符格式
        if (normalizedType === 'fill') {
          // 检查题干是否包含空栏标记（连续下划线算一个空）
          const blankCount = (content.match(/_{2,}/g) || []).length;
          if (blankCount === 0) {
            throw new Error(`第 ${index + 1} 道填空题题干必须包含空栏标记（__或更多下划线）`);
          }

          if (Array.isArray(answer)) {
            // 数组格式：["答案1", "答案2"] -> "答案1|答案2"
            normalizedAnswer = answer.join('|');
          } else if (typeof answer === 'string') {
            // 只有多个空栏时才尝试分割答案
            // 单个空栏时保持原答案不变，避免误分割含逗号的答案
            if (blankCount > 1 && !answer.includes('|')) {
              normalizedAnswer = answer.replace(/[,，、;；]+/g, '|');
            }
          }

          // 验证答案数量与空栏数量是否匹配
          const answerCount = normalizedAnswer.split('|').length;
          if (answerCount !== blankCount) {
            throw new Error(`第 ${index + 1} 道填空题答案数量(${answerCount})与空栏数量(${blankCount})不匹配`);
          }
        }
        
        // 判断题答案处理
        if (normalizedType === 'boolean') {
          const trueValues = ['正确', '对', 'true', 'True', 'TRUE', '是', 'yes', 'Yes', 'YES', '√', '1'];
          const falseValues = ['错误', '错', 'false', 'False', 'FALSE', '否', 'no', 'No', 'NO', '×', '0'];
          
          // 支持布尔值类型
          if (answer === true || trueValues.includes(String(answer).trim())) {
            normalizedAnswer = '正确';
          } else if (answer === false || falseValues.includes(String(answer).trim())) {
            normalizedAnswer = '错误';
          }
        }

        return {
          type: normalizedType,
          content,
          answer: normalizedAnswer,
          analysis,
          ...(normalizedOptions && { options: normalizedOptions })
        };
      });

      if (questions.length === 0) {
        setError('未能解析出有效的题目');
        return;
      }

      setParsedQuestions(questions);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 格式错误，请检查语法');
      } else {
        setError(err.message || '解析失败');
      }
    }
  };

  // 切换模式时清空
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setError(null);
    setImportResult(null);
    setParsedQuestions([]);
  };

  // 未配置 API Key 时，自动切换到 JSON 模式
  useEffect(() => {
    if (!hasApiKey && mode === 'ai') {
      setMode('json');
    }
  }, [hasApiKey, mode]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI 智能录入</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {mode === 'ai' 
            ? '粘贴题目文本，AI 将自动识别题型并解析为结构化数据'
            : '粘贴 JSON 格式的题目数据，直接批量导入'}
        </p>
      </div>

      {/* 模式切换标签 */}
      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
        {MODE_TABS.map(tab => {
          const isDisabled = tab.id === 'ai' && !hasApiKey;
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && handleModeChange(tab.id)}
              disabled={isDisabled}
              title={isDisabled ? '请先在设置中配置 API Key' : ''}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === tab.id
                  ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                  : isDisabled
                    ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {isDisabled && <span className="text-xs">(需配置API)</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：输入区域 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {mode === 'ai' ? '输入题目文本' : '输入 JSON 数据'}
            </label>
            <span className="text-xs text-gray-400">
              支持单选、多选、判断、填空、简答题
            </span>
          </div>
          
          {mode === 'ai' ? (
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`请粘贴题目内容，例如：

1. 以下哪个是JavaScript的基本数据类型？
A. String
B. Array
C. Object
D. Function
答案：A
解析：String是JavaScript的基本数据类型

2. React是一个前端框架。（判断题）
答案：正确

3. HTML的全称是___。
答案：HyperText Markup Language`}
              className="w-full h-80 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none font-mono text-sm"
            />
          ) : (
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`请粘贴 JSON 格式的题目数据，支持以下格式：

单选题：
{"题型": "单选题", "题目": "...", "选项": ["A. xxx", "B. xxx"], "答案": "A"}

多选题（答案支持多种格式）：
{"题型": "多选题", "题目": "...", "选项": ["A. xxx", "B. xxx", "C. xxx"], "答案": "A|B"}
{"题型": "多选题", "题目": "...", "选项": [...], "答案": ["A", "B"]}
{"题型": "多选题", "题目": "...", "选项": [...], "答案": "AB"}

判断题：
{"题型": "判断题", "题目": "...", "答案": "正确"}

填空题（多个空用|分隔或数组）：
{"题型": "填空题", "题目": "___是中国首都", "答案": "北京"}
{"题型": "填空题", "题目": "___和___是直辖市", "答案": "北京|上海"}
{"题型": "填空题", "题目": "...", "答案": ["答案1", "答案2"]}

简答题：
{"题型": "简答题", "题目": "...", "答案": "..."}

也支持英文字段名：type, content/question, options, answer, analysis`}
              className="w-full h-80 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none font-mono text-sm"
            />
          )}

          <div className="flex gap-3">
            {mode === 'ai' ? (
              <button
                onClick={handleParse}
                disabled={parsing || !inputText.trim()}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {parsing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    AI 解析中...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    AI 智能解析
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleJsonParse}
                disabled={!jsonInput.trim()}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Code size={18} />
                解析 JSON
              </button>
            )}
            <button
              onClick={handleClear}
              disabled={parsing}
              className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              清空
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
              <XCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* 右侧：解析结果 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              解析结果 {parsedQuestions.length > 0 && `(${parsedQuestions.length} 道题目)`}
            </label>
            
            {parsedQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedBankId || ''}
                  onChange={(e) => setSelectedBankId(Number(e.target.value) || null)}
                  className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">选择题库</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>{bank.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="h-80 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
            {parsedQuestions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FileText size={48} className="mb-3 opacity-50" />
                <p>解析结果将显示在这里</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {parsedQuestions.map((question, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[question.type]}`}>
                            {TYPE_LABELS[question.type] || question.type}
                          </span>
                          <span className="text-xs text-gray-400">#{index + 1}</span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                          {question.content}
                        </p>
                        {question.options && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {question.options.map(opt => (
                              <span key={opt.id} className="text-xs text-gray-500 dark:text-gray-400">
                                {opt.id}. {opt.text.substring(0, 15)}{opt.text.length > 15 ? '...' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                          答案：{question.answer}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveQuestion(index)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 导入按钮 */}
          {parsedQuestions.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing || !selectedBankId}
              className="w-full px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  导入中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  导入到题库 ({parsedQuestions.length} 道)
                </>
              )}
            </button>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              importResult.failed === 0
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
            }`}>
              <CheckCircle size={18} />
              <span className="text-sm">
                成功导入 {importResult.success} 道题目
                {importResult.failed > 0 && `，${importResult.failed} 道失败`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiImport;
