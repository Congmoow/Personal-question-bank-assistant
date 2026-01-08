import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Dialog from './Dialog';

/**
 * @typedef {import('../api').Question} Question
 * @typedef {import('../api').QuestionOption} QuestionOption
 * @typedef {import('../api').QuestionType} QuestionType
 */

const typeOptions = [
  { value: 'single', label: '单选题' },
  { value: 'multiple', label: '多选题' },
  { value: 'boolean', label: '判断题' },
  { value: 'fill', label: '填空题' },
  { value: 'short', label: '简答题' },
];

/**
 * 题目编辑对话框
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   question: Question,
 *   onSave: (data: Partial<Question>) => Promise<void>,
 *   loading?: boolean
 * }} props
 */
const QuestionEditDialog = ({ open, onClose, question, onSave, loading = false }) => {
  const [type, setType] = useState(question?.type || 'single');
  const [content, setContent] = useState(question?.content || '');
  const [options, setOptions] = useState(question?.options || []);
  const [answer, setAnswer] = useState(question?.answer || '');
  const [fillAnswers, setFillAnswers] = useState([]);
  const [analysis, setAnalysis] = useState(question?.analysis || '');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const blankCount = useMemo(() => {
    if (type !== 'fill') return 0;
    return (content.match(/_{2,}/g) || []).length;
  }, [type, content]);

  // 当 question 变化时重置表单
  useEffect(() => {
    if (question) {
      setType(question.type || 'single');
      setContent(question.content || '');
      setOptions(question.options || []);
      setAnswer(question.answer || '');
      if (question.type === 'fill') {
        const bc = (String(question.content || '').match(/_{2,}/g) || []).length;
        const parsed = String(question.answer || '').split('|');
        const next = parsed.map(v => String(v ?? ''));
        while (next.length < bc) next.push('');
        if (next.length > bc) next.length = bc;
        setFillAnswers(next);
      } else {
        setFillAnswers([]);
      }
      setAnalysis(question.analysis || '');
      setErrors({});
    }
  }, [question]);

  useEffect(() => {
    if (type !== 'fill') return;
    setFillAnswers((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      while (next.length < blankCount) next.push('');
      if (next.length > blankCount) next.length = blankCount;
      return next;
    });
  }, [type, blankCount]);

  useEffect(() => {
    if (type !== 'fill') return;
    setAnswer((fillAnswers || []).join('|'));
  }, [type, fillAnswers]);

  // 验证表单
  const validate = () => {
    const newErrors = {};
    
    if (!content.trim()) {
      newErrors.content = '题干内容不能为空';
    }

    if (type === 'single' || type === 'multiple') {
      if (options.length < 2) {
        newErrors.options = '至少需要2个选项';
      }
      if (!answer) {
        newErrors.answer = '请选择正确答案';
      }
    }

    if (type === 'boolean' && !answer) {
      newErrors.answer = '请选择正确答案';
    }

    if (type === 'fill') {
      // 连续下划线算一个空
      const blankCount = (content.match(/_{2,}/g) || []).length;
      const answerCount = answer.split('|').filter(a => a.trim()).length;
      if (blankCount === 0) {
        newErrors.content = '填空题题干中需要包含空栏标记（___）';
      } else if (blankCount !== answerCount) {
        newErrors.answer = `答案数量(${answerCount})与空栏数量(${blankCount})不匹配`;
      }
    }

    if (type === 'short' && !answer.trim()) {
      newErrors.answer = '请填写参考答案';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSave({
        type,
        content: content.trim(),
        options: (type === 'single' || type === 'multiple') ? options : null,
        answer: answer.trim(),
        analysis: analysis.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // 添加选项
  const addOption = () => {
    const nextId = String.fromCharCode(65 + options.length); // A, B, C, D...
    setOptions([...options, { id: nextId, text: '' }]);
  };

  // 删除选项
  const removeOption = (index) => {
    const newOptions = options.filter((_, i) => i !== index);
    // 重新编号
    const reindexed = newOptions.map((opt, i) => ({
      ...opt,
      id: String.fromCharCode(65 + i)
    }));
    setOptions(reindexed);
    // 清除已删除选项的答案
    if (type === 'single') {
      const removedId = options[index].id;
      if (answer === removedId) {
        setAnswer('');
      } else {
        // 更新答案ID
        const answerIndex = options.findIndex(o => o.id === answer);
        if (answerIndex > index) {
          setAnswer(String.fromCharCode(65 + answerIndex - 1));
        }
      }
    } else if (type === 'multiple') {
      const removedId = options[index].id;
      const answerIds = answer.split('|').filter(id => id !== removedId);
      // 更新答案ID
      const newAnswerIds = answerIds.map(id => {
        const oldIndex = options.findIndex(o => o.id === id);
        if (oldIndex > index) {
          return String.fromCharCode(65 + oldIndex - 1);
        }
        return id;
      });
      setAnswer(newAnswerIds.join('|'));
    }
  };

  // 更新选项文本
  const updateOptionText = (index, text) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], text };
    setOptions(newOptions);
  };

  // 处理单选答案
  const handleSingleAnswer = (optionId) => {
    setAnswer(optionId);
  };

  // 处理多选答案
  const handleMultipleAnswer = (optionId) => {
    const currentAnswers = answer ? answer.split('|') : [];
    if (currentAnswers.includes(optionId)) {
      setAnswer(currentAnswers.filter(id => id !== optionId).join('|'));
    } else {
      setAnswer([...currentAnswers, optionId].sort().join('|'));
    }
  };

  // 插入空栏标记
  const insertBlank = () => {
    setContent(content + '___');
  };

  const updateFillAnswer = (index, value) => {
    setFillAnswers((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      next[index] = value;
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="编辑题目" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 题型选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            题型
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setAnswer('');
              if (e.target.value !== 'single' && e.target.value !== 'multiple') {
                setOptions([]);
              } else if (options.length === 0) {
                setOptions([
                  { id: 'A', text: '' },
                  { id: 'B', text: '' },
                  { id: 'C', text: '' },
                  { id: 'D', text: '' },
                ]);
              }
            }}
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* 题干 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              题干 <span className="text-danger">*</span>
            </label>
            {type === 'fill' && (
              <button
                type="button"
                onClick={insertBlank}
                className="text-xs text-primary hover:underline"
              >
                插入空栏
              </button>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder={type === 'fill' ? '请输入题干，使用 ___ 表示空栏' : '请输入题干内容'}
            className={cn(
              "w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none",
              errors.content ? "border-danger" : "border-gray-200 dark:border-gray-600"
            )}
          />
          {errors.content && (
            <p className="mt-1 text-sm text-danger">{errors.content}</p>
          )}
        </div>

        {/* 选项（单选/多选题） */}
        {(type === 'single' || type === 'multiple') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              选项 <span className="text-danger">*</span>
            </label>
            <div className="space-y-3">
              {options.map((opt, index) => (
                <div key={opt.id} className="flex items-center gap-3">
                  {type === 'single' ? (
                    <input
                      type="radio"
                      name="answer"
                      checked={answer === opt.id}
                      onChange={() => handleSingleAnswer(opt.id)}
                      className="w-4 h-4 text-primary"
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={answer.split('|').includes(opt.id)}
                      onChange={() => handleMultipleAnswer(opt.id)}
                      className="w-4 h-4 text-primary rounded"
                    />
                  )}
                  <span className="w-6 text-sm font-medium text-gray-500">{opt.id}.</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOptionText(index, e.target.value)}
                    placeholder={`选项 ${opt.id}`}
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 8 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Plus size={16} />
                  添加选项
                </button>
              )}
            </div>
            {errors.options && (
              <p className="mt-1 text-sm text-danger">{errors.options}</p>
            )}
            {errors.answer && (
              <p className="mt-1 text-sm text-danger">{errors.answer}</p>
            )}
          </div>
        )}

        {/* 判断题答案 */}
        {type === 'boolean' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              答案 <span className="text-danger">*</span>
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="booleanAnswer"
                  checked={answer === '正确'}
                  onChange={() => setAnswer('正确')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-gray-700 dark:text-gray-300">正确</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="booleanAnswer"
                  checked={answer === '错误'}
                  onChange={() => setAnswer('错误')}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-gray-700 dark:text-gray-300">错误</span>
              </label>
            </div>
            {errors.answer && (
              <p className="mt-1 text-sm text-danger">{errors.answer}</p>
            )}
          </div>
        )}

        {/* 填空题答案（支持多个空） */}
        {type === 'fill' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              答案 <span className="text-danger">*</span>
            </label>

            {blankCount === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                请先在题干中插入空栏标记（___）
              </p>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: blankCount }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-16">
                      第 {index + 1} 空
                    </span>
                    <input
                      type="text"
                      value={fillAnswers[index] || ''}
                      onChange={(e) => updateFillAnswer(index, e.target.value)}
                      placeholder={`请输入第 ${index + 1} 空的答案`}
                      className={cn(
                        "flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none",
                        errors.answer ? "border-danger" : "border-gray-200 dark:border-gray-600"
                      )}
                    />
                  </div>
                ))}
              </div>
            )}

            {errors.answer && (
              <p className="mt-1 text-sm text-danger">{errors.answer}</p>
            )}
          </div>
        )}

        {/* 简答题答案 */}
        {type === 'short' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              参考答案 <span className="text-danger">*</span>
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="请输入参考答案"
              className={cn(
                "w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none",
                errors.answer ? "border-danger" : "border-gray-200 dark:border-gray-600"
              )}
            />
            {errors.answer && (
              <p className="mt-1 text-sm text-danger">{errors.answer}</p>
            )}
          </div>
        )}

        {/* 解析 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            解析（可选）
          </label>
          <textarea
            value={analysis}
            onChange={(e) => setAnalysis(e.target.value)}
            rows={3}
            placeholder="请输入题目解析"
            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
          />
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || loading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || loading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {(submitting || loading) && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            保存
          </button>
        </div>
      </form>
    </Dialog>
  );
};

export default QuestionEditDialog;
