import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

// 获取图标路径，兼容开发环境和打包后环境
const getIconPath = () => {
  // 打包后的 Electron 环境
  if (window.electronAPI) {
    return './icon.png';
  }
  // 开发环境
  return '/icon.png';
};

const TitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const iconPath = getIconPath();

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI?.window?.isMaximized) {
        const maximized = await window.electronAPI.window.isMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();
    
    // 监听窗口大小变化
    const handleResize = () => checkMaximized();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.window?.maximize();
    const maximized = await window.electronAPI?.window?.isMaximized();
    setIsMaximized(maximized);
  };

  const handleClose = () => {
    window.electronAPI?.window?.close();
  };

  return (
    <div className="h-10 bg-white dark:bg-[#1F1F1F] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between select-none app-drag">
      {/* 左侧图标和标题 */}
      <div className="flex items-center gap-3 px-4">
        <img src={iconPath} alt="logo" className="w-8 h-8" />
        <span className="text-lg font-medium text-gray-700 dark:text-gray-200">题库助手系统</span>
      </div>
      
      {/* 右侧窗口控制按钮 */}
      <div className="flex items-center h-full app-no-drag">
        <button
          onClick={handleMinimize}
          className="h-full px-5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title="最小化"
        >
          <Minus size={18} className="text-gray-600 dark:text-gray-400" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title={isMaximized ? "还原" : "最大化"}
        >
          {isMaximized ? (
            <Copy size={14} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <Square size={14} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-5 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center group"
          title="关闭"
        >
          <X size={18} className="text-gray-600 dark:text-gray-400 group-hover:text-white" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
