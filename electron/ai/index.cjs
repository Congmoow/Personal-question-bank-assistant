/**
 * AI 服务模块
 * 支持多种 AI API：OpenAI、Claude、Gemini、DeepSeek、通义千问等
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')

// 提供商配置
const PROVIDER_CONFIG = {
  anthropic: {
    endpoint: '/v1/messages',
    authHeader: 'x-api-key',
    formatRequest: (model, messages, options = {}) => ({
      model,
      max_tokens: options.max_tokens || 4096,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      })),
      system: messages.find(m => m.role === 'system')?.content || ''
    }),
    parseResponse: (data) => {
      if (data.content && data.content[0]) {
        return data.content[0].text
      }
      throw new Error('Claude API 返回格式异常')
    }
  },
  gemini: {
    endpoint: '/v1beta/models/{model}:generateContent',
    authHeader: 'x-goog-api-key',
    formatRequest: (model, messages, options = {}) => ({
      contents: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      systemInstruction: messages.find(m => m.role === 'system') ? {
        parts: [{ text: messages.find(m => m.role === 'system').content }]
      } : undefined,
      generationConfig: {
        maxOutputTokens: options.max_tokens || 4096,
        temperature: options.temperature || 0.7
      }
    }),
    parseResponse: (data) => {
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text
      }
      throw new Error('Gemini API 返回格式异常')
    }
  }
}

/**
 * 调用 AI API 解析题目
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @param {string} content - 用户输入的题目文本
 * @returns {Promise<object>} 解析结果
 */
async function parseQuestionsWithAI(apiKey, baseUrl, model, content) {
  const systemPrompt = `你是一个专业的题目解析助手。用户会给你一段包含多道题目的文本，你需要将其解析为结构化的JSON格式。

请严格按照以下JSON格式输出，不要输出任何其他内容：
{
  "questions": [
    {
      "type": "single|multiple|boolean|fill|short",
      "content": "题干内容",
      "options": [
        {"id": "A", "text": "选项A内容"},
        {"id": "B", "text": "选项B内容"}
      ],
      "answer": "答案",
      "analysis": "解析（如果有）"
    }
  ]
}

题型说明：
- single: 单选题，answer 为单个选项如 "A"
- multiple: 多选题，answer 为多个选项用|分隔如 "A|B|C"
- boolean: 判断题，answer 为 "正确" 或 "错误"，不需要 options
- fill: 填空题，题干中用 ___ 表示空，answer 为答案用|分隔（多个空时），不需要 options
- short: 简答题，answer 为参考答案，不需要 options

注意事项：
1. 仔细识别题型，根据题目特征判断
2. 选择题必须有 options 数组
3. 判断题、填空题、简答题不需要 options
4. 如果无法识别某道题，跳过该题
5. 只输出JSON，不要有任何解释文字`

  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `请解析以下题目：\n\n${content}`
      }
    ],
    temperature: 0.1,
    max_tokens: 4096
  }

  return makeApiRequest(apiKey, baseUrl, requestBody)
}

/**
 * 测试 API 连接
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @returns {Promise<boolean>} 是否连接成功
 */
async function testConnection(apiKey, baseUrl, model) {
  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'user',
        content: '你好'
      }
    ],
    max_tokens: 10
  }

  return makeApiRequest(apiKey, baseUrl, requestBody)
}

/**
 * 检测提供商类型
 */
function detectProvider(baseUrl) {
  if (baseUrl.includes('anthropic.com')) return 'anthropic'
  if (baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini'
  return 'openai' // 默认使用 OpenAI 兼容格式
}

/**
 * 发送 API 请求（支持多种提供商）
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {object} requestBody - 请求体（OpenAI 格式）
 * @param {string} providerHint - 提供商提示
 * @returns {Promise<object>} 响应结果
 */
function makeApiRequest(apiKey, baseUrl, requestBody, providerHint = null) {
  return new Promise((resolve, reject) => {
    const provider = providerHint || detectProvider(baseUrl)
    const config = PROVIDER_CONFIG[provider]
    
    let url, finalBody, authHeader, authValue
    
    try {
      let fullUrl = baseUrl.replace(/\/+$/, '')
      
      if (config) {
        // 使用特定提供商配置
        let endpoint = config.endpoint
        if (endpoint.includes('{model}')) {
          endpoint = endpoint.replace('{model}', requestBody.model)
        }
        fullUrl = fullUrl + endpoint
        finalBody = config.formatRequest(requestBody.model, requestBody.messages, {
          max_tokens: requestBody.max_tokens,
          temperature: requestBody.temperature
        })
        authHeader = config.authHeader
        authValue = apiKey
      } else {
        // OpenAI 兼容格式
        if (!fullUrl.includes('/v1/chat/completions')) {
          fullUrl = fullUrl + '/v1/chat/completions'
        }
        finalBody = requestBody
        authHeader = 'Authorization'
        authValue = `Bearer ${apiKey}`
      }
      
      url = new URL(fullUrl)
    } catch (error) {
      reject(new Error(`无效的 API URL: ${baseUrl}`))
      return
    }

    const postData = JSON.stringify(finalBody)
    
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
    
    // 设置认证头
    if (authHeader === 'Authorization') {
      headers['Authorization'] = authValue
    } else {
      headers[authHeader] = authValue
    }
    
    // Claude 需要额外的版本头
    if (provider === 'anthropic') {
      headers['anthropic-version'] = '2023-06-01'
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers
    }

    const protocol = url.protocol === 'https:' ? https : http

    const req = protocol.request(options, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data)
          
          // 检查错误响应
          if (response.error) {
            reject(new Error(response.error.message || 'API 调用失败'))
            return
          }
          
          let content
          
          if (config && config.parseResponse) {
            // 使用特定提供商的解析器
            content = config.parseResponse(response)
          } else if (response.choices && response.choices[0] && response.choices[0].message) {
            // OpenAI 兼容格式
            content = response.choices[0].message.content
          } else {
            reject(new Error('API 返回格式异常'))
            return
          }
          
          // 尝试从返回内容中提取 JSON
          let jsonContent = content
          
          // 如果内容被 markdown 代码块包裹，提取其中的 JSON
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
          if (jsonMatch) {
            jsonContent = jsonMatch[1].trim()
          }
          
          try {
            const parsed = JSON.parse(jsonContent)
            resolve(parsed)
          } catch (parseError) {
            // 如果不是 JSON，可能是测试连接或聊天，直接返回成功
            resolve({ success: true, message: content })
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}, 原始响应: ${data.substring(0, 200)}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(new Error(`网络请求失败: ${error.message}`))
    })

    req.write(postData)
    req.end()
  })
}

/**
 * AI 问答对话
 * @param {string} apiKey - API Key
 * @param {string} baseUrl - API 基础 URL
 * @param {string} model - 模型 ID
 * @param {Array} messages - 对话历史
 * @param {string} customPrompt - 自定义 system prompt（可选）
 * @returns {Promise<object>} AI 回复
 */
async function chatWithAI(apiKey, baseUrl, model, messages, customPrompt = null) {
  const modelName = model || 'minimax-m2'
  
  // 如果有自定义 prompt，使用自定义的；否则使用默认的
  const systemPrompt = customPrompt || `你是 MiniMax 公司开发的 ${modelName} 大语言模型，是一个智能学习助手，专门帮助用户解答学习相关的问题。

关于你的身份：
- 你是由 MiniMax（稀宇科技）开发的 AI 助手
- 你的模型名称是 ${modelName}
- 你不是 GPT、ChatGPT、Claude 或其他公司的模型

你可以：
1. 解答各学科的知识问题
2. 解释概念和原理
3. 提供学习建议和方法
4. 帮助分析和解决问题

请用简洁清晰的语言回答，必要时可以使用示例来说明。`

  const requestBody = {
    model: model || 'minimax-m2',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ],
    temperature: 0.7,
    max_tokens: 2048
  }

  return makeApiRequest(apiKey, baseUrl, requestBody)
}

module.exports = {
  parseQuestionsWithAI,
  testConnection,
  chatWithAI
}
