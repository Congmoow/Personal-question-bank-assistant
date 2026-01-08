const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const database = require('./database/index.cjs')
const validation = require('./validation/index.cjs')
const csv = require('./csv/index.cjs')
const ai = require('./ai/index.cjs')

// 判断是否为开发环境
const isDev = !app.isPackaged

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
    frame: false, // 无边框窗口，使用自定义标题栏
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: true,
  })

  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false)

  // 窗口准备好后显示，避免白屏
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // 开发环境打开开发者工具
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 应用准备就绪时创建窗口
app.whenReady().then(async () => {
  // 初始化数据库
  await database.initDatabase()
  console.log('数据库初始化完成，路径:', database.getDatabasePath())
  
  createWindow()

  app.on('activate', () => {
    // macOS 上点击 dock 图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})


// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('settings:getWrongBookThreshold', async () => {
  try {
    const value = database.getSetting('wrong_book_threshold')
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3
  } catch (error) {
    console.error('获取错题本阈值失败:', error)
    throw error
  }
})

ipcMain.handle('settings:setWrongBookThreshold', async (event, threshold) => {
  try {
    const parsed = Number(threshold)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 999) {
      throw new Error('阈值必须是 1-999 的数字')
    }
    database.setSetting('wrong_book_threshold', String(parsed))
    database.addOperationLog('更改设置', `设置错题本移除阈值为: ${parsed}`)
    return { success: true }
  } catch (error) {
    console.error('设置错题本阈值失败:', error)
    throw error
  }
})

// ==================== 窗口控制 IPC 处理器 ====================
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false
})

// 应用退出前关闭数据库
app.on('before-quit', () => {
  database.closeDatabase()
})

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// ==================== IPC 处理器 ====================

// ==================== 题库相关 IPC 处理器 ====================

// 创建题库
ipcMain.handle('questionBank:create', async (event, data) => {
  try {
    const { name, description } = data
    
    // 验证题库名称
    const validationResult = validation.validateBankName(name)
    if (!validationResult.valid) {
      throw new Error(validationResult.errors[0])
    }
    
    const bank = database.createBank(name, description)
    database.addOperationLog('创建题库', `创建题库: ${name}`)
    return bank
  } catch (error) {
    console.error('创建题库失败:', error)
    throw error
  }
})

// 获取所有题库
ipcMain.handle('questionBank:getAll', async () => {
  try {
    return database.getAllBanks()
  } catch (error) {
    console.error('获取题库列表失败:', error)
    throw error
  }
})

// 根据ID获取题库
ipcMain.handle('questionBank:getById', async (event, id) => {
  try {
    return database.getBankById(id)
  } catch (error) {
    console.error('获取题库失败:', error)
    throw error
  }
})

// 更新题库
ipcMain.handle('questionBank:update', async (event, id, data) => {
  try {
    const { name, description } = data
    
    // 验证题库名称
    const validationResult = validation.validateBankName(name)
    if (!validationResult.valid) {
      throw new Error(validationResult.errors[0])
    }
    
    const bank = database.updateBank(id, name, description)
    database.addOperationLog('更新题库', `更新题库: ${name}`)
    return bank
  } catch (error) {
    console.error('更新题库失败:', error)
    throw error
  }
})

// 删除题库
ipcMain.handle('questionBank:delete', async (event, id) => {
  try {
    const bank = database.getBankById(id)
    const bankName = bank ? bank.name : `ID:${id}`
    
    database.deleteBank(id)
    database.addOperationLog('删除题库', `删除题库: ${bankName}`)
  } catch (error) {
    console.error('删除题库失败:', error)
    throw error
  }
})

// ==================== 题目相关 IPC 处理器 ====================

// 创建题目
ipcMain.handle('question:create', async (event, data) => {
  try {
    const { bankId, ...questionData } = data
    
    // 验证题目数据
    const validationResult = validation.validateQuestion(questionData)
    if (!validationResult.valid) {
      throw new Error(validationResult.errors[0])
    }
    
    const question = database.createQuestion(bankId, questionData)
    database.addOperationLog('添加题目', `添加${getTypeLabel(questionData.type)}到题库`)
    return question
  } catch (error) {
    console.error('创建题目失败:', error)
    throw error
  }
})

// 根据题库ID获取题目列表（分页）
ipcMain.handle('question:getByBankId', async (event, bankId, options = {}) => {
  try {
    const { page = 1, pageSize = 20, type } = options
    const offset = (page - 1) * pageSize
    
    let questions
    let total
    
    if (type) {
      questions = database.searchQuestions(bankId, '', type, offset, pageSize)
      total = database.countQuestions(bankId, '', type)
    } else {
      questions = database.getQuestionsByBankId(bankId, offset, pageSize)
      total = database.countQuestions(bankId)
    }
    
    return {
      data: questions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  } catch (error) {
    console.error('获取题目列表失败:', error)
    throw error
  }
})

// 根据ID获取题目
ipcMain.handle('question:getById', async (event, id) => {
  try {
    return database.getQuestionById(id)
  } catch (error) {
    console.error('获取题目失败:', error)
    throw error
  }
})

// 更新题目
ipcMain.handle('question:update', async (event, id, data) => {
  try {
    // 验证题目数据
    const validationResult = validation.validateQuestion(data)
    if (!validationResult.valid) {
      throw new Error(validationResult.errors[0])
    }
    
    const question = database.updateQuestion(id, data)
    database.addOperationLog('更新题目', `更新${getTypeLabel(data.type)}`)
    return question
  } catch (error) {
    console.error('更新题目失败:', error)
    throw error
  }
})

// 批量删除题目
ipcMain.handle('question:delete', async (event, ids) => {
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('请选择要删除的题目')
    }
    
    database.deleteQuestions(ids)
    database.addOperationLog('删除题目', `删除 ${ids.length} 道题目`)
  } catch (error) {
    console.error('删除题目失败:', error)
    throw error
  }
})

// 搜索题目
ipcMain.handle('question:search', async (event, bankId, keyword, options = {}) => {
  try {
    const { page = 1, pageSize = 20, type } = options
    const offset = (page - 1) * pageSize
    
    const questions = database.searchQuestions(bankId, keyword, type, offset, pageSize)
    const total = database.countQuestions(bankId, keyword, type)
    
    return {
      data: questions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  } catch (error) {
    console.error('搜索题目失败:', error)
    throw error
  }
})

// 题型标签映射
function getTypeLabel(type) {
  const labels = {
    single: '单选题',
    multiple: '多选题',
    boolean: '判断题',
    fill: '填空题',
    short: '简答题'
  }
  return labels[type] || '题目'
}


// ==================== CSV 相关 IPC 处理器 ====================

// 下载CSV模板
ipcMain.handle('csv:downloadTemplate', async () => {
  try {
    const templateContent = csv.generateTemplate()
    
    // 打开保存对话框
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存CSV模板',
      defaultPath: '题目导入模板.csv',
      filters: [
        { name: 'CSV文件', extensions: ['csv'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      // 使用UTF-8 BOM确保Excel正确识别编码
      const BOM = '\uFEFF'
      fs.writeFileSync(result.filePath, BOM + templateContent, 'utf8')
      database.addOperationLog('下载模板', '下载CSV导入模板')
      return { success: true, filePath: result.filePath }
    }
    
    return { success: false, canceled: true }
  } catch (error) {
    console.error('下载模板失败:', error)
    throw error
  }
})

// 选择CSV文件
ipcMain.handle('csv:selectFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择CSV文件',
      filters: [
        { name: 'CSV文件', extensions: ['csv'] }
      ],
      properties: ['openFile']
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] }
    }
    
    return { success: false, canceled: true }
  } catch (error) {
    console.error('选择文件失败:', error)
    throw error
  }
})

// 解析CSV文件
ipcMain.handle('csv:parseFile', async (event, filePath) => {
  try {
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8')
    
    // 移除BOM（如果存在）
    const cleanContent = content.replace(/^\uFEFF/, '')
    
    // 解析CSV
    const parseResult = csv.parseCSV(cleanContent)
    
    return parseResult
  } catch (error) {
    console.error('解析CSV文件失败:', error)
    throw error
  }
})

// 导入题目
ipcMain.handle('csv:import', async (event, bankId, questions) => {
  try {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('没有可导入的题目')
    }
    
    let successCount = 0
    const errors = []
    
    for (let i = 0; i < questions.length; i++) {
      try {
        // 验证题目数据
        const validationResult = validation.validateQuestion(questions[i])
        if (!validationResult.valid) {
          errors.push({
            index: i,
            message: validationResult.errors[0]
          })
          continue
        }
        
        database.createQuestion(bankId, questions[i])
        successCount++
      } catch (err) {
        errors.push({
          index: i,
          message: err.message
        })
      }
    }
    
    database.addOperationLog('导入题目', `导入 ${successCount} 道题目`)
    
    return {
      success: successCount,
      failed: errors.length,
      errors
    }
  } catch (error) {
    console.error('导入题目失败:', error)
    throw error
  }
})

// 导出题库为CSV
ipcMain.handle('csv:export', async (event, bankId) => {
  try {
    // 获取题库信息
    const bank = database.getBankById(bankId)
    if (!bank) {
      throw new Error('题库不存在')
    }
    
    // 获取所有题目
    const total = database.countQuestions(bankId)
    const questions = database.getQuestionsByBankId(bankId, 0, total)
    
    if (questions.length === 0) {
      throw new Error('题库中没有题目')
    }
    
    // 生成CSV内容
    const csvContent = csv.exportToCSV(questions)
    
    // 打开保存对话框
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出题库',
      defaultPath: `${bank.name}.csv`,
      filters: [
        { name: 'CSV文件', extensions: ['csv'] }
      ]
    })
    
    if (!result.canceled && result.filePath) {
      // 使用UTF-8 BOM确保Excel正确识别编码
      const BOM = '\uFEFF'
      fs.writeFileSync(result.filePath, BOM + csvContent, 'utf8')
      database.addOperationLog('导出题库', `导出题库: ${bank.name}，共 ${questions.length} 道题目`)
      return { success: true, filePath: result.filePath, count: questions.length }
    }
    
    return { success: false, canceled: true }
  } catch (error) {
    console.error('导出题库失败:', error)
    throw error
  }
})

// ==================== 统计相关 IPC 处理器 ====================

// 获取仪表盘统计数据
ipcMain.handle('stats:getDashboard', async () => {
  try {
    const totalQuestions = database.getTotalQuestionCount()
    const todayQuestions = database.getRecentQuestionCount(1)
    const weekQuestions = database.getRecentQuestionCount(7)
    const typeDistribution = database.getQuestionCountByType()
    
    return {
      totalQuestions,
      todayQuestions,
      weekQuestions,
      typeDistribution
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    throw error
  }
})

// 获取操作日志
ipcMain.handle('stats:getOperationLogs', async (event, limit = 10) => {
  try {
    return database.getOperationLogs(limit)
  } catch (error) {
    console.error('获取操作日志失败:', error)
    throw error
  }
})

// 获取题型分布（可按题库筛选）
ipcMain.handle('stats:getTypeDistribution', async (event, bankId = null) => {
  try {
    return database.getQuestionCountByType(bankId)
  } catch (error) {
    console.error('获取题型分布失败:', error)
    throw error
  }
})

// ==================== 设置相关 IPC 处理器 ====================

// 获取主题设置
ipcMain.handle('settings:getTheme', async () => {
  try {
    const theme = database.getSetting('theme')
    return theme || 'system' // 默认跟随系统
  } catch (error) {
    console.error('获取主题设置失败:', error)
    throw error
  }
})

// 设置主题
ipcMain.handle('settings:setTheme', async (event, theme) => {
  try {
    // 验证主题值
    const validThemes = ['light', 'dark', 'system']
    if (!validThemes.includes(theme)) {
      throw new Error('无效的主题设置')
    }
    
    database.setSetting('theme', theme)
    database.addOperationLog('更改设置', `切换主题为: ${getThemeLabel(theme)}`)
  } catch (error) {
    console.error('设置主题失败:', error)
    throw error
  }
})

// 主题标签映射
function getThemeLabel(theme) {
  const labels = {
    light: '亮色',
    dark: '暗色',
    system: '跟随系统'
  }
  return labels[theme] || theme
}

// ==================== 草稿相关 IPC 处理器 ====================

// 保存草稿
ipcMain.handle('draft:save', async (event, data) => {
  try {
    if (!data || typeof data !== 'object') {
      throw new Error('草稿数据无效')
    }
    
    database.saveDraft(data)
    return { success: true }
  } catch (error) {
    console.error('保存草稿失败:', error)
    throw error
  }
})

// 加载草稿
ipcMain.handle('draft:load', async () => {
  try {
    return database.loadDraft()
  } catch (error) {
    console.error('加载草稿失败:', error)
    throw error
  }
})

// 清除草稿
ipcMain.handle('draft:clear', async () => {
  try {
    database.clearDraft()
    return { success: true }
  } catch (error) {
    console.error('清除草稿失败:', error)
    throw error
  }
})

// ==================== AI 相关 IPC 处理器 ====================

// 获取 API 配置
ipcMain.handle('settings:getApiConfig', async () => {
  try {
    const apiKey = database.getSetting('ai_api_key') || ''
    const apiUrl = database.getSetting('ai_api_url') || 'https://api.openai.com'
    const modelId = database.getSetting('ai_model_id') || 'gpt-3.5-turbo'
    const provider = database.getSetting('ai_provider') || 'custom'
    return { apiKey, apiUrl, modelId, provider }
  } catch (error) {
    console.error('获取 API 配置失败:', error)
    throw error
  }
})

// 设置 API 配置
ipcMain.handle('settings:setApiConfig', async (event, config) => {
  try {
    const { apiKey, apiUrl, modelId, provider } = config
    database.setSetting('ai_api_key', apiKey || '')
    database.setSetting('ai_api_url', apiUrl || 'https://api.openai.com')
    database.setSetting('ai_model_id', modelId || 'gpt-3.5-turbo')
    database.setSetting('ai_provider', provider || 'custom')
    database.addOperationLog('更改设置', '更新 AI API 配置')
    return { success: true }
  } catch (error) {
    console.error('设置 API 配置失败:', error)
    throw error
  }
})

// 测试 API 连接
ipcMain.handle('settings:testApiConnection', async () => {
  try {
    const apiKey = database.getSetting('ai_api_key')
    const apiUrl = database.getSetting('ai_api_url') || 'https://api.newcoin.top'
    const modelId = database.getSetting('ai_model_id') || 'minimax-m2'
    
    if (!apiKey) {
      throw new Error('请先配置 API Key')
    }
    
    await ai.testConnection(apiKey, apiUrl, modelId)
    return { success: true, message: 'API 连接成功' }
  } catch (error) {
    console.error('API 连接测试失败:', error)
    throw error
  }
})

// AI 解析题目
ipcMain.handle('ai:parseQuestions', async (event, content) => {
  try {
    const apiKey = database.getSetting('ai_api_key')
    const apiUrl = database.getSetting('ai_api_url') || 'https://api.newcoin.top'
    const modelId = database.getSetting('ai_model_id') || 'minimax-m2'
    
    if (!apiKey) {
      throw new Error('请先在设置中配置 API Key')
    }
    
    if (!content || content.trim() === '') {
      throw new Error('请输入要解析的题目内容')
    }
    
    const result = await ai.parseQuestionsWithAI(apiKey, apiUrl, modelId, content)
    const normalized = normalizeAiParseResult(result)
    database.addOperationLog('AI解析', `AI 解析了 ${normalized.questions?.length || 0} 道题目`)
    return normalized
  } catch (error) {
    console.error('AI 解析题目失败:', error)
    throw error
  }
})

function normalizeAiParseResult(result) {
  const questions = Array.isArray(result?.questions) ? result.questions : []
  return {
    ...result,
    questions: questions.map(normalizeAiQuestion).filter(Boolean)
  }
}

function normalizeAiQuestion(q) {
  if (!q || typeof q !== 'object') return null

  const type = typeof q.type === 'string' ? q.type.trim() : q.type
  const normalizedType = normalizeAiType(type)

  const normalized = {
    ...q,
    type: normalizedType
  }

  if (normalizedType === 'single' || normalizedType === 'multiple') {
    normalized.options = normalizeAiOptions(q.options)
  }

  normalized.answer = normalizeAiAnswer(normalizedType, q.answer)

  return normalized
}

function normalizeAiType(type) {
  const typeMap = {
    '单选题': 'single',
    '单选': 'single',
    single: 'single',
    '多选题': 'multiple',
    '多选': 'multiple',
    multiple: 'multiple',
    '判断题': 'boolean',
    '判断': 'boolean',
    boolean: 'boolean',
    '填空题': 'fill',
    '填空': 'fill',
    fill: 'fill',
    '简答题': 'short',
    '简答': 'short',
    short: 'short'
  }
  return typeMap[type] || type
}

function normalizeAiOptions(options) {
  if (!Array.isArray(options)) return options
  return options
    .map((opt, i) => {
      if (!opt || typeof opt !== 'object') return null
      const rawId = opt.id ?? String.fromCharCode(65 + i)
      const id = String(rawId).trim().toUpperCase()
      const text = opt.text == null ? '' : String(opt.text)
      return { ...opt, id, text }
    })
    .filter(Boolean)
}

function normalizeAiAnswer(type, answer) {
  if (type === 'multiple') {
    return normalizeMultipleAnswer(answer)
  }
  if (type === 'single') {
    if (answer == null) return answer
    return String(answer).trim().toUpperCase()
  }
  if (type === 'boolean') {
    if (answer == null) return answer
    const s = String(answer).trim()
    if (s === '√' || s.toLowerCase() === 'true') return '正确'
    if (s === '×' || s.toLowerCase() === 'false') return '错误'
    return s
  }
  return answer
}

function normalizeMultipleAnswer(answer) {
  if (Array.isArray(answer)) {
    return answer.map(a => String(a).trim().toUpperCase()).filter(Boolean).join('|')
  }

  if (answer == null) return answer

  let s = String(answer).trim().toUpperCase()
  if (!s) return s

  s = s.replace(/[，,、\s]+/g, '|')
  if (!s.includes('|') && /^[A-Z]+$/.test(s) && s.length > 1) {
    s = s.split('').join('|')
  }

  const parts = s.split('|').map(p => p.trim()).filter(Boolean)
  const letters = []
  for (const p of parts) {
    if (/^[A-Z]$/.test(p)) {
      letters.push(p)
      continue
    }
    if (/^[A-Z]+$/.test(p)) {
      letters.push(...p.split(''))
    }
  }

  const seen = new Set()
  const uniq = letters.filter(x => {
    if (seen.has(x)) return false
    seen.add(x)
    return true
  })

  return uniq.join('|')
}

// AI 问答对话
ipcMain.handle('ai:chat', async (event, messages, promptId) => {
  try {
    const apiKey = database.getSetting('ai_api_key')
    const apiUrl = database.getSetting('ai_api_url') || 'https://api.newcoin.top'
    const modelId = database.getSetting('ai_model_id') || 'minimax-m2'
    
    if (!apiKey) {
      throw new Error('请先在设置中配置 API Key')
    }
    
    if (!messages || messages.length === 0) {
      throw new Error('请输入问题')
    }
    
    // 获取自定义 prompt
    let customPrompt = null
    if (promptId) {
      const prompt = database.getPromptById(promptId)
      if (prompt) {
        customPrompt = prompt.content
      }
    }
    
    const result = await ai.chatWithAI(apiKey, apiUrl, modelId, messages, customPrompt)
    return result
  } catch (error) {
    console.error('AI 问答失败:', error)
    throw error
  }
})

// ==================== AI 聊天记录相关 IPC 处理器 ====================

// 保存聊天记录
ipcMain.handle('chatHistory:save', async (event, data) => {
  try {
    const { title, messages, promptId } = data
    if (!messages || messages.length === 0) {
      throw new Error('聊天记录不能为空')
    }
    const history = database.saveChatHistory(title || '新对话', messages, promptId)
    return history
  } catch (error) {
    console.error('保存聊天记录失败:', error)
    throw error
  }
})

// 更新聊天记录
ipcMain.handle('chatHistory:update', async (event, id, messages) => {
  try {
    if (!messages || messages.length === 0) {
      throw new Error('聊天记录不能为空')
    }
    const history = database.updateChatHistory(id, messages)
    return history
  } catch (error) {
    console.error('更新聊天记录失败:', error)
    throw error
  }
})

// 获取所有聊天记录
ipcMain.handle('chatHistory:getAll', async (event, limit) => {
  try {
    return database.getAllChatHistory(limit)
  } catch (error) {
    console.error('获取聊天记录列表失败:', error)
    throw error
  }
})

// 根据 ID 获取聊天记录
ipcMain.handle('chatHistory:getById', async (event, id) => {
  try {
    return database.getChatHistoryById(id)
  } catch (error) {
    console.error('获取聊天记录失败:', error)
    throw error
  }
})

// 删除聊天记录
ipcMain.handle('chatHistory:delete', async (event, id) => {
  try {
    database.deleteChatHistory(id)
  } catch (error) {
    console.error('删除聊天记录失败:', error)
    throw error
  }
})

// ==================== AI Prompt 相关 IPC 处理器 ====================

// 获取所有 Prompt
ipcMain.handle('prompt:getAll', async () => {
  try {
    return database.getAllPrompts()
  } catch (error) {
    console.error('获取 Prompt 列表失败:', error)
    throw error
  }
})

// 根据 ID 获取 Prompt
ipcMain.handle('prompt:getById', async (event, id) => {
  try {
    return database.getPromptById(id)
  } catch (error) {
    console.error('获取 Prompt 失败:', error)
    throw error
  }
})

// 创建 Prompt
ipcMain.handle('prompt:create', async (event, data) => {
  try {
    const { name, content } = data
    if (!name || !content) {
      throw new Error('名称和内容不能为空')
    }
    const prompt = database.createPrompt(name, content)
    database.addOperationLog('创建 Prompt', `创建 Prompt: ${name}`)
    return prompt
  } catch (error) {
    console.error('创建 Prompt 失败:', error)
    throw error
  }
})

// 更新 Prompt
ipcMain.handle('prompt:update', async (event, id, data) => {
  try {
    const { name, content } = data
    if (!name || !content) {
      throw new Error('名称和内容不能为空')
    }
    const prompt = database.updatePrompt(id, name, content)
    database.addOperationLog('更新 Prompt', `更新 Prompt: ${name}`)
    return prompt
  } catch (error) {
    console.error('更新 Prompt 失败:', error)
    throw error
  }
})

// 删除 Prompt
ipcMain.handle('prompt:delete', async (event, id) => {
  try {
    database.deletePrompt(id)
    database.addOperationLog('删除 Prompt', `删除 Prompt ID: ${id}`)
  } catch (error) {
    console.error('删除 Prompt 失败:', error)
    throw error
  }
})

// ==================== 练习相关 IPC 处理器 ====================

// 保存练习记录
ipcMain.handle('practice:saveRecord', async (event, record) => {
  try {
    database.savePracticeRecord(record)
    database.addOperationLog('完成练习', `正确率: ${record.accuracy}%`)
    return { success: true }
  } catch (error) {
    console.error('保存练习记录失败:', error)
    throw error
  }
})

// 获取题库练习记录
ipcMain.handle('practice:getRecords', async (event, bankId, limit = 20) => {
  try {
    return database.getPracticeRecords(bankId, limit)
  } catch (error) {
    console.error('获取练习记录失败:', error)
    throw error
  }
})

// 获取所有题库练习统计
ipcMain.handle('practice:getAllStats', async () => {
  try {
    return database.getAllPracticeStats()
  } catch (error) {
    console.error('获取练习统计失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:getCountsByBank', async () => {
  try {
    return database.getWrongBookCountsByBank()
  } catch (error) {
    console.error('获取错题本统计失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:getItems', async (event, bankId, options = {}) => {
  try {
    const { page = 1, pageSize = 20 } = options || {}
    const offset = (page - 1) * pageSize

    const realBankId = bankId ? Number(bankId) : null
    const total = database.countWrongBookItems(realBankId)
    const items = database.getWrongBookItems(realBankId, offset, pageSize)

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  } catch (error) {
    console.error('获取错题本列表失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:getRandomQuestions', async (event, bankId, limit = 20) => {
  try {
    const realBankId = bankId ? Number(bankId) : null
    const realLimit = Number(limit) > 0 ? Number(limit) : 20
    return database.getRandomWrongQuestions(realBankId, realLimit)
  } catch (error) {
    console.error('随机获取错题失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:updateFromPractice', async (event, results, threshold) => {
  try {
    let removeThreshold = threshold
    if (removeThreshold === undefined || removeThreshold === null) {
      removeThreshold = database.getSetting('wrong_book_threshold')
    }
    database.updateWrongBookFromPractice(results, removeThreshold)
    return { success: true }
  } catch (error) {
    console.error('同步错题本失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:removeItem', async (event, questionId) => {
  try {
    database.removeWrongBookItem(Number(questionId))
    return { success: true }
  } catch (error) {
    console.error('移除错题失败:', error)
    throw error
  }
})

ipcMain.handle('wrongBook:clear', async (event, bankId) => {
  try {
    const realBankId = bankId ? Number(bankId) : null
    database.clearWrongBook(realBankId)
    database.addOperationLog('清空错题本', realBankId ? `清空题库 ${realBankId} 的错题` : '清空全部错题')
    return { success: true }
  } catch (error) {
    console.error('清空错题本失败:', error)
    throw error
  }
})

// 导出 mainWindow 供其他模块使用
module.exports = { getMainWindow: () => mainWindow }
