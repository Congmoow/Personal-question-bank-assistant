const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')
const { app } = require('electron')

let db = null
let dbPath = null

/**
 * 获取数据库文件路径（用户数据目录）
 */
function getDatabasePath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'question-bank.db')
}

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  if (db) return db

  const SQL = await initSqlJs()
  dbPath = getDatabasePath()

  // 确保目录存在
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // 如果数据库文件存在，加载它；否则创建新数据库
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 初始化表结构
  initializeTables()
  
  return db
}

/**
 * 初始化数据库表结构
 */
function initializeTables() {
  // 题库表
  db.run(`
    CREATE TABLE IF NOT EXISTS question_banks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)


  // 题目表
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('single', 'multiple', 'boolean', 'fill', 'short')),
      content TEXT NOT NULL,
      options TEXT,
      answer TEXT NOT NULL,
      analysis TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
    )
  `)

  // 操作日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 设置表
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // 草稿表
  db.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS wrong_book (
      question_id INTEGER PRIMARY KEY,
      bank_id INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_wrong_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建索引以提高查询性能
  db.run(`CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_questions_content ON questions(content)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_book_bank_id ON wrong_book(bank_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_book_last_wrong_at ON wrong_book(last_wrong_at)`)

  // 保存数据库
  saveDatabase()
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (db && dbPath) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(dbPath, buffer)
  }
}

/**
 * 获取数据库实例
 */
function getDatabase() {
  return db
}

/**
 * 关闭数据库连接
 */
function closeDatabase() {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}

// ==================== 题库 CRUD 操作 ====================

/**
 * 创建题库
 */
function createBank(name, description = '') {
  const stmt = db.prepare(`
    INSERT INTO question_banks (name, description, created_at, updated_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
  `)
  stmt.run([name, description])
  stmt.free()
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
  saveDatabase()
  
  return getBankById(id)
}

/**
 * 获取所有题库
 */
function getAllBanks() {
  const result = db.exec(`
    SELECT qb.*, COUNT(q.id) as question_count
    FROM question_banks qb
    LEFT JOIN questions q ON qb.id = q.bank_id
    GROUP BY qb.id
    ORDER BY qb.updated_at DESC
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    description: row[2],
    createdAt: row[3],
    updatedAt: row[4],
    questionCount: row[5]
  }))
}

/**
 * 根据ID获取题库
 */
function getBankById(id) {
  const result = db.exec(`
    SELECT qb.*, COUNT(q.id) as question_count
    FROM question_banks qb
    LEFT JOIN questions q ON qb.id = q.bank_id
    WHERE qb.id = ${id}
    GROUP BY qb.id
  `)
  
  if (!result.length || !result[0].values.length) return null
  
  const row = result[0].values[0]
  return {
    id: row[0],
    name: row[1],
    description: row[2],
    createdAt: row[3],
    updatedAt: row[4],
    questionCount: row[5]
  }
}

/**
 * 更新题库
 */
function updateBank(id, name, description = '') {
  const stmt = db.prepare(`
    UPDATE question_banks 
    SET name = ?, description = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run([name, description, id])
  stmt.free()
  saveDatabase()
  
  return getBankById(id)
}

/**
 * 删除题库（级联删除所有题目）
 */
function deleteBank(id) {
  // 先删除该题库下的所有题目
  db.run(`DELETE FROM questions WHERE bank_id = ${id}`)
  // 再删除题库
  db.run(`DELETE FROM question_banks WHERE id = ${id}`)
  saveDatabase()
}


// ==================== 题目 CRUD 操作 ====================

/**
 * 创建题目
 */
function createQuestion(bankId, data) {
  const { type, content, options, answer, analysis } = data
  const optionsJson = options ? JSON.stringify(options) : null
  
  const stmt = db.prepare(`
    INSERT INTO questions (bank_id, type, content, options, answer, analysis, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `)
  stmt.run([bankId, type, content, optionsJson, answer, analysis || null])
  stmt.free()
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
  
  // 更新题库的更新时间
  db.run(`UPDATE question_banks SET updated_at = datetime('now') WHERE id = ${bankId}`)
  saveDatabase()
  
  return getQuestionById(id)
}

/**
 * 根据题库ID获取题目列表（分页）
 */
function getQuestionsByBankId(bankId, offset = 0, limit = 20) {
  const result = db.exec(`
    SELECT * FROM questions 
    WHERE bank_id = ${bankId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => parseQuestionRow(row))
}

/**
 * 根据ID获取题目
 */
function getQuestionById(id) {
  const result = db.exec(`SELECT * FROM questions WHERE id = ${id}`)
  
  if (!result.length || !result[0].values.length) return null
  
  return parseQuestionRow(result[0].values[0])
}

/**
 * 解析题目行数据
 */
function parseQuestionRow(row) {
  return {
    id: row[0],
    bankId: row[1],
    type: row[2],
    content: row[3],
    options: row[4] ? JSON.parse(row[4]) : null,
    answer: row[5],
    analysis: row[6],
    createdAt: row[7],
    updatedAt: row[8]
  }
}

/**
 * 更新题目
 */
function updateQuestion(id, data) {
  const { type, content, options, answer, analysis } = data
  const optionsJson = options ? JSON.stringify(options) : null
  
  const stmt = db.prepare(`
    UPDATE questions 
    SET type = ?, content = ?, options = ?, answer = ?, analysis = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run([type, content, optionsJson, answer, analysis || null, id])
  stmt.free()
  
  // 获取题目所属题库并更新其更新时间
  const question = getQuestionById(id)
  if (question) {
    db.run(`UPDATE question_banks SET updated_at = datetime('now') WHERE id = ${question.bankId}`)
  }
  saveDatabase()
  
  return getQuestionById(id)
}

/**
 * 批量删除题目
 */
function deleteQuestions(ids) {
  if (!ids || ids.length === 0) return
  
  const idList = ids.join(',')
  
  // 获取受影响的题库ID
  const bankResult = db.exec(`SELECT DISTINCT bank_id FROM questions WHERE id IN (${idList})`)
  const bankIds = bankResult.length ? bankResult[0].values.map(row => row[0]) : []
  
  // 删除题目
  db.run(`DELETE FROM questions WHERE id IN (${idList})`)
  
  // 更新相关题库的更新时间
  bankIds.forEach(bankId => {
    db.run(`UPDATE question_banks SET updated_at = datetime('now') WHERE id = ${bankId}`)
  })
  
  saveDatabase()
}

// ==================== 搜索和筛选功能 ====================

/**
 * 搜索题目
 */
function searchQuestions(bankId, keyword = '', type = null, offset = 0, limit = 20) {
  let sql = `SELECT * FROM questions WHERE bank_id = ${bankId}`
  
  if (keyword) {
    // 转义特殊字符
    const escapedKeyword = keyword.replace(/'/g, "''")
    sql += ` AND content LIKE '%${escapedKeyword}%'`
  }
  
  if (type) {
    sql += ` AND type = '${type}'`
  }
  
  sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  
  const result = db.exec(sql)
  
  if (!result.length) return []
  
  return result[0].values.map(row => parseQuestionRow(row))
}

/**
 * 统计题目数量
 */
function countQuestions(bankId, keyword = '', type = null) {
  let sql = `SELECT COUNT(*) as count FROM questions WHERE bank_id = ${bankId}`
  
  if (keyword) {
    const escapedKeyword = keyword.replace(/'/g, "''")
    sql += ` AND content LIKE '%${escapedKeyword}%'`
  }
  
  if (type) {
    sql += ` AND type = '${type}'`
  }
  
  const result = db.exec(sql)
  
  if (!result.length) return 0
  
  return result[0].values[0][0]
}

// ==================== 统计功能 ====================

/**
 * 获取总题目数
 */
function getTotalQuestionCount() {
  const result = db.exec('SELECT COUNT(*) FROM questions')
  return result.length ? result[0].values[0][0] : 0
}

/**
 * 按题型统计题目数量
 */
function getQuestionCountByType(bankId = null) {
  let sql = `SELECT type, COUNT(*) as count FROM questions`
  if (bankId) {
    sql += ` WHERE bank_id = ${bankId}`
  }
  sql += ` GROUP BY type`
  
  const result = db.exec(sql)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    type: row[0],
    count: row[1]
  }))
}

/**
 * 获取最近N天新增的题目数量
 */
function getRecentQuestionCount(days) {
  const result = db.exec(`
    SELECT COUNT(*) FROM questions 
    WHERE created_at >= datetime('now', '-${days} days')
  `)
  return result.length ? result[0].values[0][0] : 0
}


// ==================== 操作日志功能 ====================

/**
 * 添加操作日志
 */
function addOperationLog(action, detail = '') {
  const stmt = db.prepare(`
    INSERT INTO operation_logs (action, detail, created_at)
    VALUES (?, ?, datetime('now'))
  `)
  stmt.run([action, detail])
  stmt.free()
  saveDatabase()
}

/**
 * 获取操作日志
 */
function getOperationLogs(limit = 10) {
  const result = db.exec(`
    SELECT * FROM operation_logs 
    ORDER BY created_at DESC 
    LIMIT ${limit}
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    id: row[0],
    action: row[1],
    detail: row[2],
    createdAt: row[3]
  }))
}

// ==================== 设置功能 ====================

/**
 * 获取设置值
 */
function getSetting(key) {
  const result = db.exec(`SELECT value FROM settings WHERE key = '${key}'`)
  return result.length && result[0].values.length ? result[0].values[0][0] : null
}

/**
 * 设置值
 */
function setSetting(key, value) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES (?, ?)
  `)
  stmt.run([key, value])
  stmt.free()
  saveDatabase()
}

// ==================== 草稿功能 ====================

/**
 * 保存草稿
 */
function saveDraft(data) {
  const jsonData = JSON.stringify(data)
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO drafts (id, data, saved_at)
    VALUES (1, ?, datetime('now'))
  `)
  stmt.run([jsonData])
  stmt.free()
  saveDatabase()
}

/**
 * 加载草稿
 */
function loadDraft() {
  const result = db.exec('SELECT data, saved_at FROM drafts WHERE id = 1')
  
  if (!result.length || !result[0].values.length) return null
  
  const row = result[0].values[0]
  return {
    ...JSON.parse(row[0]),
    savedAt: row[1]
  }
}

/**
 * 清除草稿
 */
function clearDraft() {
  db.run('DELETE FROM drafts WHERE id = 1')
  saveDatabase()
}

// ==================== AI 聊天记录功能 ====================

/**
 * 初始化聊天记录表（如果不存在）
 */
function initChatHistoryTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      messages TEXT NOT NULL,
      prompt_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_history_created ON chat_history(created_at)`)
  saveDatabase()
}

/**
 * 保存聊天记录
 */
function saveChatHistory(title, messages, promptId = null) {
  initChatHistoryTable()
  const messagesJson = JSON.stringify(messages)
  const stmt = db.prepare(`
    INSERT INTO chat_history (title, messages, prompt_id, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `)
  stmt.run([title, messagesJson, promptId])
  stmt.free()
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
  saveDatabase()
  
  return getChatHistoryById(id)
}

/**
 * 更新聊天记录
 */
function updateChatHistory(id, messages) {
  initChatHistoryTable()
  const messagesJson = JSON.stringify(messages)
  const stmt = db.prepare(`
    UPDATE chat_history 
    SET messages = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run([messagesJson, id])
  stmt.free()
  saveDatabase()
  
  return getChatHistoryById(id)
}

/**
 * 获取所有聊天记录
 */
function getAllChatHistory(limit = 50) {
  initChatHistoryTable()
  const result = db.exec(`
    SELECT id, title, prompt_id, created_at, updated_at 
    FROM chat_history 
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    id: row[0],
    title: row[1],
    promptId: row[2],
    createdAt: row[3],
    updatedAt: row[4]
  }))
}

/**
 * 根据 ID 获取聊天记录
 */
function getChatHistoryById(id) {
  initChatHistoryTable()
  const result = db.exec(`SELECT * FROM chat_history WHERE id = ${id}`)
  
  if (!result.length || !result[0].values.length) return null
  
  const row = result[0].values[0]
  return {
    id: row[0],
    title: row[1],
    messages: JSON.parse(row[2]),
    promptId: row[3],
    createdAt: row[4],
    updatedAt: row[5]
  }
}

/**
 * 删除聊天记录
 */
function deleteChatHistory(id) {
  initChatHistoryTable()
  db.run(`DELETE FROM chat_history WHERE id = ${id}`)
  saveDatabase()
}

// ==================== AI Prompt 管理功能 ====================

/**
 * 初始化 AI Prompt 表（如果不存在）
 */
function initPromptTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  // 检查是否有默认 prompt，如果没有则创建
  const result = db.exec('SELECT COUNT(*) FROM ai_prompts')
  if (result.length && result[0].values[0][0] === 0) {
    const defaultPrompt = `你是一个智能学习助手，专门帮助用户解答学习相关的问题。你可以：
1. 解答各学科的知识问题
2. 解释概念和原理
3. 提供学习建议和方法
4. 帮助分析和解决问题

请用简洁清晰的语言回答，必要时可以使用示例来说明。`
    const stmt = db.prepare(`
      INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
      VALUES (?, ?, 1, datetime('now'), datetime('now'))
    `)
    stmt.run(['默认', defaultPrompt])
    stmt.free()
  }
  saveDatabase()
}

/**
 * 获取所有 AI Prompt
 */
function getAllPrompts() {
  initPromptTable()
  const result = db.exec(`
    SELECT * FROM ai_prompts ORDER BY is_default DESC, created_at DESC
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    id: row[0],
    name: row[1],
    content: row[2],
    isDefault: row[3] === 1,
    createdAt: row[4],
    updatedAt: row[5]
  }))
}

/**
 * 根据 ID 获取 Prompt
 */
function getPromptById(id) {
  initPromptTable()
  const result = db.exec(`SELECT * FROM ai_prompts WHERE id = ${id}`)
  
  if (!result.length || !result[0].values.length) return null
  
  const row = result[0].values[0]
  return {
    id: row[0],
    name: row[1],
    content: row[2],
    isDefault: row[3] === 1,
    createdAt: row[4],
    updatedAt: row[5]
  }
}

/**
 * 创建 AI Prompt
 */
function createPrompt(name, content) {
  initPromptTable()
  const stmt = db.prepare(`
    INSERT INTO ai_prompts (name, content, is_default, created_at, updated_at)
    VALUES (?, ?, 0, datetime('now'), datetime('now'))
  `)
  stmt.run([name, content])
  stmt.free()
  
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0]
  saveDatabase()
  
  return getPromptById(id)
}

/**
 * 更新 AI Prompt
 */
function updatePrompt(id, name, content) {
  initPromptTable()
  const stmt = db.prepare(`
    UPDATE ai_prompts 
    SET name = ?, content = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
  stmt.run([name, content, id])
  stmt.free()
  saveDatabase()
  
  return getPromptById(id)
}

/**
 * 删除 AI Prompt
 */
function deletePrompt(id) {
  initPromptTable()
  // 不允许删除默认 prompt
  const prompt = getPromptById(id)
  if (prompt && prompt.isDefault) {
    throw new Error('不能删除默认 Prompt')
  }
  
  db.run(`DELETE FROM ai_prompts WHERE id = ${id}`)
  saveDatabase()
}

// ==================== 练习记录功能 ====================

/**
 * 初始化练习记录表（如果不存在）
 */
function initPracticeTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS practice_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id INTEGER NOT NULL,
      total INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      wrong INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_practice_bank_id ON practice_records(bank_id)`)
  saveDatabase()
}

/**
 * 保存练习记录
 */
function savePracticeRecord(record) {
  initPracticeTable()
  const { bankId, total, correct, wrong, accuracy } = record
  const stmt = db.prepare(`
    INSERT INTO practice_records (bank_id, total, correct, wrong, accuracy, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `)
  stmt.run([bankId, total, correct, wrong, accuracy])
  stmt.free()
  saveDatabase()
}

/**
 * 获取题库的练习记录
 */
function getPracticeRecords(bankId, limit = 20) {
  initPracticeTable()
  const result = db.exec(`
    SELECT * FROM practice_records 
    WHERE bank_id = ${bankId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    id: row[0],
    bankId: row[1],
    total: row[2],
    correct: row[3],
    wrong: row[4],
    accuracy: row[5],
    createdAt: row[6]
      ? (String(row[6]).includes('T')
        ? String(row[6])
        : `${String(row[6]).replace(' ', 'T')}Z`)
      : row[6]
  }))
}

/**
 * 获取所有题库的最新练习记录
 */
function getAllPracticeStats() {
  initPracticeTable()
  const result = db.exec(`
    SELECT 
      pr.bank_id,
      qb.name as bank_name,
      COUNT(*) as practice_count,
      AVG(pr.accuracy) as avg_accuracy,
      MAX(pr.created_at) as last_practice
    FROM practice_records pr
    JOIN question_banks qb ON pr.bank_id = qb.id
    GROUP BY pr.bank_id
    ORDER BY last_practice DESC
  `)
  
  if (!result.length) return []
  
  return result[0].values.map(row => ({
    bankId: row[0],
    bankName: row[1],
    practiceCount: row[2],
    avgAccuracy: Math.round(Number(row[3]) || 0),
    lastPractice: row[4]
      ? (String(row[4]).includes('T')
        ? String(row[4])
        : `${String(row[4]).replace(' ', 'T')}Z`)
      : row[4]
  }))
}

function initWrongBookTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS wrong_book (
      question_id INTEGER PRIMARY KEY,
      bank_id INTEGER NOT NULL,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_wrong_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_book_bank_id ON wrong_book(bank_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_book_last_wrong_at ON wrong_book(last_wrong_at)`)
  saveDatabase()
}

function cleanupWrongBookOrphans() {
  initWrongBookTable()
  db.run(`DELETE FROM wrong_book WHERE question_id NOT IN (SELECT id FROM questions)`)
  saveDatabase()
}

function getWrongBookCountsByBank() {
  cleanupWrongBookOrphans()
  const result = db.exec(`
    SELECT bank_id, COUNT(*) as count
    FROM wrong_book
    GROUP BY bank_id
  `)

  if (!result.length) return []

  return result[0].values.map(row => ({
    bankId: row[0],
    count: row[1]
  }))
}

function countWrongBookItems(bankId = null) {
  cleanupWrongBookOrphans()
  let sql = `SELECT COUNT(*) as count FROM wrong_book`
  if (bankId) {
    sql += ` WHERE bank_id = ${bankId}`
  }
  const result = db.exec(sql)
  if (!result.length || !result[0].values.length) return 0
  return result[0].values[0][0]
}

function getWrongBookItems(bankId = null, offset = 0, limit = 20) {
  cleanupWrongBookOrphans()
  let sql = `
    SELECT
      wb.question_id,
      wb.bank_id,
      wb.wrong_count,
      wb.correct_count,
      wb.added_at,
      wb.last_wrong_at,
      q.id,
      q.bank_id,
      q.type,
      q.content,
      q.options,
      q.answer,
      q.analysis,
      q.created_at,
      q.updated_at
    FROM wrong_book wb
    JOIN questions q ON wb.question_id = q.id
  `
  if (bankId) {
    sql += ` WHERE wb.bank_id = ${bankId}`
  }
  sql += ` ORDER BY wb.last_wrong_at DESC LIMIT ${limit} OFFSET ${offset}`

  const result = db.exec(sql)
  if (!result.length) return []

  return result[0].values.map(row => {
    const questionRow = row.slice(6)
    return {
      questionId: row[0],
      bankId: row[1],
      wrongCount: row[2],
      correctCount: row[3],
      addedAt: row[4],
      lastWrongAt: row[5],
      question: parseQuestionRow(questionRow)
    }
  })
}

function getRandomWrongQuestions(bankId = null, limit = 20) {
  cleanupWrongBookOrphans()
  let sql = `
    SELECT q.*
    FROM wrong_book wb
    JOIN questions q ON wb.question_id = q.id
  `
  if (bankId) {
    sql += ` WHERE wb.bank_id = ${bankId}`
  }
  sql += ` ORDER BY RANDOM() LIMIT ${limit}`

  const result = db.exec(sql)
  if (!result.length) return []
  return result[0].values.map(row => parseQuestionRow(row))
}

function removeWrongBookItem(questionId) {
  initWrongBookTable()
  db.run(`DELETE FROM wrong_book WHERE question_id = ${questionId}`)
  saveDatabase()
}

function clearWrongBook(bankId = null) {
  initWrongBookTable()
  if (bankId) {
    db.run(`DELETE FROM wrong_book WHERE bank_id = ${bankId}`)
  } else {
    db.run('DELETE FROM wrong_book')
  }
  saveDatabase()
}

function updateWrongBookFromPractice(results, threshold = 3) {
  initWrongBookTable()
  cleanupWrongBookOrphans()

  const removeThreshold = Number(threshold) > 0 ? Number(threshold) : 3

  const wrongUpsert = db.prepare(`
    INSERT INTO wrong_book (question_id, bank_id, wrong_count, correct_count, added_at, last_wrong_at)
    VALUES (?, ?, 1, 0, datetime('now'), datetime('now'))
    ON CONFLICT(question_id) DO UPDATE SET
      bank_id = excluded.bank_id,
      wrong_count = wrong_count + 1,
      last_wrong_at = datetime('now')
  `)

  const correctUpdate = db.prepare(`
    UPDATE wrong_book
    SET correct_count = correct_count + 1
    WHERE question_id = ?
  `)

  for (const r of results || []) {
    const questionId = Number(r.questionId)
    const bankId = Number(r.bankId)
    const isCorrect = !!r.isCorrect

    if (!Number.isFinite(questionId) || questionId <= 0) continue
    if (!Number.isFinite(bankId) || bankId <= 0) continue

    if (!isCorrect) {
      wrongUpsert.run([questionId, bankId])
      continue
    }

    correctUpdate.run([questionId])

    const countResult = db.exec(`SELECT correct_count FROM wrong_book WHERE question_id = ${questionId}`)
    if (countResult.length && countResult[0].values.length) {
      const correctCount = countResult[0].values[0][0]
      if (Number(correctCount) >= removeThreshold) {
        db.run(`DELETE FROM wrong_book WHERE question_id = ${questionId}`)
      }
    }
  }

  wrongUpsert.free()
  correctUpdate.free()
  saveDatabase()
}

// 导出所有函数
module.exports = {
  // 数据库管理
  initDatabase,
  getDatabase,
  closeDatabase,
  saveDatabase,
  getDatabasePath,
  
  // 题库操作
  createBank,
  getAllBanks,
  getBankById,
  updateBank,
  deleteBank,
  
  // 题目操作
  createQuestion,
  getQuestionsByBankId,
  getQuestionById,
  updateQuestion,
  deleteQuestions,
  
  // 搜索和筛选
  searchQuestions,
  countQuestions,
  
  // 统计
  getTotalQuestionCount,
  getQuestionCountByType,
  getRecentQuestionCount,
  
  // 操作日志
  addOperationLog,
  getOperationLogs,
  
  // 设置
  getSetting,
  setSetting,
  
  // 草稿
  saveDraft,
  loadDraft,
  clearDraft,
  
  // 练习记录
  savePracticeRecord,
  getPracticeRecords,
  getAllPracticeStats,

  getWrongBookCountsByBank,
  countWrongBookItems,
  getWrongBookItems,
  getRandomWrongQuestions,
  updateWrongBookFromPractice,
  removeWrongBookItem,
  clearWrongBook,
  
  // AI Prompt 管理
  getAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,

  // AI 聊天记录
  saveChatHistory,
  updateChatHistory,
  getAllChatHistory,
  getChatHistoryById,
  deleteChatHistory
}
