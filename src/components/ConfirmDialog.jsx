import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Dialog from './Dialog';

/**
 * 确认对话框组件
 * @param {Object} props
 * @param {boolean} props.open - 是否显示对话框
 * @param {() => void} props.onClose - 关闭回调
 * @param {() => Promise<void>} props.onConfirm - 确认回调
 * @param {string} props.title - 对话框标题
 * @param {string} props.message - 确认消息
 * @param {string} [props.confirmText] - 确认按钮文本
 * @param {string} [props.cancelText] - 取消按钮文本
 * @param {'danger' | 'warning' | 'primary'} [props.type] - 对话框类型
 * @param {boolean} [props.loading] - 加载状态
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'danger',
  loading = false,
}) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // 错误由调用方处理
    }
  };

  const typeStyles = {
    danger: {
      icon: 'bg-danger/10 text-danger',
      button: 'bg-danger hover:bg-danger/90 shadow-danger/30',
    },
    warning: {
      icon: 'bg-orange-100 text-orange-600',
      button: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30',
    },
    primary: {
      icon: 'bg-primary/10 text-primary',
      button: 'bg-primary hover:bg-primary-hover shadow-primary/30',
    },
  };

  const styles = typeStyles[type] || typeStyles.danger;

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-full ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2 ${styles.button}`}
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

export default ConfirmDialog;
