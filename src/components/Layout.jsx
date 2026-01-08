import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  List,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Play,
  MessageCircle,
  BookOpen,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { getTheme, setTheme as setThemeApi } from '../api';

export const ThemeContext = React.createContext({
  theme: 'system',
  setTheme: () => {},
});

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setThemeState] = useState('system');

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 从数据库读取主题设置
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await getTheme();
        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error('加载主题设置失败:', error);
        // 如果数据库读取失败，尝试从 localStorage 读取作为后备
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setThemeState(stored);
        }
      }
    };
    
    loadTheme();
  }, []);

  // 设置主题并持久化到数据库
  const setTheme = useCallback(async (newTheme) => {
    setThemeState(newTheme);
    // 同时保存到 localStorage 作为后备
    localStorage.setItem('theme', newTheme);
    
    try {
      await setThemeApi(newTheme);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }, []);

  // 根据主题更新 html 的 dark class，并在“跟随系统”模式下监听系统主题变化
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      // 先移除 dark class，再根据条件添加
      root.classList.remove('dark');
      
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'system' && mediaQuery.matches) {
        root.classList.add('dark');
      }
      // theme === 'light' 时不添加 dark class
    };

    applyTheme();

    const handleChange = () => {
      if (theme === 'system') {
        root.classList.remove('dark');
        if (mediaQuery.matches) {
          root.classList.add('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const navItems = [
    { path: '/dashboard', label: '首页', icon: LayoutDashboard },
    { path: '/question-preview', label: '题库预览', icon: List },
    { path: '/practice', label: '随机练题', icon: Play },
    { path: '/wrong-book', label: '错题本', icon: BookOpen },
    { path: '/ai-import', label: 'AI智能录入', icon: Sparkles },
    { path: '/ai-chat', label: 'AI问答', icon: MessageCircle },
    { path: '/settings', label: '系统设置', icon: Settings },
  ];

  const themeOptions = [
    { id: 'light', label: '亮色', icon: Sun },
    { id: 'dark', label: '暗色', icon: Moon },
    { id: 'system', label: '跟随系统', icon: Monitor },
  ];

  const currentThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 240 : 64 }}
        className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20 shadow-sm relative transition-all duration-300"
      >
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <item.icon size={20} className="min-w-[20px]" />
              {isSidebarOpen && (
                <span className="whitespace-nowrap animate-fade-in">{item.label}</span>
              )}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 底部区域：主题切换和折叠按钮 */}
        <div className="p-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
          {/* 主题切换按钮 */}
          <div className="relative">
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {React.createElement(currentThemeIcon, { size: 20, className: "min-w-[20px]" })}
              {isSidebarOpen && (
                <span className="whitespace-nowrap animate-fade-in">主题</span>
              )}
              {!isSidebarOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  主题
                </div>
              )}
            </button>
            
            {/* 主题二级菜单 */}
            {showThemeMenu && (
              <div className={cn(
                "absolute bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 z-50",
                isSidebarOpen ? "left-0 right-0 mx-2" : "left-full ml-2 w-32"
              )}>
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        setTheme(option.id);
                        setShowThemeMenu(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      <Icon size={16} />
                      <span>{option.label}</span>
                      {isActive && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 折叠按钮 */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">


        {/* Page Content */}
        <main className="flex-1 flex flex-col overflow-hidden p-6 bg-slate-50 dark:bg-gray-900">
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
      </div>
    </ThemeContext.Provider>
  );
};

export default Layout;
