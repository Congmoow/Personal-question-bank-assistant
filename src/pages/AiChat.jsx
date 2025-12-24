import { useState, useRef, useEffect } from 'react';
import { Send, User, Loader2, Trash2, AlertCircle, ChevronDown, History, Plus, X, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '../lib/utils';
import api from '../api';

// 预处理 LaTeX 公式，将 \( \) 和 \[ \] 转换为 $ 和 $$
const preprocessLatex = (content) => {
  if (!content) return content;
  return content
    // 将 \[ ... \] 转换为 $$ ... $$（块级公式）
    .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$1$$')
    // 将 \( ... \) 转换为 $ ... $（行内公式）
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');
};

// AI 提供商配置（图标和名称）- 使用 emoji 作为备用图标
const AI_PROVIDER_INFO = {
  openai: { name: 'ChatGPT', icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg', emoji: '🤖', color: '#10a37f' },
  anthropic: { name: 'Claude', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Claude_AI_logo.svg', emoji: '🧠', color: '#d97706' },
  gemini: { name: 'Gemini', icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg', emoji: '✨', color: '#4285f4' },
  deepseek: { name: 'DeepSeek', icon: 'https://chat.deepseek.com/favicon.svg', emoji: '🔍', color: '#4d6bfe' },
  qwen: { name: '通义千问', icon: null, emoji: '🌐', color: '#6366f1' },
  zhipu: { name: '智谱清言', icon: null, emoji: '💡', color: '#2563eb' },
  moonshot: { name: 'Kimi', icon: null, emoji: '🌙', color: '#000000' },
  doubao: { name: '豆包', icon: null, emoji: '🫘', color: '#3b82f6' },
  minimax: { name: 'MiniMax', icon: 'https://filecdn.minimax.chat/public/58eca777-e31f-448a-9823-e2220e49b426.png', emoji: '🎯', color: '#ff6b35' },
  baichuan: { name: '百川', icon: null, emoji: '🌊', color: '#059669' },
  yi: { name: '零一万物', icon: null, emoji: '🔮', color: '#8b5cf6' },
  groq: { name: 'Groq', icon: null, emoji: '⚡', color: '#f97316' },
  together: { name: 'Together AI', icon: null, emoji: '🤝', color: '#06b6d4' },
  siliconflow: { name: 'SiliconFlow', icon: null, emoji: '🌊', color: '#8b5cf6' },
  custom: { name: 'AI 助手', icon: null, emoji: '🤖', color: '#6366f1' }
};

// 根据模型名称推断提供商
const inferProviderFromModel = (modelId) => {
  if (!modelId) return 'custom';
  const model = modelId.toLowerCase();
  if (model.includes('gpt') || model.includes('o1')) return 'openai';
  if (model.includes('claude')) return 'anthropic';
  if (model.includes('gemini')) return 'gemini';
  if (model.includes('deepseek')) return 'deepseek';
  if (model.includes('qwen')) return 'qwen';
  if (model.includes('glm')) return 'zhipu';
  if (model.includes('moonshot') || model.includes('kimi')) return 'moonshot';
  if (model.includes('doubao')) return 'doubao';
  if (model.includes('abab') || model.includes('minimax')) return 'minimax';
  if (model.includes('baichuan')) return 'baichuan';
  if (model.includes('yi-')) return 'yi';
  if (model.includes('llama') || model.includes('mixtral')) return 'groq';
  return 'custom';
};

// AI 图标组件
const AiIcon = ({ provider, modelId, size = 24, className = '' }) => {
  const [imgError, setImgError] = useState(false);
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  const info = AI_PROVIDER_INFO[actualProvider] || AI_PROVIDER_INFO.custom;
  
  // 如果有图标URL且未加载失败，显示图片
  if (info.icon && !imgError) {
    return (
      <img
        src={info.icon}
        alt={info.name}
        width={size}
        height={size}
        className={cn('object-contain', className)}
        onError={() => setImgError(true)}
      />
    );
  }
  
  // 显示 emoji 图标
  if (info.emoji) {
    return (
      <span 
        className={cn('flex items-center justify-center', className)} 
        style={{ fontSize: size * 0.8, lineHeight: 1 }}
      >
        {info.emoji}
      </span>
    );
  }
  
  return <Bot size={size} className={className} style={{ color: info.color }} />;
};

// 获取 AI 名称
const getAiName = (provider, modelId) => {
  const actualProvider = provider !== 'custom' ? provider : inferProviderFromModel(modelId);
  const info = AI_PROVIDER_INFO[actualProvider] || AI_PROVIDER_INFO.custom;
  return info.name;
};

const AiChat = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [showPromptDropdown, setShowPromptDropdown] = useState(false);
  const [chatHistoryList, setChatHistoryList] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [aiConfig, setAiConfig] = useState({ provider: 'custom', modelId: '' });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const historyRef = useRef(null);

  // 加载 AI 配置
  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setAiConfig({ provider: config.provider || 'custom', modelId: config.modelId || '' });
      } catch (err) {
        console.error('加载 AI 配置失败:', err);
      }
    };
    loadAiConfig();
  }, []);

  // 加载 Prompt 列表
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const list = await window.electronAPI.prompt.getAll();
        setPrompts(list);
        // 默认选择第一个（默认 prompt）
        if (list.length > 0) {
          const defaultPrompt = list.find(p => p.isDefault) || list[0];
          setSelectedPrompt(defaultPrompt);
        }
      } catch (err) {
        console.error('加载 Prompt 列表失败:', err);
      }
    };
    loadPrompts();
  }, []);

  // 加载聊天记录列表
  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const list = await window.electronAPI.chatHistory.getAll(50);
      setChatHistoryList(list);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowPromptDropdown(false);
      }
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const result = await window.electronAPI.ai.chat(newMessages, selectedPrompt?.id);
      const assistantMessage = {
        role: 'assistant',
        content: result.message || result.content || '抱歉，我无法理解您的问题。'
      };
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      
      // 保存或更新聊天记录
      await saveChatToHistory(finalMessages);
    } catch (err) {
      setError(err.message || 'AI 回复失败，请重试');
      // 移除用户消息，让用户可以重试
      setMessages(messages);
      setInput(userMessage.content);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 保存聊天记录
  const saveChatToHistory = async (msgs) => {
    try {
      // 使用第一条用户消息作为标题
      const firstUserMsg = msgs.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : '新对话';
      
      if (currentChatId) {
        // 更新现有记录
        await window.electronAPI.chatHistory.update(currentChatId, msgs);
      } else {
        // 创建新记录
        const saved = await window.electronAPI.chatHistory.save({
          title,
          messages: msgs,
          promptId: selectedPrompt?.id
        });
        setCurrentChatId(saved.id);
      }
      // 刷新列表
      await loadChatHistory();
    } catch (err) {
      console.error('保存聊天记录失败:', err);
    }
  };

  // 加载历史对话
  const loadChat = async (chatId) => {
    try {
      const chat = await window.electronAPI.chatHistory.getById(chatId);
      if (chat) {
        setMessages(chat.messages);
        setCurrentChatId(chat.id);
        // 如果有关联的 prompt，选中它
        if (chat.promptId && prompts.length > 0) {
          const prompt = prompts.find(p => p.id === chat.promptId);
          if (prompt) setSelectedPrompt(prompt);
        }
      }
      setShowHistory(false);
    } catch (err) {
      console.error('加载聊天记录失败:', err);
    }
  };

  // 删除历史对话
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      await window.electronAPI.chatHistory.delete(chatId);
      await loadChatHistory();
      // 如果删除的是当前对话，清空
      if (chatId === currentChatId) {
        setMessages([]);
        setCurrentChatId(null);
      }
    } catch (err) {
      console.error('删除聊天记录失败:', err);
    }
  };

  // 新建对话
  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setError('');
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setError('');
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI 问答助手</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            有任何学习问题，都可以问我
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 历史记录按钮 */}
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="历史记录"
            >
              <History size={16} className="text-gray-500" />
            </button>
            {showHistory && (
              <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 overflow-hidden">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">历史对话</span>
                  <button
                    onClick={newChat}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus size={14} />
                    新对话
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {chatHistoryList.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">暂无历史记录</div>
                  ) : (
                    chatHistoryList.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => loadChat(chat.id)}
                        className={cn(
                          'px-3 py-2 cursor-pointer flex items-center justify-between group',
                          currentChatId === chat.id
                            ? 'bg-primary/10'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm truncate',
                            currentChatId === chat.id ? 'text-primary' : 'text-gray-700 dark:text-gray-300'
                          )}>
                            {chat.title}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteChat(chat.id, e)}
                          className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Prompt 选择器 */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowPromptDropdown(!showPromptDropdown)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {selectedPrompt?.name || '默认'}
              </span>
              <ChevronDown size={16} className={cn(
                'text-gray-400 transition-transform',
                showPromptDropdown && 'rotate-180'
              )} />
            </button>
            {showPromptDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 py-1">
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => {
                      setSelectedPrompt(prompt);
                      setShowPromptDropdown(false);
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm transition-colors',
                      selectedPrompt?.id === prompt.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    )}
                  >
                    {prompt.name}
                    {prompt.isDefault && (
                      <span className="ml-2 text-xs text-gray-400">(默认)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* 清空对话按钮 */}
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              清空对话
            </button>
          )}
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={48} className="mb-4 opacity-80" />
              <p className="text-lg">开始和 {getAiName(aiConfig.provider, aiConfig.modelId)} 对话吧</p>
              <p className="text-sm mt-2">可以问我任何学习相关的问题</p>
            </div>
          ) : (
            <div className="space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden',
                    msg.role === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 dark:bg-gray-700'
                  )}
                >
                  {msg.role === 'user' ? <User size={16} /> : <AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={24} />}
                </div>
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-3 rounded-2xl',
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-tr-md whitespace-pre-wrap'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-md prose prose-sm dark:prose-invert max-w-none'
                  )}
                >
                  {msg.role === 'user' ? (
                    msg.content.trim()
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        code: ({ inline, children }) => 
                          inline ? (
                            <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-sm">{children}</code>
                          ) : (
                            <code className="block bg-gray-200 dark:bg-gray-600 p-2 rounded text-sm overflow-x-auto">{children}</code>
                          ),
                        pre: ({ children }) => <pre className="bg-gray-200 dark:bg-gray-600 p-3 rounded-lg overflow-x-auto mb-2">{children}</pre>,
                        table: ({ children }) => <table className="border-collapse border border-gray-300 dark:border-gray-500 my-2 w-full text-sm">{children}</table>,
                        th: ({ children }) => <th className="border border-gray-300 dark:border-gray-500 px-2 py-1 bg-gray-200 dark:bg-gray-600">{children}</th>,
                        td: ({ children }) => <td className="border border-gray-300 dark:border-gray-500 px-2 py-1">{children}</td>,
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-base font-bold mb-1">{children}</h3>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-500 pl-3 italic my-2">{children}</blockquote>,
                        hr: () => <hr className="my-3 border-gray-300 dark:border-gray-500" />,
                        a: ({ href, children }) => <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      }}
                    >
                      {preprocessLatex(msg.content.trim())}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            </div>
          )}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                <AiIcon provider={aiConfig.provider} modelId={aiConfig.modelId} size={24} />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-tl-md">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* 输入区域 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-3">
            <textarea
              id="ai-chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={cn(
                'px-4 rounded-xl flex items-center justify-center transition-colors',
                input.trim() && !loading
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              )}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
            按 Enter 发送，Shift + Enter 换行
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
