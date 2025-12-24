import React, { useState, useEffect, useMemo } from 'react';
import { Save, Send, Plus, Trash2, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import { useQuestions } from '../contexts/QuestionContext';
import { saveDraft, loadDraft, clearDraft } from '../api';

const ManualEntry = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bankIdFromUrl = searchParams.get('bankId');
  
  const { banks } = useQuestionBanks();
  const { addQuestion, currentBankId } = useQuestions();
  
  // 确定当前题库ID：优先使用URL参数，其次使用context中的currentBankId
  const [selectedBankId, setSelectedBankId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('single');
  const [formData, setFormData] = useState({
    content: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' }
    ],
    answer: '',
    answers: [], // for multiple choice
    fillAnswers: [], // for fill blank - 动态生成的答案数组
    analysis: '',
  });
  
  // 状态管理
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const questionTypes = [
    { id: 'single', label: '单选题' },
    { id: 'multiple', label: '多选题' },
    { id: 'boolean', label: '判断题' },
    { id: 'fill', label: '填空题' },
    { id: 'short', label: '简答题' },
  ];

  // 初始化题库ID
  useEffect(() => {
    if (bankIdFromUrl) {
      setSelectedBankId(parseInt(bankIdFromUrl, 10));
    } else if (currentBankId) {
      setSelectedBankId(currentBankId);
    }
  }, [bankIdFromUrl, currentBankId]);

  // 页面加载时恢复草稿
  useEffect(() => {
    const restoreDraft = async () => {
      try {
        const draft = await loadDraft();
        if (draft) {
          setActiveTab(draft.type || 'single');
          setFormData(prev => ({
            ...prev,
            content: draft.content || '',
            options: draft.options || prev.options,
            answer: draft.answer || '',
            answers: draft.answers || [],
            fillAnswers: draft.fillAnswers || [],
            analysis: draft.analysis || '',
          }));
          setDraftLoaded(true);
          // 3秒后隐藏提示
          setTimeout(() => setDraftLoaded(false), 3000);
        }
      } catch (err) {
        console.error('恢复草稿失败:', err);
      }
    };
    restoreDraft();
  }, []);

  // 计算填空题中的空栏数量（连续下划线算一个空）
  const blankCount = useMemo(() => {
    const matches = formData.content.match(/_{2,}/g);
    return matches ? matches.length : 0;
  }, [formData.content]);

  // 当空栏数量变化时，调整答案数组
  useEffect(() => {
    if (activeTab === 'fill') {
      setFormData(prev => {
        const newFillAnswers = [...prev.fillAnswers];
        // 如果空栏数量增加，添加空字符串
        while (newFillAnswers.length < blankCount) {
          newFillAnswers.push('');
        }
        // 如果空栏数量减少，截断数组
        if (newFillAnswers.length > blankCount) {
          newFillAnswers.length = blankCount;
        }
        return { ...prev, fillAnswers: newFillAnswers };
      });
    }
  }, [blankCount, activeTab]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setErrors([]);
    // Reset form state tailored to type
    setFormData(prev => ({ 
      ...prev, 
      answer: '', 
      answers: [],
      fillAnswers: [],
    }));
  };

  const addOption = () => {
    if (formData.options.length >= 8) return; // 最多8个选项
    const nextId = String.fromCharCode(65 + formData.options.length);
    setFormData({
      ...formData,
      options: [...formData.options, { id: nextId, text: '' }]
    });
  };

  const removeOption = (index) => {
    if (formData.options.length <= 2) return;
    const removedId = formData.options[index].id;
    const newOptions = formData.options.filter((_, i) => i !== index);
    // Re-index options
    const reindexed = newOptions.map((opt, i) => ({ ...opt, id: String.fromCharCode(65 + i) }));
    
    // 更新答案，移除被删除的选项
    let newAnswer = formData.answer;
    let newAnswers = formData.answers;
    
    if (activeTab === 'single' && formData.answer === removedId) {
      newAnswer = '';
    }
    if (activeTab === 'multiple') {
      newAnswers = formData.answers.filter(a => a !== removedId);
      // 重新映射答案ID
      newAnswers = newAnswers.map(a => {
        const oldIndex = a.charCodeAt(0) - 65;
        if (oldIndex > index) {
          return String.fromCharCode(oldIndex - 1 + 65);
        }
        return a;
      });
    }
    
    setFormData({ ...formData, options: reindexed, answer: newAnswer, answers: newAnswers });
  };

  const updateOption = (index, text) => {
    const newOptions = [...formData.options];
    newOptions[index].text = text;
    setFormData({ ...formData, options: newOptions });
  };

  const toggleMultipleAnswer = (id) => {
    const current = formData.answers;
    if (current.includes(id)) {
      setFormData({ ...formData, answers: current.filter(a => a !== id) });
    } else {
      setFormData({ ...formData, answers: [...current, id].sort() });
    }
  };

  const insertBlank = () => {
    setFormData({
      ...formData,
      content: formData.content + ' ___ '
    });
  };

  const updateFillAnswer = (index, value) => {
    const newFillAnswers = [...formData.fillAnswers];
    newFillAnswers[index] = value;
    setFormData({ ...formData, fillAnswers: newFillAnswers });
  };

  // 验证表单
  const validateForm = () => {
    const newErrors = [];

    // 验证题库选择
    if (!selectedBankId) {
      newErrors.push('请选择题库');
    }

    // 验证题干
    if (!formData.content || formData.content.trim() === '') {
      newErrors.push('题干内容不能为空');
    }

    // 根据题型验证
    switch (activeTab) {
      case 'single':
        // 验证选项
        const validSingleOptions = formData.options.filter(opt => opt.text.trim() !== '');
        if (validSingleOptions.length < 2) {
          newErrors.push('单选题至少需要2个有效选项');
        }
        // 验证答案
        if (!formData.answer) {
          newErrors.push('请选择正确答案');
        }
        break;
        
      case 'multiple':
        // 验证选项
        const validMultiOptions = formData.options.filter(opt => opt.text.trim() !== '');
        if (validMultiOptions.length < 2) {
          newErrors.push('多选题至少需要2个有效选项');
        }
        // 验证答案
        if (formData.answers.length === 0) {
          newErrors.push('请选择至少一个正确答案');
        }
        break;
        
      case 'boolean':
        if (!formData.answer) {
          newErrors.push('请选择正确答案');
        }
        break;
        
      case 'fill':
        if (blankCount === 0) {
          newErrors.push('填空题题干中必须包含至少一个空栏标记（___）');
        }
        // 验证每个空的答案
        const emptyFillAnswers = formData.fillAnswers.filter((a, i) => i < blankCount && (!a || a.trim() === ''));
        if (emptyFillAnswers.length > 0) {
          newErrors.push('请填写所有空栏的答案');
        }
        break;
        
      case 'short':
        // 简答题答案可选
        break;
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // 构建提交数据
  const buildSubmitData = () => {
    const data = {
      bankId: selectedBankId,
      type: activeTab,
      content: formData.content.trim(),
      analysis: formData.analysis.trim() || null,
    };

    switch (activeTab) {
      case 'single':
        data.options = formData.options.filter(opt => opt.text.trim() !== '');
        data.answer = formData.answer;
        break;
        
      case 'multiple':
        data.options = formData.options.filter(opt => opt.text.trim() !== '');
        data.answer = formData.answers.join('|');
        break;
        
      case 'boolean':
        data.answer = formData.answer;
        break;
        
      case 'fill':
        data.answer = formData.fillAnswers.slice(0, blankCount).join('|');
        break;
        
      case 'short':
        data.answer = formData.answer || '';
        break;
    }

    return data;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    setErrors([]);
    
    try {
      const data = buildSubmitData();
      await addQuestion(data);
      
      // 清除草稿
      await clearDraft();
      
      // 显示成功提示
      setSubmitSuccess(true);
      
      // 重置表单
      setFormData({
        content: '',
        options: [
          { id: 'A', text: '' },
          { id: 'B', text: '' },
          { id: 'C', text: '' },
          { id: 'D', text: '' }
        ],
        answer: '',
        answers: [],
        fillAnswers: [],
        analysis: '',
      });
      
      // 3秒后隐藏成功提示
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setErrors([err.message || '提交失败，请重试']);
    } finally {
      setSubmitting(false);
    }
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const draftData = {
        type: activeTab,
        content: formData.content,
        options: formData.options,
        answer: formData.answer,
        answers: formData.answers,
        fillAnswers: formData.fillAnswers,
        analysis: formData.analysis,
        savedAt: new Date().toISOString(),
      };
      await saveDraft(draftData);
      // 显示保存成功提示
      alert('草稿保存成功');
    } catch (err) {
      setErrors([err.message || '保存草稿失败']);
    } finally {
      setSavingDraft(false);
    }
  };

  // 返回题库
  const handleBack = () => {
    navigate('/question-preview');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">手动录入</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">创建新题目到题库中</p>
        </div>
      </div>

      {/* 草稿恢复提示 */}
      {draftLoaded && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3"
        >
          <CheckCircle size={20} className="text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">已恢复上次保存的草稿</span>
        </motion.div>
      )}

      {/* 成功提示 */}
      {submitSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
        >
          <CheckCircle size={20} className="text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-300">题目提交成功！</span>
        </motion.div>
      )}

      {/* 错误提示 */}
      {errors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 mt-0.5" />
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-red-700 dark:text-red-300">{error}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* 题库选择 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          <span className="text-danger mr-1">*</span>选择题库
        </label>
        <select
          value={selectedBankId || ''}
          onChange={(e) => setSelectedBankId(e.target.value ? parseInt(e.target.value, 10) : null)}
          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-all"
        >
          <option value="">请选择题库</option>
          {banks.map(bank => (
            <option key={bank.id} value={bank.id}>{bank.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Type Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 overflow-x-auto">
          {questionTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleTabChange(type.id)}
              className={cn(
                "px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap",
                activeTab === type.id
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="p-8 space-y-8">
          {/* Question Content */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              <span className="text-danger mr-1">*</span>题目内容
            </label>
            <div className="relative">
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full min-h-[120px] p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all resize-y text-gray-900 dark:text-gray-100"
                placeholder="在此输入题干内容..."
              />
              {activeTab === 'fill' && (
                <button 
                  onClick={insertBlank}
                  className="absolute bottom-4 right-4 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-600 dark:text-gray-300"
                >
                  插入空栏
                </button>
              )}
            </div>
            {activeTab === 'fill' && blankCount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                已插入 {blankCount} 个空栏
              </p>
            )}
          </div>

          {/* Options Area */}
          {(activeTab === 'single' || activeTab === 'multiple') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  <span className="text-danger mr-1">*</span>选项设置
                </label>
                <button 
                  onClick={addOption}
                  disabled={formData.options.length >= 8}
                  className="text-sm text-primary flex items-center gap-1 hover:text-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} /> 添加选项
                </button>
              </div>
              <div className="space-y-3">
                {formData.options.map((option, index) => (
                  <motion.div 
                    layout
                    key={index} 
                    className="flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300">
                      {option.id}
                    </div>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all text-gray-900 dark:text-gray-100"
                      placeholder={`选项 ${option.id}`}
                    />
                    
                    {/* Answer Selection Check/Radio */}
                    {activeTab === 'single' ? (
                      <div 
                        onClick={() => setFormData({ ...formData, answer: option.id })}
                        className={cn(
                          "cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors border",
                          formData.answer === option.id 
                            ? "bg-success/10 text-success border-success/20" 
                            : "bg-gray-50 dark:bg-gray-700 text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600"
                        )}
                      >
                        {formData.answer === option.id ? '正确答案' : '设为答案'}
                      </div>
                    ) : (
                      <div 
                        onClick={() => toggleMultipleAnswer(option.id)}
                        className={cn(
                          "cursor-pointer px-3 py-2 rounded-lg text-sm transition-colors border",
                          formData.answers.includes(option.id)
                            ? "bg-success/10 text-success border-success/20" 
                            : "bg-gray-50 dark:bg-gray-700 text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-600"
                        )}
                      >
                        {formData.answers.includes(option.id) ? '正确答案' : '设为答案'}
                      </div>
                    )}

                    <button 
                      onClick={() => removeOption(index)}
                      disabled={formData.options.length <= 2}
                      className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* True/False Specific */}
          {activeTab === 'boolean' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="text-danger mr-1">*</span>正确答案
              </label>
              <div className="flex gap-4">
                {['正确', '错误'].map((val) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer group">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      formData.answer === val 
                        ? "border-primary bg-primary" 
                        : "border-gray-300 dark:border-gray-500 group-hover:border-primary"
                    )}>
                      {formData.answer === val && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <input 
                      type="radio" 
                      className="hidden"
                      checked={formData.answer === val}
                      onChange={() => setFormData({ ...formData, answer: val })}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{val}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Fill In Blank Specific - 动态答案输入框 */}
          {activeTab === 'fill' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="text-danger mr-1">*</span>答案设置
              </label>
              {blankCount === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  请在题干中插入空栏标记（点击"插入空栏"按钮）
                </p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: blankCount }).map((_, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-16">
                        第 {index + 1} 空
                      </span>
                      <input
                        type="text"
                        value={formData.fillAnswers[index] || ''}
                        onChange={(e) => updateFillAnswer(index, e.target.value)}
                        className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all text-gray-900 dark:text-gray-100"
                        placeholder={`请输入第 ${index + 1} 空的答案`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Short Answer Specific */}
          {activeTab === 'short' && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                参考答案
              </label>
              <textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                className="w-full min-h-[100px] p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all resize-y text-gray-900 dark:text-gray-100"
                placeholder="输入参考答案（可选）..."
              />
            </div>
          )}

          {/* Analysis */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              解析说明
            </label>
            <textarea
              value={formData.analysis}
              onChange={(e) => setFormData({ ...formData, analysis: e.target.value })}
              className="w-full min-h-[100px] p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-all resize-y text-gray-900 dark:text-gray-100"
              placeholder="输入答案解析..."
            />
          </div>

          {/* Actions */}
          <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-4">
            <button 
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="px-6 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 font-medium transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {savingDraft ? '保存中...' : '保存草稿'}
            </button>
            <button 
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover font-medium transition-all shadow-lg shadow-primary/30 active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={18} />
              {submitting ? '提交中...' : '立即提交'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualEntry;
