import React, { useState, useEffect, useCallback } from 'react';
import { 
  Filter, 
  Trash2, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Eye, 
  Plus,
  Upload,
  ArrowLeft,
  BookOpen,
  FolderOpen,
  Search,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { useQuestionBanks } from '../contexts/QuestionBankContext';
import { useQuestions } from '../contexts/QuestionContext';
import QuestionBankDialog from '../components/QuestionBankDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import QuestionEditDialog from '../components/QuestionEditDialog';
import { exportQuestionBank } from '../api';
import CodeAwareText from '../components/CodeAwareText';

// 题库卡片颜色列表
const BANK_COLORS = [
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-purple-500 to-purple-600',
  'from-red-500 to-red-600',
  'from-cyan-500 to-cyan-600',
  'from-pink-500 to-pink-600',
  'from-indigo-500 to-indigo-600',
];

// 根据ID获取颜色
const getBankColor = (id) => BANK_COLORS[id % BANK_COLORS.length];

const QuestionPreview = () => {
  const { banks, loading: banksLoading, error: banksError, addBank, editBank, removeBank, fetchBanks } = useQuestionBanks();
  const {
    questions,
    total,
    page,
    pageSize,
    totalPages,
    loading: questionsLoading,
    error: questionsError,
    searchKeyword,
    filterType,
    selectedIds,
    fetchQuestions,
    search,
    setPage,
    setSearchKeyword,
    setFilterType,
    setSelectedIds,
    clearSelection,
    selectAll,
    reset: resetQuestions,
    removeQuestions,
    editQuestion,
  } = useQuestions();
  
  const [selectedBank, setSelectedBank] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  // 对话框状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [deletingBank, setDeletingBank] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // 题目删除确认对话框
  const [deleteQuestionsDialogOpen, setDeleteQuestionsDialogOpen] = useState(false);

  // 题目编辑对话框
  const [editQuestionDialogOpen, setEditQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);

  // 导出状态
  const [exporting, setExporting] = useState(false);

  const typeMap = {
    single: { label: '单选题', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    multiple: { label: '多选题', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    boolean: { label: '判断题', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    fill: { label: '填空题', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    short: { label: '简答题', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  };

  // 加载题目列表
  const loadQuestions = useCallback(async (bankId, options = {}) => {
    await fetchQuestions(bankId, {
      page: options.page || 1,
      type: options.type !== undefined ? options.type : filterType,
    });
  }, [fetchQuestions, filterType]);

  // 进入题库时加载题目
  useEffect(() => {
    if (selectedBank) {
      loadQuestions(selectedBank.id, { page: 1 });
    }
  }, [selectedBank]);

  // 题型筛选变化时重新加载
  useEffect(() => {
    if (selectedBank && filterType !== null) {
      loadQuestions(selectedBank.id, { page: 1, type: filterType });
    } else if (selectedBank && filterType === null) {
      loadQuestions(selectedBank.id, { page: 1, type: null });
    }
  }, [filterType]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      selectAll();
    } else {
      clearSelection();
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleEnterBank = (bank) => {
    setSelectedBank(bank);
    setSearchInput('');
    setSearchKeyword('');
    setFilterType(null);
    clearSelection();
  };

  const handleBackToList = () => {
    setSelectedBank(null);
    resetQuestions();
    setSearchInput('');
  };

  // 搜索处理
  const handleSearch = useCallback(() => {
    if (selectedBank) {
      if (searchInput.trim()) {
        search(selectedBank.id, searchInput.trim(), { page: 1, type: filterType });
      } else {
        setSearchKeyword('');
        loadQuestions(selectedBank.id, { page: 1 });
      }
    }
  }, [selectedBank, searchInput, filterType, search, setSearchKeyword, loadQuestions]);

  // 清除搜索
  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchKeyword('');
    if (selectedBank) {
      loadQuestions(selectedBank.id, { page: 1 });
    }
  }, [selectedBank, setSearchKeyword, loadQuestions]);

  // 题型筛选处理
  const handleTypeFilter = useCallback((type) => {
    const newType = type === 'all' ? null : type;
    setFilterType(newType);
  }, [setFilterType]);

  // 分页处理
  const handlePageChange = useCallback((newPage) => {
    if (selectedBank && newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      if (searchKeyword) {
        search(selectedBank.id, searchKeyword, { page: newPage, type: filterType });
      } else {
        loadQuestions(selectedBank.id, { page: newPage });
      }
    }
  }, [selectedBank, totalPages, setPage, searchKeyword, search, filterType, loadQuestions]);

  // 批量删除题目
  const handleDeleteQuestions = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    try {
      await removeQuestions(selectedIds);
      setDeleteQuestionsDialogOpen(false);
      // 刷新题库列表以更新题目数量
      fetchBanks();
    } finally {
      setSubmitting(false);
    }
  };

  // 打开编辑题目对话框
  const handleOpenEditQuestion = (question, e) => {
    e.stopPropagation();
    setEditingQuestion(question);
    setEditQuestionDialogOpen(true);
  };

  // 删除单个题目
  const handleDeleteSingleQuestion = async (id, e) => {
    e.stopPropagation();
    setSelectedIds([id]);
    setDeleteQuestionsDialogOpen(true);
  };

  // 新建题库
  const handleCreateBank = async (data) => {
    setSubmitting(true);
    try {
      await addBank(data);
      setCreateDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (bank, e) => {
    e.stopPropagation();
    setEditingBank(bank);
    setEditDialogOpen(true);
  };

  // 编辑题库
  const handleEditBank = async (data) => {
    if (!editingBank) return;
    setSubmitting(true);
    try {
      await editBank(editingBank.id, data);
      setEditDialogOpen(false);
      setEditingBank(null);
    } finally {
      setSubmitting(false);
    }
  };

  // 打开删除确认对话框
  const handleOpenDeleteDialog = (bank, e) => {
    e.stopPropagation();
    setDeletingBank(bank);
    setDeleteDialogOpen(true);
  };

  // 删除题库
  const handleDeleteBank = async () => {
    if (!deletingBank) return;
    setSubmitting(true);
    try {
      await removeBank(deletingBank.id);
      setDeleteDialogOpen(false);
      setDeletingBank(null);
    } finally {
      setSubmitting(false);
    }
  };

  // 导出题库
  const handleExportBank = async () => {
    if (!selectedBank) return;
    setExporting(true);
    try {
      const result = await exportQuestionBank(selectedBank.id);
      if (result.success) {
        // 导出成功，可以显示提示
        console.log(`导出成功: ${result.count} 道题目`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert(error.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
  };

  // 题库列表视图
  if (!selectedBank) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">题库管理</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">管理和查看所有题库</p>
          </div>
          
          <button 
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-95 transition-all text-sm font-medium shadow-sm shadow-primary/30"
          >
            <Plus size={18} />
            新建题库
          </button>
        </div>

        {/* 加载状态 */}
        {banksLoading && banks.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>加载中...</span>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {banksError && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
            <p className="text-sm text-danger">{banksError}</p>
          </div>
        )}

        {/* 空状态 */}
        {!banksLoading && banks.length === 0 && !banksError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <FolderOpen size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">暂无题库</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">点击上方按钮创建你的第一个题库</p>
            <button 
              onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              <Plus size={18} />
              新建题库
            </button>
          </div>
        )}

        {/* 题库卡片网格 */}
        {banks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banks.map((bank, index) => (
              <motion.div
                key={bank.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleEnterBank(bank)}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer overflow-hidden"
              >
                {/* 顶部渐变条 */}
                <div className={`h-2 bg-gradient-to-r ${getBankColor(bank.id)}`}></div>
                
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getBankColor(bank.id)} flex items-center justify-center text-white shadow-lg`}>
                        <BookOpen size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                          {bank.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {bank.questionCount || 0} 道题目
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 line-clamp-2 min-h-[40px]">
                    {bank.description || '暂无描述'}
                  </p>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-400">
                      创建于 {formatDate(bank.createdAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => handleOpenEditDialog(bank, e)}
                        className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        title="编辑题库"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleOpenDeleteDialog(bank, e)}
                        className="p-1.5 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors"
                        title="删除题库"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 新建题库对话框 */}
        <QuestionBankDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onSubmit={handleCreateBank}
          loading={submitting}
        />

        {/* 编辑题库对话框 */}
        <QuestionBankDialog
          open={editDialogOpen}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingBank(null);
          }}
          onSubmit={handleEditBank}
          initialData={editingBank}
          loading={submitting}
        />

        {/* 删除确认对话框 */}
        <ConfirmDialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setDeletingBank(null);
          }}
          onConfirm={handleDeleteBank}
          title="删除题库"
          message={`确定要删除题库"${deletingBank?.name}"吗？删除后该题库及其所有题目将无法恢复。`}
          confirmText="删除"
          type="danger"
          loading={submitting}
        />
      </div>
    );
  }

  // 题目列表视图（选中题库后）
  return (
    <div className="space-y-6">
      {/* 返回按钮和标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBackToList}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedBank.name}</h1>
              <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {total} 题
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{selectedBank.description || '暂无描述'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <NavLink to={`/manual-entry?bankId=${selectedBank.id}`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-95 transition-all text-sm font-medium shadow-sm shadow-primary/30">
              <Plus size={16} />
              手动录入
            </button>
          </NavLink>
          <NavLink to={`/csv-import?bankId=${selectedBank.id}`}>
            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium">
              <Upload size={16} />
              CSV导入
            </button>
          </NavLink>
          <button 
            onClick={handleExportBank}
            disabled={exporting || total === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {exporting ? '导出中...' : '导出'}
          </button>
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setDeleteQuestionsDialogOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-danger/10 text-danger border border-danger/20 rounded-lg hover:bg-danger/20 active:scale-95 transition-all text-sm font-medium"
            >
              <Trash2 size={16} />
              删除 ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* 搜索和筛选器 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* 搜索框 */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索题目内容..."
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
          {searchInput && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        
        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover transition-colors"
        >
          搜索
        </button>

        {/* 题型筛选 */}
        <div className="flex items-center gap-2 text-gray-500">
          <Filter size={18} />
          <span className="text-sm font-medium">筛选:</span>
        </div>
        <select 
          value={filterType || 'all'}
          onChange={(e) => handleTypeFilter(e.target.value)}
          className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg block p-2.5"
        >
          <option value="all">所有题型</option>
          <option value="single">单选题</option>
          <option value="multiple">多选题</option>
          <option value="boolean">判断题</option>
          <option value="fill">填空题</option>
          <option value="short">简答题</option>
        </select>
      </div>

      {/* 搜索结果提示 */}
      {searchKeyword && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>搜索 "{searchKeyword}" 的结果：{total} 条</span>
          <button
            onClick={handleClearSearch}
            className="text-primary hover:underline"
          >
            清除搜索
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {questionsError && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
          <p className="text-sm text-danger">{questionsError}</p>
        </div>
      )}

      {/* 题目列表 */}
      <div className="space-y-4">
        {/* 加载状态 */}
        {questionsLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-gray-500">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>加载中...</span>
            </div>
          </div>
        )}

        {/* 空状态 */}
        {!questionsLoading && questions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <BookOpen size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchKeyword ? '未找到匹配的题目' : '暂无题目'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchKeyword ? '尝试使用其他关键词搜索' : '点击上方按钮添加题目'}
            </p>
          </div>
        )}

        {/* 题目列表 */}
        {!questionsLoading && questions.length > 0 && (
          <>
            <div className="flex items-center gap-4 px-6">
              <input 
                type="checkbox" 
                className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded"
                onChange={handleSelectAll}
                checked={selectedIds.length === questions.length && questions.length > 0}
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">全选本页</span>
            </div>

            <div className="grid gap-4">
              <AnimatePresence>
                {questions.map((q, index) => (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group bg-white dark:bg-gray-800 p-6 rounded-xl border transition-all duration-200",
                      selectedIds.includes(q.id) 
                        ? "border-primary ring-1 ring-primary shadow-md" 
                        : "border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded"
                          checked={selectedIds.includes(q.id)}
                          onChange={() => handleSelectOne(q.id)}
                        />
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("px-2.5 py-0.5 rounded text-xs font-medium", typeMap[q.type]?.color || 'bg-gray-100 text-gray-700')}>
                            {typeMap[q.type]?.label || q.type}
                          </span>
                          <span className="text-xs text-gray-400 ml-auto">
                            {q.createdAt ? new Date(q.createdAt).toLocaleString('zh-CN') : ''}
                          </span>
                        </div>
                        
                        <div className="text-gray-900 dark:text-gray-100 font-medium leading-relaxed">
                          <CodeAwareText text={q.content} />
                        </div>

                        {/* 显示选项（单选/多选题） */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 items-stretch">
                            {q.options.map((opt) => (
                              <div 
                                key={opt.id} 
                                className={cn(
                                  "text-sm px-3 py-1.5 rounded-lg flex flex-col h-full border border-transparent",
                                  q.answer?.includes(opt.id) 
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800" 
                                    : "bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                )}
                              >
                                <div className="flex items-stretch gap-2 flex-1 min-h-0">
                                  <span className="flex-shrink-0 self-start">{opt.id}.</span>
                                  <CodeAwareText text={opt.text} className="min-w-0 flex-1 self-stretch bg-transparent p-0 h-full" />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 显示答案 */}
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-medium">答案：</span>
                          <span className="text-green-600 dark:text-green-400">{q.answer}</span>
                        </div>

                        {/* 显示解析 */}
                        {q.analysis && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                            <span className="font-medium">解析：</span>
                            <div className="mt-1">
                              <CodeAwareText text={q.analysis} className="bg-transparent p-0" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => handleOpenEditQuestion(q, e)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" 
                          title="编辑"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteSingleQuestion(q.id, e)}
                          className="p-2 text-gray-400 hover:text-danger hover:bg-danger/5 rounded-lg transition-colors" 
                          title="删除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* 分页 */}
      {!questionsLoading && totalPages > 0 && (
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            显示 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
          </span>
          <div className="flex items-center gap-2">
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            
            {/* 动态生成页码 */}
            {(() => {
              const pages = [];
              const maxVisiblePages = 5;
              let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
              
              if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              if (startPage > 1) {
                pages.push(
                  <button
                    key={1}
                    onClick={() => handlePageChange(1)}
                    className="w-9 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    1
                  </button>
                );
                if (startPage > 2) {
                  pages.push(<span key="start-ellipsis" className="text-gray-400">...</span>);
                }
              }

              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={cn(
                      "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                      page === i 
                        ? "bg-primary text-white shadow-lg shadow-primary/30" 
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                  >
                    {i}
                  </button>
                );
              }

              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pages.push(<span key="end-ellipsis" className="text-gray-400">...</span>);
                }
                pages.push(
                  <button
                    key={totalPages}
                    onClick={() => handlePageChange(totalPages)}
                    className="w-9 h-9 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {totalPages}
                  </button>
                );
              }

              return pages;
            })()}
            
            <button 
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* 删除题目确认对话框 */}
      <ConfirmDialog
        open={deleteQuestionsDialogOpen}
        onClose={() => {
          setDeleteQuestionsDialogOpen(false);
          if (selectedIds.length === 1) {
            clearSelection();
          }
        }}
        onConfirm={handleDeleteQuestions}
        title="删除题目"
        message={`确定要删除选中的 ${selectedIds.length} 道题目吗？删除后将无法恢复。`}
        confirmText="删除"
        type="danger"
        loading={submitting}
      />

      {/* 编辑题目对话框 - 待实现 */}
      {editQuestionDialogOpen && editingQuestion && (
        <QuestionEditDialog
          open={editQuestionDialogOpen}
          onClose={() => {
            setEditQuestionDialogOpen(false);
            setEditingQuestion(null);
          }}
          question={editingQuestion}
          onSave={async (data) => {
            await editQuestion(editingQuestion.id, data);
            setEditQuestionDialogOpen(false);
            setEditingQuestion(null);
            // 刷新列表
            if (selectedBank) {
              loadQuestions(selectedBank.id, { page });
            }
          }}
        />
      )}
    </div>
  );
};

export default QuestionPreview;
