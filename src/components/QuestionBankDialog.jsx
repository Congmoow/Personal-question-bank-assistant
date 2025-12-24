import React, { useState, useEffect } from 'react';
import Dialog from './Dialog';

/**
 * 题库表单对话框组件
 * 用于新建和编辑题库
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {() => void} props.onClose - 关闭回调
 * @param {(data: {name: string, description: string}) => Promise<void>} props.onSubmit - 提交回调
 * @param {{id?: number, name?: string, description?: string}} [props.initialData] - 初始数据（编辑模式）
 * @param {boolean} [props.loading] - 加载状态
 */
export function QuestionBankDialog({ open, onClose, onSubmit, initialData, loading }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  const isEditMode = !!initialData?.id;

  // 初始化表单数据
  useEffect(() => {
    if (open) {
      if (initialData) {
        setName(initialData.name || '');
        setDescription(initialData.description || '');
      } else {
        setName('');
        setDescription('');
      }
      setErrors({});
    }
  }, [open, initialData]);

  // 验证表单
  const validate = () => {
    const newErrors = {};

    // 验证名称非空
    if (!name || name.trim() === '') {
      newErrors.name = '题库名称不能为空';
    } else if (name.length > 50) {
      newErrors.name = '题库名称长度不能超过50字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err.message || '操作失败' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEditMode ? '编辑题库' : '新建题库'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 题库名称 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            题库名称 <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="请输入题库名称"
            maxLength={50}
            className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
              errors.name ? 'border-danger' : 'border-gray-200 dark:border-gray-600'
            }`}
          />
          {errors.name && (
            <p className="mt-1.5 text-sm text-danger">{errors.name}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{name.length}/50</p>
        </div>

        {/* 题库描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            题库描述
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入题库描述（可选）"
            rows={3}
            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          />
        </div>

        {/* 提交错误 */}
        {errors.submit && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
            <p className="text-sm text-danger">{errors.submit}</p>
          </div>
        )}

        {/* 按钮 */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg shadow-sm shadow-primary/30 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isEditMode ? '保存' : '创建'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export default QuestionBankDialog;
