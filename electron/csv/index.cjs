/**
 * CSV服务模块
 * 提供CSV模板生成、解析和导出功能
 */

const Papa = require('papaparse')

// CSV列头定义
const CSV_HEADERS = ['题型', '题干', '选项A', '选项B', '选项C', '选项D', '选项E', '选项F', '答案', '解析']

// 题型映射
const TYPE_MAP = {
  '单选题': 'single',
  '多选题': 'multiple',
  '判断题': 'boolean',
  '填空题': 'fill',
  '简答题': 'short'
}

const TYPE_MAP_REVERSE = {
  'single': '单选题',
  'multiple': '多选题',
  'boolean': '判断题',
  'fill': '填空题',
  'short': '简答题'
}

// ==================== CSV模板生成 ====================

/**
 * 生成CSV模板
 */
function generateTemplate() {
  const exampleRows = [
    ['单选题', '以下哪个是JavaScript的基本数据类型？', 'String', 'Array', 'Object', 'Function', '', '', 'A', '字符串是JavaScript的基本数据类型'],
    ['多选题', '以下哪些是前端框架？', 'React', 'Vue', 'Node.js', 'Angular', '', '', 'A|B|D', 'React、Vue和Angular都是前端框架'],
    ['判断题', 'JavaScript是一种强类型语言。', '', '', '', '', '', '', '错误', 'JavaScript是弱类型语言'],
    ['填空题', 'HTML的全称是___，CSS的全称是___。', '', '', '', '', '', '', 'HyperText Markup Language|Cascading Style Sheets', ''],
    ['简答题', '请简述什么是闭包？', '', '', '', '', '', '', '闭包是指有权访问另一个函数作用域中变量的函数', '']
  ]

  const csv = Papa.unparse({
    fields: CSV_HEADERS,
    data: exampleRows
  }, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"'
  })

  return csv
}


// ==================== CSV解析功能 ====================

/**
 * 解析CSV文件内容
 */
function parseCSV(content) {
  const result = {
    valid: [],
    errors: [],
    totalRows: 0
  }

  const parsed = Papa.parse(content, {
    header: false,
    skipEmptyLines: true,
    quoteChar: '"',
    escapeChar: '"'
  })

  if (parsed.errors && parsed.errors.length > 0) {
    parsed.errors.forEach(err => {
      result.errors.push({
        row: err.row + 1,
        field: '',
        message: `CSV解析错误: ${err.message}`
      })
    })
  }

  const rows = parsed.data
  if (!rows || rows.length === 0) {
    return result
  }

  const firstRow = rows[0]
  let startIndex = 0
  
  if (firstRow && firstRow[0] === '题型') {
    startIndex = 1
  }

  result.totalRows = rows.length - startIndex

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 1

    if (!row || row.every(cell => !cell || cell.trim() === '')) {
      result.totalRows--
      continue
    }

    const parseResult = parseRow(row, rowNumber)
    
    if (parseResult.valid) {
      result.valid.push(parseResult.data)
    } else {
      result.errors.push(...parseResult.errors)
    }
  }

  return result
}

/**
 * 解析单行CSV数据
 */
function parseRow(row, rowNumber) {
  const errors = []

  const [typeStr, content, optA, optB, optC, optD, optE, optF, answer, analysis] = row.map(cell => 
    cell ? cell.trim() : ''
  )

  if (!typeStr) {
    errors.push({ row: rowNumber, field: '题型', message: '题型不能为空' })
    return { valid: false, errors }
  }

  const type = TYPE_MAP[typeStr]
  if (!type) {
    errors.push({ row: rowNumber, field: '题型', message: `无效的题型: ${typeStr}` })
    return { valid: false, errors }
  }

  if (!content) {
    errors.push({ row: rowNumber, field: '题干', message: '题干不能为空' })
    return { valid: false, errors }
  }

  const questionData = {
    type,
    content,
    answer: answer || '',
    analysis: analysis || null
  }

  if (type === 'single' || type === 'multiple') {
    const options = []
    const optionValues = [
      { id: 'A', text: optA },
      { id: 'B', text: optB },
      { id: 'C', text: optC },
      { id: 'D', text: optD },
      { id: 'E', text: optE },
      { id: 'F', text: optF }
    ]

    for (const opt of optionValues) {
      if (opt.text) {
        options.push(opt)
      }
    }

    if (options.length < 2) {
      errors.push({ row: rowNumber, field: '选项', message: '选择题至少需要2个选项' })
      return { valid: false, errors }
    }

    questionData.options = options

    if (!answer) {
      errors.push({ row: rowNumber, field: '答案', message: '选择题必须设置答案' })
      return { valid: false, errors }
    }

    const optionIds = options.map(o => o.id)
    const answerIds = answer.split('|').map(a => a.trim())
    
    for (const aid of answerIds) {
      if (!optionIds.includes(aid)) {
        errors.push({ row: rowNumber, field: '答案', message: `答案 "${aid}" 不是有效的选项` })
        return { valid: false, errors }
      }
    }

    if (type === 'single' && answerIds.length > 1) {
      errors.push({ row: rowNumber, field: '答案', message: '单选题只能有一个答案' })
      return { valid: false, errors }
    }
  }

  if (type === 'boolean') {
    if (!answer) {
      errors.push({ row: rowNumber, field: '答案', message: '判断题必须设置答案' })
      return { valid: false, errors }
    }
    if (answer !== '正确' && answer !== '错误') {
      errors.push({ row: rowNumber, field: '答案', message: '判断题答案必须是"正确"或"错误"' })
      return { valid: false, errors }
    }
  }

  if (type === 'fill') {
    // 连续下划线算一个空
    const blankCount = (content.match(/_{2,}/g) || []).length;
    if (blankCount === 0) {
      errors.push({ row: rowNumber, field: '题干', message: '填空题题干必须包含空栏标记（__或更多下划线）' })
      return { valid: false, errors }
    }

    if (!answer) {
      errors.push({ row: rowNumber, field: '答案', message: '填空题必须设置答案' })
      return { valid: false, errors }
    }

    const answerCount = answer.split('|').length
    if (answerCount !== blankCount) {
      errors.push({ row: rowNumber, field: '答案', message: `答案数量(${answerCount})与空栏数量(${blankCount})不匹配` })
      return { valid: false, errors }
    }
  }

  return { valid: true, data: questionData, errors: [] }
}

// ==================== CSV导出功能 ====================

/**
 * 将题目列表导出为CSV格式
 */
function exportToCSV(questions) {
  const rows = questions.map(question => questionToRow(question))

  const csv = Papa.unparse({
    fields: CSV_HEADERS,
    data: rows
  }, {
    quotes: true,
    quoteChar: '"',
    escapeChar: '"'
  })

  return csv
}

/**
 * 将单个题目转换为CSV行
 */
function questionToRow(question) {
  const { type, content, options, answer, analysis } = question

  const typeStr = TYPE_MAP_REVERSE[type] || type

  let optA = '', optB = '', optC = '', optD = '', optE = '', optF = ''
  
  if (options && Array.isArray(options)) {
    options.forEach(opt => {
      switch (opt.id) {
        case 'A': optA = opt.text; break
        case 'B': optB = opt.text; break
        case 'C': optC = opt.text; break
        case 'D': optD = opt.text; break
        case 'E': optE = opt.text; break
        case 'F': optF = opt.text; break
      }
    })
  }

  return [
    typeStr,
    content || '',
    optA,
    optB,
    optC,
    optD,
    optE,
    optF,
    answer || '',
    analysis || ''
  ]
}

module.exports = {
  CSV_HEADERS,
  TYPE_MAP,
  TYPE_MAP_REVERSE,
  generateTemplate,
  parseCSV,
  parseRow,
  exportToCSV,
  questionToRow
}
