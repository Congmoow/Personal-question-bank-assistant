import React, { useState, useEffect } from 'react';
import { Upload, FileDown, CheckCircle, AlertCircle, FileText, X, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { downloadCsvTemplate, selectCsvFile, parseCsvFile, importQuestions, getQuestionBankById } from '../api';

const CsvImport = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bankId = searchParams.get('bankId');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, parsing, parsed, importing, success, error
  const [parseResult, setParseResult] = useState(null); // { valid: [], errors: [], totalRows: 0 }
  const [importResult, setImportResult] = useState(null); // { success: 0, failed: 0, errors: [] }
  const [errorMessage, setErrorMessage] = useState('');
  const [bank, setBank] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const steps = [
    { id: 1, title: '下载模板', desc: '获取标准导入格式' },
    { id: 2, title: '填写数据', desc: '按照规则完善信息' },
    { id: 3, title: '上传文件', desc: '拖拽或点击上传' },
  ];

  // 加载题库信息
  useEffect(() => {
    if (bankId) {
      getQuestionBankById(parseInt(bankId)).then(setBank).catch(console.error);
    }
  }, [bankId]);

  // 下载模板
  const handleDownloadTemplate = async () => {
    setDownloading(true);
    setErrorMessage('');
    try {
      const result = await downloadCsvTemplate();
      if (result.success) {
        setCurrentStep(2);
      } else if (!result.canceled) {
        setErrorMessage('下载模板失败');
      }
    } catch (error) {
      setErrorMessage(error.message || '下载模板失败');
    } finally {
      setDownloading(false);
    }
  };

  // 选择文件
  const handleSelectFile = async () => {
    setErrorMessage('');
    try {
      const result = await selectCsvFile();
      if (result.success && result.filePath) {
        const fileName = result.filePath.split(/[/\\]/).pop();
        setFile({ name: fileName, path: result.filePath });
        setFilePath(result.filePath);
        setUploadStatus('idle');
        setParseResult(null);
        setImportResult(null);
      }
    } catch (error) {
      setErrorMessage(error.message || '选择文件失败');
    }
  };

  // 解析文件
  const handleParseFile = async () => {
    if (!filePath) return;
    
    setUploadStatus('parsing');
    setErrorMessage('');
    
    try {
      const result = await parseCsvFile(filePath);
      setParseResult(result);
      setUploadStatus('parsed');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error.message || '解析文件失败');
    }
  };

  // 导入题目
  const handleImport = async () => {
    if (!parseResult || !parseResult.valid || parseResult.valid.length === 0) {
      setErrorMessage('没有可导入的有效题目');
      return;
    }
    
    if (!bankId) {
      setErrorMessage('请先选择题库');
      return;
    }
    
    setUploadStatus('importing');
    setErrorMessage('');
    
    try {
      const result = await importQuestions(parseInt(bankId), parseResult.valid);
      setImportResult(result);
      setUploadStatus('success');
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error.message || '导入失败');
    }
  };

  // 重置状态
  const handleReset = () => {
    setFile(null);
    setFilePath(null);
    setUploadStatus('idle');
    setParseResult(null);
    setImportResult(null);
    setErrorMessage('');
  };

  // 返回题库
  const handleBackToBank = () => {
    navigate('/question-preview');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBackToBank}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">批量导入</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {bank ? `导入到题库: ${bank.name}` : '通过CSV文件批量上传题目'}
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {errorMessage && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
          <AlertCircle size={20} className="text-danger" />
          <p className="text-sm text-danger">{errorMessage}</p>
          <button onClick={() => setErrorMessage('')} className="ml-auto text-danger hover:text-danger/80">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-100 dark:bg-gray-700 -z-0"></div>
          {steps.map((step) => {
            const isActive = currentStep >= step.id;
            const isCurrent = currentStep === step.id;
            
            return (
              <div 
                key={step.id} 
                className="relative z-10 flex flex-col items-center gap-3 cursor-pointer"
                onClick={() => setCurrentStep(step.id)}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300",
                  isActive ? "bg-primary text-white scale-110" : "bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                )}>
                  {step.id}
                </div>
                <div className="text-center bg-white dark:bg-gray-800 px-2">
                  <p className={cn("text-sm font-bold", isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400")}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden min-h-[400px]">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-12 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                <FileDown size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">下载标准模板</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
                  请务必使用系统提供的标准模板进行填写，不要修改表头信息，否则可能导致导入失败。
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleDownloadTemplate}
                  disabled={downloading}
                  className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-95 transition-all font-medium shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {downloading ? '下载中...' : '下载 CSV 模板'}
                </button>
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all font-medium"
                >
                  已有模板，跳过
                </button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
             <motion.div 
             key="step2"
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: -20 }}
             className="p-12"
           >
             <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">模板填写规范</h3>
             <div className="space-y-4">
               {[
                 '题型：单选题/多选题/判断题/填空题/简答题',
                 '题干：题目内容，填空题使用 ___ 表示空栏',
                 '选项A-F：选择题的选项内容，非选择题留空',
                 '答案：单选填选项字母(如A)，多选用|分隔(如A|B)，判断填"正确"或"错误"，填空用|分隔多个答案',
                 '解析：题目解析说明（可选）'
               ].map((rule, idx) => (
                 <div key={idx} className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                   <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                     {idx + 1}
                   </div>
                   <span className="text-gray-700 dark:text-gray-300 font-medium">{rule}</span>
                 </div>
               ))}
             </div>
             <div className="mt-8 flex justify-between">
               <button 
                 onClick={() => setCurrentStep(1)}
                 className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all font-medium"
               >
                 上一步
               </button>
               <button 
                 onClick={() => setCurrentStep(3)}
                 className="px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover active:scale-95 transition-all font-medium shadow-lg shadow-primary/30"
               >
                 我已填写完毕，下一步
               </button>
             </div>
           </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-12"
            >
              {!file ? (
                <div className="space-y-6">
                  <div 
                    onClick={handleSelectFile}
                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-12 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                  >
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:scale-110 group-hover:text-primary transition-all mb-6">
                      <Upload size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">点击选择文件</h3>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">支持扩展名：.csv</p>
                  </div>
                  <div className="flex justify-start">
                    <button 
                      onClick={() => setCurrentStep(2)}
                      className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all font-medium"
                    >
                      上一步
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 文件信息 */}
                  <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 dark:text-gray-100">{file.name}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">已选择文件</p>
                    </div>
                    {(uploadStatus === 'idle' || uploadStatus === 'parsed') && (
                      <button 
                        onClick={handleReset}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-500"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>

                  {/* 解析按钮 */}
                  {uploadStatus === 'idle' && (
                    <button 
                      onClick={handleParseFile}
                      className="w-full py-4 bg-primary text-white rounded-xl hover:bg-primary-hover active:scale-95 transition-all font-bold text-lg shadow-lg shadow-primary/30"
                    >
                      解析文件
                    </button>
                  )}

                  {/* 解析中 */}
                  {uploadStatus === 'parsing' && (
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 1.5 }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">正在解析数据...</p>
                    </div>
                  )}

                  {/* 解析结果预览 */}
                  {uploadStatus === 'parsed' && parseResult && (
                    <div className="space-y-4">
                      {/* 统计信息 */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{parseResult.totalRows}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">总行数</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{parseResult.valid.length}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">有效题目</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg text-center">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{parseResult.errors.length}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">错误行</p>
                        </div>
                      </div>

                      {/* 错误详情 */}
                      {parseResult.errors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 max-h-48 overflow-y-auto">
                          <h4 className="font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                            <AlertCircle size={18} />
                            错误详情
                          </h4>
                          <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                            {parseResult.errors.map((err, idx) => (
                              <li key={idx}>
                                第 {err.row} 行{err.field ? `，${err.field}` : ''}：{err.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* 导入按钮 */}
                      {parseResult.valid.length > 0 && (
                        <button 
                          onClick={handleImport}
                          disabled={!bankId}
                          className="w-full py-4 bg-primary text-white rounded-xl hover:bg-primary-hover active:scale-95 transition-all font-bold text-lg shadow-lg shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {bankId ? `导入 ${parseResult.valid.length} 道题目` : '请先选择题库'}
                        </button>
                      )}

                      {parseResult.valid.length === 0 && (
                        <div className="text-center py-4">
                          <p className="text-gray-500 dark:text-gray-400">没有可导入的有效题目，请检查CSV文件格式</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 导入中 */}
                  {uploadStatus === 'importing' && (
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '100%' }}
                          transition={{ duration: 2 }}
                          className="h-full bg-primary"
                        />
                      </div>
                      <p className="text-center text-sm text-gray-500 dark:text-gray-400">正在导入题目...</p>
                    </div>
                  )}

                  {/* 导入成功 */}
                  {uploadStatus === 'success' && importResult && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center">
                        <CheckCircle size={32} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">导入完成</h3>
                        <p className="text-green-600 dark:text-green-400 mt-1">
                          成功导入 {importResult.success} 道题目
                          {importResult.failed > 0 && (
                            <span className="text-red-500">，{importResult.failed} 道失败</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button 
                          onClick={handleReset}
                          className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          继续导入
                        </button>
                        <button 
                          onClick={handleBackToBank}
                          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                        >
                          返回题库
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 导入失败 */}
                  {uploadStatus === 'error' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">操作失败</h3>
                        <p className="text-red-600 dark:text-red-400 mt-1">{errorMessage || '未知错误'}</p>
                      </div>
                      <button 
                        onClick={handleReset}
                        className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        重新选择文件
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CsvImport;
