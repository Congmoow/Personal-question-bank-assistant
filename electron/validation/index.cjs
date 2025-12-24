/**
 * 验证服务模块
 * 提供题库名称和题目数据的验证功能
 */

// ==================== 题库名称验证 ====================

/**
 * 验证题库名称
 * @param {string} name - 题库名称
 * @returns {{ valid: boolean, errors: string[] }} 验证结果
 */
function validateBankName(name) {
  const errors = []

  if (name === null || name === undefined || name === '') {
    errors.push('题库名称不能为空')
    return { valid: false, errors }
  }

  if (typeof name !== 'string') {
    errors.push('题库名称必须是字符串')
    return { valid: false, errors }
  }

  if (name.trim() === '') {
    errors.push('题库名称不能仅包含空白字符')
    return { valid: false, errors }
  }

  if (name.length > 50) {
    errors.push('题库名称长度不能超过50字符')
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

// ==================== 题目验证 ====================

/**
 * 验证题目数据
 */
function validateQuestion(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['题目数据无效'] }
  }

  const { type, content } = data

  const contentResult = validateContent(content)
  if (!contentResult.valid) {
    return contentResult
  }

  switch (type) {
    case 'single':
      return validateSingleChoice(data)
    case 'multiple':
      return validateMultipleChoice(data)
    case 'boolean':
      return validateBoolean(data)
    case 'fill':
      return validateFillBlank(data)
    case 'short':
      return validateShortAnswer(data)
    default:
      return { valid: false, errors: ['无效的题型'] }
  }
}

/**
 * 验证题干内容
 */
function validateContent(content) {
  const errors = []

  if (content === null || content === undefined || content === '') {
    errors.push('题干内容不能为空')
    return { valid: false, errors }
  }

  if (typeof content !== 'string') {
    errors.push('题干内容必须是字符串')
    return { valid: false, errors }
  }

  if (content.trim() === '') {
    errors.push('题干内容不能仅包含空白字符')
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * 验证单选题
 */
function validateSingleChoice(data) {
  const errors = []
  const { options, answer } = data

  if (!options || !Array.isArray(options) || options.length < 2) {
    errors.push('单选题至少需要2个选项')
    return { valid: false, errors }
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (!opt || typeof opt !== 'object' || !opt.id || !opt.text) {
      errors.push(`选项 ${i + 1} 格式无效`)
      return { valid: false, errors }
    }
    if (typeof opt.text !== 'string' || opt.text.trim() === '') {
      errors.push(`选项 ${opt.id} 内容不能为空`)
      return { valid: false, errors }
    }
  }

  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    errors.push('单选题必须设置正确答案')
    return { valid: false, errors }
  }

  const optionIds = options.map(opt => opt.id)
  if (!optionIds.includes(answer)) {
    errors.push('答案必须是有效的选项')
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * 验证多选题
 */
function validateMultipleChoice(data) {
  const errors = []
  const { options, answer } = data

  if (!options || !Array.isArray(options) || options.length < 2) {
    errors.push('多选题至少需要2个选项')
    return { valid: false, errors }
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    if (!opt || typeof opt !== 'object' || !opt.id || !opt.text) {
      errors.push(`选项 ${i + 1} 格式无效`)
      return { valid: false, errors }
    }
    if (typeof opt.text !== 'string' || opt.text.trim() === '') {
      errors.push(`选项 ${opt.id} 内容不能为空`)
      return { valid: false, errors }
    }
  }

  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    errors.push('多选题必须设置正确答案')
    return { valid: false, errors }
  }

  const answerIds = answer.split('|').map(a => a.trim()).filter(a => a)
  if (answerIds.length < 1) {
    errors.push('多选题必须至少选择一个正确答案')
    return { valid: false, errors }
  }

  const optionIds = options.map(opt => opt.id)
  for (const answerId of answerIds) {
    if (!optionIds.includes(answerId)) {
      errors.push(`答案 "${answerId}" 不是有效的选项`)
      return { valid: false, errors }
    }
  }

  return { valid: true, errors: [] }
}

/**
 * 验证判断题
 */
function validateBoolean(data) {
  const errors = []
  const { answer } = data

  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    errors.push('判断题必须设置正确答案')
    return { valid: false, errors }
  }

  const validAnswers = ['正确', '错误']
  if (!validAnswers.includes(answer)) {
    errors.push('判断题答案必须是"正确"或"错误"')
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

/**
 * 验证填空题
 */
function validateFillBlank(data) {
  const errors = []
  const { content, answer } = data

  // 连续下划线算一个空（2个或更多）
  const blankPattern = /_{2,}/g
  const blanks = content.match(blankPattern)
  const blankCount = blanks ? blanks.length : 0

  if (blankCount === 0) {
    errors.push('填空题题干中必须包含至少一个空栏标记（__或更多下划线）')
    return { valid: false, errors }
  }

  if (!answer || typeof answer !== 'string' || answer.trim() === '') {
    errors.push('填空题必须设置答案')
    return { valid: false, errors }
  }

  const answers = answer.split('|')
  const answerCount = answers.length

  if (answerCount !== blankCount) {
    errors.push(`答案数量(${answerCount})与空栏数量(${blankCount})不匹配`)
    return { valid: false, errors }
  }

  for (let i = 0; i < answers.length; i++) {
    if (answers[i].trim() === '') {
      errors.push(`第 ${i + 1} 个空的答案不能为空`)
      return { valid: false, errors }
    }
  }

  return { valid: true, errors: [] }
}

/**
 * 验证简答题
 */
function validateShortAnswer(data) {
  const errors = []
  const { answer } = data

  if (answer !== null && answer !== undefined && answer !== '') {
    if (typeof answer !== 'string') {
      errors.push('答案必须是字符串')
      return { valid: false, errors }
    }
  }

  return { valid: true, errors: [] }
}

module.exports = {
  validateBankName,
  validateQuestion,
  validateContent,
  validateSingleChoice,
  validateMultipleChoice,
  validateBoolean,
  validateFillBlank,
  validateShortAnswer
}
