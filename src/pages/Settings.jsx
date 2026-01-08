import { useState, useEffect } from 'react';
import { Key, TestTube, Loader2, CheckCircle, XCircle, Eye, EyeOff, Globe, Cpu, MessageSquare, Plus, Pencil, Trash2, ChevronDown, BookOpen } from 'lucide-react';
import api from '../api';

// 预设的 AI 提供商配置
const AI_PROVIDERS = [
  { id: 'custom', name: '自定义', url: '', models: [], placeholder: '请输入 API 地址' },
  { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'], placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Claude (Anthropic)', url: 'https://api.anthropic.com', models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], placeholder: 'sk-ant-...' },
  { id: 'gemini', name: 'Google Gemini', url: 'https://generativelanguage.googleapis.com', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'], placeholder: 'AIza...' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'], placeholder: 'sk-...' },
  { id: 'qwen', name: '通义千问 (阿里)', url: 'https://dashscope.aliyuncs.com/compatible-mode', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'], placeholder: 'sk-...' },
  { id: 'zhipu', name: '智谱 GLM', url: 'https://open.bigmodel.cn/api/paas', models: ['glm-4-plus', 'glm-4', 'glm-4-flash'], placeholder: '...' },
  { id: 'moonshot', name: 'Moonshot (月之暗面)', url: 'https://api.moonshot.cn', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], placeholder: 'sk-...' },
  { id: 'doubao', name: '豆包 (字节)', url: 'https://ark.cn-beijing.volces.com/api', models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k'], placeholder: '...' },
  { id: 'minimax', name: 'MiniMax', url: 'https://api.minimax.chat', models: ['abab6.5s-chat', 'abab5.5-chat'], placeholder: '...' },
  { id: 'baichuan', name: '百川智能', url: 'https://api.baichuan-ai.com', models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'], placeholder: 'sk-...' },
  { id: 'yi', name: '零一万物 (Yi)', url: 'https://api.lingyiwanwu.com', models: ['yi-large', 'yi-medium', 'yi-spark'], placeholder: '...' },
  { id: 'groq', name: 'Groq', url: 'https://api.groq.com/openai', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], placeholder: 'gsk_...' },
  { id: 'together', name: 'Together AI', url: 'https://api.together.xyz', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'], placeholder: '...' },
  { id: 'siliconflow', name: 'SiliconFlow', url: 'https://api.siliconflow.cn', models: ['Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3'], placeholder: 'sk-...' },
];

const Settings = () => {
  const [provider, setProvider] = useState('custom');
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.newcoin.top');
  const [modelId, setModelId] = useState('minimax-m2');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [wrongBookThreshold, setWrongBookThreshold] = useState('3');
  const [savingWrongBook, setSavingWrongBook] = useState(false);
  const [savedWrongBook, setSavedWrongBook] = useState(false);

  // Prompt 管理状态
  const [prompts, setPrompts] = useState([]);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // 加载 API 配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.settings.getApiConfig();
        setApiKey(config.apiKey || '');
        setApiUrl(config.apiUrl || 'https://api.newcoin.top');
        setModelId(config.modelId || 'minimax-m2');
        setProvider(config.provider || 'custom');
      } catch (error) {
        console.error('加载 API 配置失败:', error);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    const loadWrongBookThreshold = async () => {
      try {
        const threshold = await api.settings.getWrongBookThreshold();
        setWrongBookThreshold(String(threshold || 3));
      } catch (error) {
        console.error('加载错题本阈值失败:', error);
      }
    };
    loadWrongBookThreshold();
  }, []);

  // 切换提供商时更新 URL 和模型
  const handleProviderChange = (providerId) => {
    setProvider(providerId);
    const selected = AI_PROVIDERS.find(p => p.id === providerId);
    if (selected && selected.url) {
      setApiUrl(selected.url);
      if (selected.models.length > 0) {
        setModelId(selected.models[0]);
      }
    }
    setTestResult(null);
  };

  const currentProvider = AI_PROVIDERS.find(p => p.id === provider) || AI_PROVIDERS[0];

  // 加载 Prompt 列表
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const list = await window.electronAPI.prompt.getAll();
      setPrompts(list);
    } catch (error) {
      console.error('加载 Prompt 列表失败:', error);
    }
  };

  const handleSaveWrongBookThreshold = async () => {
    setSavingWrongBook(true);
    setSavedWrongBook(false);
    try {
      const parsed = Number(wrongBookThreshold);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
        alert('阈值必须是 1-999 的数字');
        return;
      }
      await api.settings.setWrongBookThreshold(parsed);
      setSavedWrongBook(true);
      setTimeout(() => setSavedWrongBook(false), 3000);
    } catch (error) {
      console.error('保存错题本阈值失败:', error);
    } finally {
      setSavingWrongBook(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !promptContent.trim()) return;
    
    setSavingPrompt(true);
    try {
      if (editingPrompt) {
        await window.electronAPI.prompt.update(editingPrompt.id, {
          name: promptName,
          content: promptContent
        });
      } else {
        await window.electronAPI.prompt.create({
          name: promptName,
          content: promptContent
        });
      }
      await loadPrompts();
      resetPromptForm();
    } catch (error) {
      console.error('保存 Prompt 失败:', error);
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleEditPrompt = (prompt) => {
    setEditingPrompt(prompt);
    setPromptName(prompt.name);
    setPromptContent(prompt.content);
    setShowPromptForm(true);
  };

  const handleDeletePrompt = async (id) => {
    if (!confirm('确定要删除这个 Prompt 吗？')) return;
    
    try {
      await window.electronAPI.prompt.delete(id);
      await loadPrompts();
    } catch (error) {
      alert(error.message || '删除失败');
    }
  };

  const resetPromptForm = () => {
    setEditingPrompt(null);
    setPromptName('');
    setPromptContent('');
    setShowPromptForm(false);
  };

  const handleSaveApiConfig = async () => {
    setSaving(true);
    setSaved(false);
    setTestResult(null);
    try {
      await api.settings.setApiConfig({ apiKey, apiUrl, modelId, provider });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('保存 API 配置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: '请先输入 API Key' });
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    try {
      // 先保存配置
      await api.settings.setApiConfig({ apiKey, apiUrl, modelId, provider });
      // 再测试连接
      const result = await api.settings.testApiConnection();
      setTestResult({ success: true, message: result.message || 'API 连接成功' });
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'API 连接失败' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">系统设置</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">配置 AI 功能。</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">错题本设置</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          错题本会记录练习中答错的题目。答对次数达到阈值后，该题会自动从错题本移除。
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              自动移除阈值（答对次数）
            </label>
            <input
              type="number"
              min={1}
              max={999}
              value={wrongBookThreshold}
              onChange={(e) => setWrongBookThreshold(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
          </div>

          {savedWrongBook && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <CheckCircle size={18} />
              <span className="text-sm">阈值已保存</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSaveWrongBookThreshold}
              disabled={savingWrongBook}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {savingWrongBook && <Loader2 size={16} className="animate-spin" />}
              保存设置
            </button>
          </div>
        </div>
      </div>

      {/* AI API 配置 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI API 配置</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          支持 OpenAI、Claude、Gemini、DeepSeek、通义千问、智谱等主流 AI 服务，配置后可使用 AI 智能识别和问答功能。
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
          {/* AI 提供商选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Globe size={16} />
              AI 服务提供商
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            >
              {AI_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* API 地址 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Globe size={16} />
              API 地址
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={currentProvider.placeholder || 'https://api.openai.com'}
              disabled={provider !== 'custom'}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {provider === 'custom' && (
              <p className="text-xs text-gray-400 mt-1">支持 OpenAI 兼容的 API 地址</p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Key size={16} />
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={currentProvider.placeholder || 'sk-xxxxxxxxxxxxxxxx'}
                className="w-full px-4 py-2.5 pr-10 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Cpu size={16} />
              模型
            </label>
            {currentProvider.models.length > 0 ? (
              <div className="space-y-2">
                <select
                  value={currentProvider.models.includes(modelId) ? modelId : ''}
                  onChange={(e) => setModelId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                >
                  {currentProvider.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!currentProvider.models.includes(modelId) && modelId && (
                    <option value={modelId}>{modelId} (自定义)</option>
                  )}
                </select>
                <input
                  type="text"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="或输入自定义模型 ID"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
                />
              </div>
            ) : (
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder="gpt-3.5-turbo"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            )}
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              testResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}>
              {testResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}

          {/* 保存成功提示 */}
          {saved && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <CheckCircle size={18} />
              <span className="text-sm">配置已保存</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveApiConfig}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              保存配置
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing || !apiKey}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <TestTube size={16} />}
              测试连接
            </button>
          </div>
        </div>
      </div>

      {/* AI Prompt 管理 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Prompt 管理</h2>
          </div>
          <button
            onClick={() => {
              resetPromptForm();
              setShowPromptForm(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            新建 Prompt
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          自定义 AI 问答的系统提示词，可以让 AI 扮演不同角色或专注于特定领域。
        </p>

        {/* Prompt 表单 */}
        {showPromptForm && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white">
              {editingPrompt ? '编辑 Prompt' : '新建 Prompt'}
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                名称
              </label>
              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                placeholder="如：英语老师、数学助手"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                提示词内容
              </label>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                placeholder="描述 AI 的角色、能力和回答风格..."
                rows={6}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt || !promptName.trim() || !promptContent.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingPrompt && <Loader2 size={16} className="animate-spin" />}
                保存
              </button>
              <button
                onClick={resetPromptForm}
                className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* Prompt 列表 */}
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{prompt.name}</h4>
                    {prompt.isDefault && (
                      <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">默认</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {prompt.content}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEditPrompt(prompt)}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Pencil size={16} />
                  </button>
                  {!prompt.isDefault && (
                    <button
                      onClick={() => handleDeletePrompt(prompt.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        说明：API Key 将安全存储在本地数据库中，不会上传到任何服务器。
      </p>
    </div>
  );
};

export default Settings;
