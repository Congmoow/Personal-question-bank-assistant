import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  getAllQuestionBanks,
  createQuestionBank,
  updateQuestionBank,
  deleteQuestionBank,
  getQuestionBankById,
} from '../api'

/**
 * @typedef {import('../api').QuestionBank} QuestionBank
 */

/**
 * @typedef {Object} QuestionBankContextValue
 * @property {QuestionBank[]} banks - 题库列表
 * @property {boolean} loading - 加载状态
 * @property {string|null} error - 错误信息
 * @property {() => Promise<void>} fetchBanks - 获取所有题库
 * @property {(data: {name: string, description?: string}) => Promise<QuestionBank>} addBank - 创建题库
 * @property {(id: number, data: {name: string, description?: string}) => Promise<QuestionBank>} editBank - 更新题库
 * @property {(id: number) => Promise<void>} removeBank - 删除题库
 * @property {(id: number) => Promise<QuestionBank|null>} getBankById - 根据ID获取题库
 */

const QuestionBankContext = createContext(null)

/**
 * 题库状态管理 Provider
 * @param {{children: React.ReactNode}} props
 */
export function QuestionBankProvider({ children }) {
  const [banks, setBanks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 获取所有题库
  const fetchBanks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAllQuestionBanks()
      setBanks(data || [])
    } catch (err) {
      setError(err.message || '获取题库列表失败')
      setBanks([])
    } finally {
      setLoading(false)
    }
  }, [])


  // 创建题库
  const addBank = useCallback(async (data) => {
    setLoading(true)
    setError(null)
    try {
      const newBank = await createQuestionBank(data)
      setBanks((prev) => [...prev, newBank])
      return newBank
    } catch (err) {
      setError(err.message || '创建题库失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 更新题库
  const editBank = useCallback(async (id, data) => {
    setLoading(true)
    setError(null)
    try {
      const updatedBank = await updateQuestionBank(id, data)
      setBanks((prev) =>
        prev.map((bank) => (bank.id === id ? updatedBank : bank))
      )
      return updatedBank
    } catch (err) {
      setError(err.message || '更新题库失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除题库
  const removeBank = useCallback(async (id) => {
    setLoading(true)
    setError(null)
    try {
      await deleteQuestionBank(id)
      setBanks((prev) => prev.filter((bank) => bank.id !== id))
    } catch (err) {
      setError(err.message || '删除题库失败')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  // 根据ID获取题库
  const getBankById = useCallback(async (id) => {
    try {
      return await getQuestionBankById(id)
    } catch (err) {
      setError(err.message || '获取题库失败')
      return null
    }
  }, [])

  // 初始化时加载题库列表
  useEffect(() => {
    fetchBanks()
  }, [fetchBanks])

  const value = {
    banks,
    loading,
    error,
    fetchBanks,
    addBank,
    editBank,
    removeBank,
    getBankById,
  }

  return (
    <QuestionBankContext.Provider value={value}>
      {children}
    </QuestionBankContext.Provider>
  )
}

/**
 * 使用题库上下文的 Hook
 * @returns {QuestionBankContextValue}
 */
export function useQuestionBanks() {
  const context = useContext(QuestionBankContext)
  if (!context) {
    throw new Error('useQuestionBanks 必须在 QuestionBankProvider 内部使用')
  }
  return context
}

export default QuestionBankContext
