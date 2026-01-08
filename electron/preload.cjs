const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 题库操作
  questionBank: {
    create: (data) => ipcRenderer.invoke('questionBank:create', data),
    getAll: () => ipcRenderer.invoke('questionBank:getAll'),
    getById: (id) => ipcRenderer.invoke('questionBank:getById', id),
    update: (id, data) => ipcRenderer.invoke('questionBank:update', id, data),
    delete: (id) => ipcRenderer.invoke('questionBank:delete', id),
  },

  // 题目操作
  question: {
    create: (data) => ipcRenderer.invoke('question:create', data),
    getByBankId: (bankId, options) => ipcRenderer.invoke('question:getByBankId', bankId, options),
    getById: (id) => ipcRenderer.invoke('question:getById', id),
    update: (id, data) => ipcRenderer.invoke('question:update', id, data),
    delete: (ids) => ipcRenderer.invoke('question:delete', ids),
    search: (bankId, keyword, options) => ipcRenderer.invoke('question:search', bankId, keyword, options),
  },

  // CSV 操作
  csv: {
    downloadTemplate: () => ipcRenderer.invoke('csv:downloadTemplate'),
    parseFile: (filePath) => ipcRenderer.invoke('csv:parseFile', filePath),
    importQuestions: (bankId, questions) => ipcRenderer.invoke('csv:import', bankId, questions),
    exportBank: (bankId) => ipcRenderer.invoke('csv:export', bankId),
    selectFile: () => ipcRenderer.invoke('csv:selectFile'),
  },

  // 统计
  stats: {
    getDashboardStats: () => ipcRenderer.invoke('stats:getDashboard'),
    getOperationLogs: (limit) => ipcRenderer.invoke('stats:getOperationLogs', limit),
    getTypeDistribution: (bankId) => ipcRenderer.invoke('stats:getTypeDistribution', bankId),
  },

  // 设置
  settings: {
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    setTheme: (theme) => ipcRenderer.invoke('settings:setTheme', theme),
    getApiConfig: () => ipcRenderer.invoke('settings:getApiConfig'),
    setApiConfig: (config) => ipcRenderer.invoke('settings:setApiConfig', config),
    testApiConnection: () => ipcRenderer.invoke('settings:testApiConnection'),
    getWrongBookThreshold: () => ipcRenderer.invoke('settings:getWrongBookThreshold'),
    setWrongBookThreshold: (threshold) => ipcRenderer.invoke('settings:setWrongBookThreshold', threshold),
  },

  // AI 功能
  ai: {
    parseQuestions: (content) => ipcRenderer.invoke('ai:parseQuestions', content),
    chat: (messages, promptId) => ipcRenderer.invoke('ai:chat', messages, promptId),
  },

  // Prompt 管理
  prompt: {
    getAll: () => ipcRenderer.invoke('prompt:getAll'),
    getById: (id) => ipcRenderer.invoke('prompt:getById', id),
    create: (data) => ipcRenderer.invoke('prompt:create', data),
    update: (id, data) => ipcRenderer.invoke('prompt:update', id, data),
    delete: (id) => ipcRenderer.invoke('prompt:delete', id),
  },

  // 聊天记录
  chatHistory: {
    save: (data) => ipcRenderer.invoke('chatHistory:save', data),
    update: (id, messages) => ipcRenderer.invoke('chatHistory:update', id, messages),
    getAll: (limit) => ipcRenderer.invoke('chatHistory:getAll', limit),
    getById: (id) => ipcRenderer.invoke('chatHistory:getById', id),
    delete: (id) => ipcRenderer.invoke('chatHistory:delete', id),
  },

  // 草稿
  draft: {
    save: (data) => ipcRenderer.invoke('draft:save', data),
    load: () => ipcRenderer.invoke('draft:load'),
    clear: () => ipcRenderer.invoke('draft:clear'),
  },

  // 练习
  practice: {
    saveRecord: (record) => ipcRenderer.invoke('practice:saveRecord', record),
    getRecords: (bankId, limit) => ipcRenderer.invoke('practice:getRecords', bankId, limit),
    getAllStats: () => ipcRenderer.invoke('practice:getAllStats'),
  },

  wrongBook: {
    getCountsByBank: () => ipcRenderer.invoke('wrongBook:getCountsByBank'),
    getItems: (bankId, options) => ipcRenderer.invoke('wrongBook:getItems', bankId, options),
    getRandomQuestions: (bankId, limit) => ipcRenderer.invoke('wrongBook:getRandomQuestions', bankId, limit),
    updateFromPractice: (results, threshold) => ipcRenderer.invoke('wrongBook:updateFromPractice', results, threshold),
    removeItem: (questionId) => ipcRenderer.invoke('wrongBook:removeItem', questionId),
    clear: (bankId) => ipcRenderer.invoke('wrongBook:clear', bankId),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
})
