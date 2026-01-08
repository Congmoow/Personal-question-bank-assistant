import { createContext, useContext, useState, useCallback } from 'react'
import {
  getQuestionsByBankId,
  searchQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestions,
  getQuestionById,
} from '../api'

/**
 * @typedef {import('../api').Question} Question
 * @typedef {import('../api').QuestionType} QuestionType
 * @typedef {import('../api').CreateQuestionInput} CreateQuestionInput
 * @typedef {import('../api').PaginatedResult} PaginatedResult
 */

/**
 * @typedef {Object} QuestionContextValue
 * @property {Question[]} questions - 题目列表
 * @property {number} total - 总数
 * @property {number} page - 当前页
 * @property {number} pageSize - 每页数量
 * @property {number} totalPages - 总页数
 * @property {boolean} loading - 加载状态
 * @property {string|null} error - 错误信息
 * @property {number|null} currentBankId - 当前题库ID
 * @property {string} searchKeyword - 搜索关键词
 * @property {QuestionType|null} filterType - 筛选题型
 * @property {number[]} selectedIds - 选中的题目ID
 * @property {(bankId: number, options?: {page?: number, pageSize?: number, type?: QuestionType}) => Promise<void>} fetchQuestions - 获取题目列表
 * @property {(bankId: number, keyword: string, options?: {page?: number, pageSize?: number, type?: QuestionType}) => Promise<void>} search - 搜索题目
 * @property {(data: CreateQuestionInput) => Promise<Question>} addQuestion - 创建题目
 * @property {(id: number, data: Partial<CreateQuestionInput>) => Promise<Question>} editQuestion - 更新题目
 * @property {(ids: number[]) => Promise<void>} removeQuestions - 删除题目
 * @property {(id: number) => Promise<Question|null>} getById - 根据ID获取题目
 * @property {(page: number) => void} setPage - 设置当前页
 * @property {(keyword: string) => void} setSearchKeyword - 设置搜索关键词
 * @property {(type: QuestionType|null) => void} setFilterType - 设置筛选题型
 * @property {(ids: number[]) => void} setSelectedIds - 设置选中的题目ID
 * @property {() => void} clearSelection - 清除选中
 * @property {() => void} selectAll - 全选当前页
 * @property {() => void} reset - 重置状态
 */

const QuestionContext = createContext(null)

const DEFAULT_PAGE_SIZE = 10

/**
 * 题目状态管理 Provider
 * @param {{children: React.ReactNode}} props
 */
export function QuestionProvider({ children }) {
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentBankId, setCurrentBankId] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterType, setFilterType] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])


  // 获取题目列表
  const fetchQuestions = useCallback(async (bankId, options = {}) => {
    setLoading(true)
    setError(null)
    setCurrentBankId(bankId)
    
    const queryOptions = {
      page: options.page || page,
      pageSize: options.pageSize || pageSize,
      type: options.type !== undefined ? options.type : filterType,
    }

    try {
      let result
      if (searchKeyword) {
        result = await searchQuestions(bankId, searchKeyword, queryOptions)
      } else {
        result = await getQuestionsByBankId(bankId, queryOptions)
      }
      
      setQuestions(result.data || [])
      setTotal(result.total || 0)
      setPage(result.page || 1)
      setTotalPages(result.totalPages || 0)
      setSelectedIds([])
    } catch (err) {
      setError(err.message || '获取题目列表失败')
      setQuestions([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, filterType, searchKeyword])

  // 搜索题目
  const search = useCallback(async (bankId, keyword, options = {}) => {
    setLoading(true)
    setError(null)
    setSearchKeyword(keyword)
    setCurrentBankId(bankId)
    
    const queryOptions = {
      page: options.page || 1,
      pageSize: options.pageSize || pageSize,
      type: options.type !== undefined ? options.type : filterType,
    }

    try {
      const result = await searchQuestions(bankId, keyword, queryOptions)
      setQuestions(result.data || [])
      setTotal(result.total || 0)
      setPage(result.page || 1)
      setTotalPages(result.totalPages || 0)
      setSelectedIds([])
    } catch (err) {
      setError(err.message || '搜索题目失败')
      setQuestions([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [pageSize, filterType])

  // 创建题目
  const addQuestion = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const newQuestion = await createQuestion(data)
      // 刷新列表
      if (currentBankId) {
        await fetchQuestions(currentBankId)
      }
      return newQuestion
    } catch (err) {
      setError(err.message || '创建题目失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [currentBankId, fetchQuestions])

  // 更新题目
  const editQuestion = useCallback(async (id, data) => {
    setLoading(true)
    setError(null)
    try {
      const updatedQuestion = await updateQuestion(id, data)
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? updatedQuestion : q))
      )
      return updatedQuestion
    } catch (err) {
      setError(err.message || '更新题目失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除题目
  const removeQuestions = useCallback(async (ids) => {
    setLoading(true)
    setError(null)
    try {
      await deleteQuestions(ids)
      setQuestions((prev) => prev.filter((q) => !ids.includes(q.id)))
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
      setTotal((prev) => prev - ids.length)
      // 如果当前页没有数据了，回到上一页
      if (questions.length === ids.length && page > 1) {
        setPage(page - 1)
      }
    } catch (err) {
      setError(err.message || '删除题目失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [questions.length, page])


  // 根据ID获取题目
  const getById = useCallback(async (id) => {
    try {
      return await getQuestionById(id)
    } catch (err) {
      setError(err.message || '获取题目失败')
      return null
    }
  }, [])

  // 清除选中
  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  // 全选当前页
  const selectAll = useCallback(() => {
    setSelectedIds(questions.map((q) => q.id))
  }, [questions])

  // 重置状态
  const reset = useCallback(() => {
    setQuestions([])
    setTotal(0)
    setPage(1)
    setTotalPages(0)
    setCurrentBankId(null)
    setSearchKeyword('')
    setFilterType(null)
    setSelectedIds([])
    setError(null)
  }, [])

  const value = {
    questions,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    currentBankId,
    searchKeyword,
    filterType,
    selectedIds,
    fetchQuestions,
    search,
    addQuestion,
    editQuestion,
    removeQuestions,
    getById,
    setPage,
    setSearchKeyword,
    setFilterType,
    setSelectedIds,
    clearSelection,
    selectAll,
    reset,
  }

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  )
}

/**
 * 使用题目上下文的 Hook
 * @returns {QuestionContextValue}
 */
export function useQuestions() {
  const context = useContext(QuestionContext)
  if (!context) {
    throw new Error('useQuestions 必须在 QuestionProvider 内部使用')
  }
  return context
}

export default QuestionContext
