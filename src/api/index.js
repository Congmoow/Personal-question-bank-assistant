/**
 * 前端 API 调用层
 * 封装 window.electronAPI 调用，提供统一的接口
 */

/**
 * @typedef {'single' | 'multiple' | 'boolean' | 'fill' | 'short'} QuestionType
 * @typedef {'light' | 'dark' | 'system'} ThemeType
 */

/**
 * @typedef {Object} QuestionBank
 * @property {number} id
 * @property {string} name
 * @property {string|null} description
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} [questionCount]
 */

/**
 * @typedef {Object} QuestionOption
 * @property {string} id - A, B, C, D...
 * @property {string} text
 */

/**
 * @typedef {Object} Question
 * @property {number} id
 * @property {number} bankId
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]|null} options
 * @property {string} answer
 * @property {string|null} analysis
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreateQuestionInput
 * @property {number} bankId
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]} [options]
 * @property {string} answer
 * @property {string} [analysis]
 */

/**
 * @typedef {Object} PaginatedResult
 * @template T
 * @property {T[]} data
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {number} totalPages
 */


/**
 * @typedef {Object} QueryOptions
 * @property {number} [page]
 * @property {number} [pageSize]
 * @property {QuestionType} [type]
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} totalQuestions
 * @property {number} todayQuestions
 * @property {number} weekQuestions
 * @property {{type: QuestionType, count: number}[]} typeDistribution
 */

/**
 * @typedef {Object} OperationLog
 * @property {number} id
 * @property {string} action
 * @property {string} detail
 * @property {string} createdAt
 */

/**
 * @typedef {Object} DraftData
 * @property {QuestionType} type
 * @property {string} content
 * @property {QuestionOption[]} [options]
 * @property {string} [answer]
 * @property {string} [analysis]
 * @property {string} savedAt
 */

/**
 * @typedef {Object} ParseError
 * @property {number} row
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {Object} ParseResult
 * @property {CreateQuestionInput[]} valid
 * @property {ParseError[]} errors
 * @property {number} totalRows
 */

/**
 * @typedef {Object} ImportResult
 * @property {number} success
 * @property {number} failed
 * @property {ParseError[]} errors
 */

// 获取 electronAPI，如果不存在则返回 null
const getElectronAPI = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI
  }
  return null
}

// ==================== 题库 API ====================

/**
 * 创建题库
 * @param {{name: string, description?: string}} data
 * @returns {Promise<QuestionBank>}
 */
export const createQuestionBank = async (data) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.questionBank.create(data)
}

/**
 * 获取所有题库
 * @returns {Promise<QuestionBank[]>}
 */
export const getAllQuestionBanks = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.questionBank.getAll()
}

/**
 * 根据 ID 获取题库
 * @param {number} id
 * @returns {Promise<QuestionBank|null>}
 */
export const getQuestionBankById = async (id) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.questionBank.getById(id)
}

/**
 * 更新题库
 * @param {number} id
 * @param {{name: string, description?: string}} data
 * @returns {Promise<QuestionBank>}
 */
export const updateQuestionBank = async (id, data) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.questionBank.update(id, data)
}

/**
 * 删除题库
 * @param {number} id
 * @returns {Promise<void>}
 */
export const deleteQuestionBank = async (id) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.questionBank.delete(id)
}


// ==================== 题目 API ====================

/**
 * 创建题目
 * @param {CreateQuestionInput} data
 * @returns {Promise<Question>}
 */
export const createQuestion = async (data) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.create(data)
}

/**
 * 根据题库 ID 获取题目列表
 * @param {number} bankId
 * @param {QueryOptions} [options]
 * @returns {Promise<PaginatedResult<Question>>}
 */
export const getQuestionsByBankId = async (bankId, options = {}) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.getByBankId(bankId, options)
}

/**
 * 根据 ID 获取题目
 * @param {number} id
 * @returns {Promise<Question|null>}
 */
export const getQuestionById = async (id) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.getById(id)
}

/**
 * 更新题目
 * @param {number} id
 * @param {Partial<CreateQuestionInput>} data
 * @returns {Promise<Question>}
 */
export const updateQuestion = async (id, data) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.update(id, data)
}

/**
 * 删除题目
 * @param {number[]} ids
 * @returns {Promise<void>}
 */
export const deleteQuestions = async (ids) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.delete(ids)
}

/**
 * 搜索题目
 * @param {number} bankId
 * @param {string} keyword
 * @param {QueryOptions} [options]
 * @returns {Promise<PaginatedResult<Question>>}
 */
export const searchQuestions = async (bankId, keyword, options = {}) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.question.search(bankId, keyword, options)
}

// ==================== CSV API ====================

/**
 * 下载 CSV 模板
 * @returns {Promise<void>}
 */
export const downloadCsvTemplate = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.csv.downloadTemplate()
}

/**
 * 选择 CSV 文件
 * @returns {Promise<string|null>}
 */
export const selectCsvFile = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.csv.selectFile()
}

/**
 * 解析 CSV 文件
 * @param {string} filePath
 * @returns {Promise<ParseResult>}
 */
export const parseCsvFile = async (filePath) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.csv.parseFile(filePath)
}

/**
 * 导入题目
 * @param {number} bankId
 * @param {CreateQuestionInput[]} questions
 * @returns {Promise<ImportResult>}
 */
export const importQuestions = async (bankId, questions) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.csv.importQuestions(bankId, questions)
}

/**
 * 导出题库
 * @param {number} bankId
 * @returns {Promise<void>}
 */
export const exportQuestionBank = async (bankId) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.csv.exportBank(bankId)
}


// ==================== 统计 API ====================

/**
 * 获取仪表盘统计数据
 * @returns {Promise<DashboardStats>}
 */
export const getDashboardStats = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.stats.getDashboardStats()
}

/**
 * 获取操作日志
 * @param {number} [limit=10]
 * @returns {Promise<OperationLog[]>}
 */
export const getOperationLogs = async (limit = 10) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.stats.getOperationLogs(limit)
}

/**
 * 获取题型分布（可按题库筛选）
 * @param {number|null} [bankId=null]
 * @returns {Promise<{type: QuestionType, count: number}[]>}
 */
export const getTypeDistribution = async (bankId = null) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.stats.getTypeDistribution(bankId)
}

// ==================== 设置 API ====================

/**
 * 获取主题设置
 * @returns {Promise<ThemeType>}
 */
export const getTheme = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.getTheme()
}

/**
 * 设置主题
 * @param {ThemeType} theme
 * @returns {Promise<void>}
 */
export const setTheme = async (theme) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.setTheme(theme)
}

export const getWrongBookThreshold = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.getWrongBookThreshold()
}

export const setWrongBookThreshold = async (threshold) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.setWrongBookThreshold(threshold)
}

// ==================== 草稿 API ====================

/**
 * 保存草稿
 * @param {DraftData} data
 * @returns {Promise<void>}
 */
export const saveDraft = async (data) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.draft.save(data)
}

/**
 * 加载草稿
 * @returns {Promise<DraftData|null>}
 */
export const loadDraft = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.draft.load()
}

/**
 * 清除草稿
 * @returns {Promise<void>}
 */
export const clearDraft = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.draft.clear()
}

// ==================== 设置扩展 API ====================

/**
 * 获取 API 配置
 * @returns {Promise<{apiKey: string, apiUrl: string, modelId: string}>}
 */
export const getApiConfig = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.getApiConfig()
}

/**
 * 设置 API 配置
 * @param {{apiKey: string, apiUrl: string, modelId: string}} config
 * @returns {Promise<void>}
 */
export const setApiConfig = async (config) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.setApiConfig(config)
}

/**
 * 测试 API 连接
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const testApiConnection = async () => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.settings.testApiConnection()
}

// ==================== AI API ====================

/**
 * AI 解析题目
 * @param {string} content
 * @returns {Promise<{questions: CreateQuestionInput[]}>}
 */
export const parseQuestionsWithAI = async (content) => {
  const api = getElectronAPI()
  if (!api) throw new Error('Electron API 不可用')
  return api.ai.parseQuestions(content)
}

// ==================== 默认导出 ====================

export default {
  // 题库
  questionBank: {
    create: createQuestionBank,
    getAll: getAllQuestionBanks,
    getById: getQuestionBankById,
    update: updateQuestionBank,
    delete: deleteQuestionBank,
  },
  // 题目
  question: {
    create: createQuestion,
    getByBankId: getQuestionsByBankId,
    getById: getQuestionById,
    update: updateQuestion,
    delete: deleteQuestions,
    search: searchQuestions,
  },
  // CSV
  csv: {
    downloadTemplate: downloadCsvTemplate,
    selectFile: selectCsvFile,
    parseFile: parseCsvFile,
    import: importQuestions,
    export: exportQuestionBank,
  },
  // 统计
  stats: {
    getDashboard: getDashboardStats,
    getOperationLogs: getOperationLogs,
    getTypeDistribution: getTypeDistribution,
  },
  // 设置
  settings: {
    getTheme: getTheme,
    setTheme: setTheme,
    getApiConfig: getApiConfig,
    setApiConfig: setApiConfig,
    testApiConnection: testApiConnection,
    getWrongBookThreshold: getWrongBookThreshold,
    setWrongBookThreshold: setWrongBookThreshold,
  },
  // 草稿
  draft: {
    save: saveDraft,
    load: loadDraft,
    clear: clearDraft,
  },
  // AI
  ai: {
    parseQuestions: parseQuestionsWithAI,
  },
  // 练习
  practice: {
    saveRecord: async (record) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.practice.saveRecord(record)
    },
    getRecords: async (bankId, limit = 20) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.practice.getRecords(bankId, limit)
    },
    getAllStats: async () => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.practice.getAllStats()
    },
  },

  wrongBook: {
    getCountsByBank: async () => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.getCountsByBank()
    },
    getItems: async (bankId, options = {}) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.getItems(bankId, options)
    },
    getRandomQuestions: async (bankId, limit = 20) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.getRandomQuestions(bankId, limit)
    },
    updateFromPractice: async (results, threshold) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.updateFromPractice(results, threshold)
    },
    removeItem: async (questionId) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.removeItem(questionId)
    },
    clear: async (bankId) => {
      const api = getElectronAPI()
      if (!api) throw new Error('Electron API 不可用')
      return api.wrongBook.clear(bankId)
    },
  },
}
