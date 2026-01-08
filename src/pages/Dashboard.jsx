import { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, Customized } from 'recharts';
import { FileQuestion, CheckSquare, Activity, Clock, Loader2, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDashboardStats, getOperationLogs, getTypeDistribution } from '../api';
import api from '../api';
import { useQuestionBanks } from '../contexts/QuestionBankContext';

// 题型名称映射
const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  boolean: '判断题',
  fill: '填空题',
  short: '简答题'
};

// 题型颜色
const COLORS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#722ED1'];

// 题型顺序
const TYPE_ORDER = ['single', 'multiple', 'boolean', 'fill', 'short'];

const Dashboard = () => {
  const { banks, fetchBanks: refreshBanks } = useQuestionBanks();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const leftColumnRef = useRef(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState(null);
  const [isLgLayout, setIsLgLayout] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalQuestions: 0,
    todayQuestions: 0,
    weekQuestions: 0,
    typeDistribution: []
  });
  const [operationLogs, setOperationLogs] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(null);
  const [isBankManuallySelected, setIsBankManuallySelected] = useState(false);
  const [practiceRecords, setPracticeRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [practiceStats, setPracticeStats] = useState([]);
  const [selectedTypeBankId, setSelectedTypeBankId] = useState(null);
  const [typeDistribution, setTypeDistribution] = useState([]);

  const normalizeDateString = (value) => {
    if (!value) return '';
    const s = String(value);
    if (s.includes('T')) return s;
    return s.replace(' ', 'T');
  };

  const safeTime = (value) => {
    const s = normalizeDateString(value);
    if (!s) return 0;
    const t = new Date(s).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const formatOperationTime = (value) => {
    const s = normalizeDateString(value);
    if (!s) return '';
    const iso = /Z$|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [stats, logs, allPracticeStats] = await Promise.all([
          getDashboardStats(),
          getOperationLogs(10),
          api.practice.getAllStats().catch((e) => {
            console.error('加载练习统计失败:', e);
            return [];
          })
        ]);
        
        setDashboardStats(stats);
        setOperationLogs(logs);
        setPracticeStats(Array.isArray(allPracticeStats) ? allPracticeStats : []);
        await refreshBanks();
      } catch (err) {
        console.error('加载数据失败:', err);
        setError(err.message || '加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 加载练习记录
  useEffect(() => {
    const loadPracticeRecords = async () => {
      if (!selectedBankId) {
        setPracticeRecords([]);
        return;
      }
      
      setLoadingRecords(true);
      try {
        const records = await api.practice.getRecords(selectedBankId, 10);
        // 反转顺序，让最早的在左边
        setPracticeRecords(records.reverse());
      } catch (error) {
        console.error('加载练习记录失败:', error);
      } finally {
        setLoadingRecords(false);
      }
    };

    loadPracticeRecords();
  }, [selectedBankId]);

  const practiceLastTimeByBankId = new Map(
    (practiceStats || []).map(s => [
      Number(s.bankId),
      s && s.lastPractice ? safeTime(s.lastPractice) : 0
    ])
  );

  const trendBanks = [...(banks || [])].sort((a, b) => {
    const aPractice = practiceLastTimeByBankId.get(Number(a.id)) || 0;
    const bPractice = practiceLastTimeByBankId.get(Number(b.id)) || 0;

    if (aPractice !== bPractice) return bPractice - aPractice;

    const aUpdated = a && a.updatedAt ? safeTime(a.updatedAt) : 0;
    const bUpdated = b && b.updatedAt ? safeTime(b.updatedAt) : 0;
    return bUpdated - aUpdated;
  });

  const latestPracticedBankId = (() => {
    let latest = null;
    for (const s of practiceStats || []) {
      const bankId = Number(s.bankId);
      const time = s && s.lastPractice ? safeTime(s.lastPractice) : 0;
      if (!Number.isFinite(bankId) || bankId <= 0) continue;
      if (!time) continue;
      if (!latest || time > latest.time) latest = { bankId, time };
    }
    if (!latest) return null;
    return trendBanks.some(b => Number(b.id) === latest.bankId) ? latest.bankId : null;
  })();

  // 设置默认选中的题库
  useEffect(() => {
    if (isBankManuallySelected) return;

    if (latestPracticedBankId) {
      if (selectedBankId !== latestPracticedBankId) {
        setSelectedBankId(latestPracticedBankId);
      }
      return;
    }

    if (!selectedBankId && trendBanks.length > 0) {
      setSelectedBankId(trendBanks[0].id);
    }
  }, [isBankManuallySelected, latestPracticedBankId, selectedBankId, trendBanks]);

  // 加载题型分布数据
  useEffect(() => {
    const loadTypeDistribution = async () => {
      try {
        const data = await getTypeDistribution(selectedTypeBankId);
        setTypeDistribution(data);
      } catch (error) {
        console.error('加载题型分布失败:', error);
      }
    };
    loadTypeDistribution();
  }, [selectedTypeBankId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsLgLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const measureLeftColumnHeight = () => {
    const el = leftColumnRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setLeftColumnHeight(Number.isFinite(h) ? h : null);
  };

  useEffect(() => {
    if (!leftColumnRef.current) return;
    const el = leftColumnRef.current;
    const ro = new ResizeObserver((entries) => {
      const h = entries?.[0]?.contentRect?.height;
      setLeftColumnHeight(Number.isFinite(h) ? h : null);
    });
    measureLeftColumnHeight();
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!isLgLayout) return;
    measureLeftColumnHeight();
    const raf = requestAnimationFrame(measureLeftColumnHeight);
    const t = setTimeout(measureLeftColumnHeight, 0);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [isLgLayout, loading, operationLogs.length]);

  const formatNumber = (num) => num.toLocaleString('zh-CN');

  const stats = [
    { title: '总题目数', value: formatNumber(dashboardStats.totalQuestions), icon: FileQuestion, color: 'text-primary', bg: 'bg-primary/10' },
    { title: '今日新增', value: formatNumber(dashboardStats.todayQuestions), icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: '本周新增', value: formatNumber(dashboardStats.weekQuestions), icon: Activity, color: 'text-success', bg: 'bg-success/10' },
  ];

  // 使用独立的题型分布数据
  const chartData = TYPE_ORDER.map(type => {
    const found = typeDistribution.find(item => item.type === type);
    return { name: TYPE_LABELS[type], value: found ? found.count : 0, type };
  }).filter(item => item.value > 0);

  const displayChartData = chartData.length > 0 ? chartData : [{ name: '暂无数据', value: 1 }];
  
  // 计算当前选中题库的总题数
  const currentTotalQuestions = typeDistribution.reduce((sum, item) => sum + item.count, 0);

  // 格式化练习记录为图表数据
  const practiceChartData = practiceRecords.map((record, index) => {
    const accuracy = record.accuracy;
    const createdAt = new Date(normalizeDateString(record.createdAt));
    return {
      name: `第${index + 1}次`,
      accuracy: accuracy,
      date: createdAt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      // 添加更多信息用于 Tooltip 显示
      fullDate: createdAt.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      totalQuestions: record.total || 0,
      correctCount: record.correct || 0,
      index: index + 1
    };
  });
  
  // 计算平均正确率来决定整体颜色
  const avgAccuracy = practiceChartData.length > 0 
    ? practiceChartData.reduce((sum, d) => sum + d.accuracy, 0) / practiceChartData.length 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          重新加载
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">数据看板</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">欢迎回来，查看今日题库概览</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>


      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* 左侧：准确率图表 + 题型分布 */}
        <div ref={leftColumnRef} className="flex-1 space-y-6 lg:self-start">
          {/* 练习正确率曲线图 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">练习正确率趋势</h3>
              </div>
              <select
                value={selectedBankId || ''}
                onChange={(e) => {
                  setIsBankManuallySelected(true);
                  setSelectedBankId(Number(e.target.value) || null);
                }}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">选择题库</option>
                {trendBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </select>
            </div>

            {loadingRecords ? (
              <div className="h-[160px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : practiceChartData.length === 0 ? (
              <div className="h-[160px] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                <TrendingUp className="w-10 h-10 mb-2 opacity-50" />
                <p>暂无练习记录</p>
                <p className="text-sm">完成练习后将显示正确率趋势</p>
              </div>
            ) : (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={practiceChartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="accuracyGradientGood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#165DFF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#165DFF" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="accuracyGradientBad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#94A3B8" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: '#86909C' }} 
                      axisLine={{ stroke: '#E5E6EB' }}
                      tickLine={false}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 11, fill: '#86909C' }} 
                      axisLine={{ stroke: '#4B5563', strokeWidth: 1 }}
                      tickLine={{ stroke: '#4B5563' }}
                      tickFormatter={(v) => `${v}%`}
                      width={45}
                    />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const data = payload[0].payload;
                        const isGood = data.accuracy >= 80;
                        return (
                          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-3 min-w-[140px]">
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              {data.fullDate} {data.time}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-2xl font-bold ${isGood ? 'text-primary' : 'text-orange-500'}`}>
                                {data.accuracy}%
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${isGood ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                {isGood ? '优秀' : data.accuracy >= 60 ? '及格' : '需加油'}
                              </span>
                            </div>
                            {data.totalQuestions > 0 && (
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                答对 <span className="font-medium text-green-600 dark:text-green-400">{data.correctCount}</span> / {data.totalQuestions} 题
                              </div>
                            )}
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              第 {data.index} 次练习
                            </div>
                          </div>
                        );
                      }}
                    />
                    {/* 自定义渲染分段平滑曲线和填充 */}
                    <Customized
                      component={(props) => {
                        const { xAxisMap, yAxisMap } = props;
                        if (!xAxisMap || !yAxisMap || !practiceChartData.length) return null;
                        
                        const xAxis = Object.values(xAxisMap)[0];
                        const yAxis = Object.values(yAxisMap)[0];
                        if (!xAxis || !yAxis) return null;
                        
                        const { x: chartX, width: chartWidth } = xAxis;
                        const { y: chartY, height: chartHeight } = yAxis;
                        const chartBottom = chartY + chartHeight;
                        const y80 = chartY + chartHeight - (80 / 100) * chartHeight;
                        
                        // 计算每个点的坐标
                        const points = practiceChartData.map((d, i) => {
                          const x = chartX + (i / (practiceChartData.length - 1 || 1)) * chartWidth;
                          const y = chartY + chartHeight - (d.accuracy / 100) * chartHeight;
                          return { x, y, accuracy: d.accuracy };
                        });
                        
                        if (points.length < 1) return null;
                        
                        const elements = [];
                        
                        // 生成平滑曲线上的采样点
                        const sampleCurve = (allPoints, numSamples = 50) => {
                          if (allPoints.length < 2) return allPoints;
                          const result = [];
                          for (let i = 0; i < allPoints.length - 1; i++) {
                            const p0 = allPoints[Math.max(0, i - 1)];
                            const p1 = allPoints[i];
                            const p2 = allPoints[i + 1];
                            const p3 = allPoints[Math.min(allPoints.length - 1, i + 2)];
                            
                            for (let t = 0; t < 1; t += 1 / numSamples) {
                              // Catmull-Rom 样条插值
                              const t2 = t * t;
                              const t3 = t2 * t;
                              const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
                              const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
                              const acc = 0.5 * ((2 * p1.accuracy) + (-p0.accuracy + p2.accuracy) * t + (2 * p0.accuracy - 5 * p1.accuracy + 4 * p2.accuracy - p3.accuracy) * t2 + (-p0.accuracy + 3 * p1.accuracy - 3 * p2.accuracy + p3.accuracy) * t3);
                              result.push({ x, y, accuracy: acc });
                            }
                          }
                          result.push(allPoints[allPoints.length - 1]);
                          return result;
                        };
                        
                        const curvePoints = sampleCurve(points);
                        
                        // 分段绘制：根据是否跨越80%来分割
                        let currentPath = [];
                        let currentFillPath = [];
                        let isCurrentHigh = curvePoints[0]?.accuracy >= 80;
                        
                        const flushPath = (isHigh) => {
                          if (currentPath.length < 2) return;
                          const color = isHigh ? '#165DFF' : '#F53F3F';
                          const fillColor = isHigh ? 'rgba(22, 93, 255, 0.15)' : 'rgba(245, 63, 63, 0.15)';
                          
                          // 绘制填充
                          const fillPoints = [...currentPath, { x: currentPath[currentPath.length - 1].x, y: chartBottom }, { x: currentPath[0].x, y: chartBottom }];
                          const fillD = fillPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
                          elements.push(<path key={`fill-${elements.length}`} d={fillD} fill={fillColor} />);
                          
                          // 绘制线条
                          const lineD = currentPath.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          elements.push(<path key={`line-${elements.length}`} d={lineD} stroke={color} strokeWidth={2} fill="none" />);
                        };
                        
                        for (let i = 0; i < curvePoints.length; i++) {
                          const p = curvePoints[i];
                          const isHigh = p.accuracy >= 80;
                          
                          if (isHigh !== isCurrentHigh && currentPath.length > 0) {
                            // 找到与80%线的交点
                            const lastP = currentPath[currentPath.length - 1];
                            const t = (80 - lastP.accuracy) / (p.accuracy - lastP.accuracy);
                            const intersectX = lastP.x + t * (p.x - lastP.x);
                            const intersectPoint = { x: intersectX, y: y80, accuracy: 80 };
                            
                            currentPath.push(intersectPoint);
                            flushPath(isCurrentHigh);
                            
                            currentPath = [intersectPoint];
                            isCurrentHigh = isHigh;
                          }
                          
                          currentPath.push(p);
                        }
                        
                        // 绘制最后一段
                        flushPath(isCurrentHigh);
                        
                        // 绘制数据点（最后绘制，确保在最上层）
                        points.forEach((p, i) => {
                          const isGood = p.accuracy >= 80;
                          elements.push(
                            <circle
                              key={`dot-${i}`}
                              cx={p.x}
                              cy={p.y}
                              r={3}
                              fill="#fff"
                              stroke={isGood ? '#165DFF' : '#F53F3F'}
                              strokeWidth={2}
                            />
                          );
                        });
                        
                        return <g>{elements}</g>;
                      }}
                    />
                    {/* 隐藏的Area用于Tooltip */}
                    <Area 
                      type="monotone" 
                      dataKey="accuracy"
                      stroke="transparent"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>

          {/* 题型分布 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">题型分布</h3>
              <select
                value={selectedTypeBankId || ''}
                onChange={(e) => setSelectedTypeBankId(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">全部题库</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-[260px] w-[260px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={displayChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} fill="#8884d8" paddingAngle={2} dataKey="value" stroke="none">
                      {displayChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartData.length > 0 ? COLORS[TYPE_ORDER.indexOf(entry.type) % COLORS.length] : '#E5E7EB'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px 12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedTypeBankId ? '题库题数' : '总题数'}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatNumber(selectedTypeBankId ? currentTotalQuestions : dashboardStats.totalQuestions)}</p>
                </div>
              </div>

              {/* Custom Legend */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                {TYPE_ORDER.map((type, index) => {
                  const found = typeDistribution.find(item => item.type === type);
                  const count = found ? found.count : 0;
                  const total = selectedTypeBankId ? currentTotalQuestions : dashboardStats.totalQuestions;
                  const percentage = total > 0 
                    ? ((count / total) * 100).toFixed(1) 
                    : '0.0';
                  
                  return (
                    <div key={type} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <div className="flex-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{TYPE_LABELS[type]}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-gray-900 dark:text-white">{count}</span>
                          <span className="text-xs text-gray-400">({percentage}%)</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 右侧：操作日志 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col w-full lg:w-72 xl:w-80 lg:self-start"
          style={isLgLayout && leftColumnHeight ? { height: leftColumnHeight, maxHeight: leftColumnHeight } : undefined}
        >
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 shrink-0">操作日志</h3>
          <div className="space-y-3 flex-1 overflow-y-auto min-h-0 scrollbar-hidden">
            {operationLogs.length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>暂无操作记录</p>
              </div>
            ) : (
              operationLogs.map((log, index) => (
                <div key={log.id} className="flex gap-2 items-stretch group">
                  <div className="relative flex flex-col items-center self-stretch">
                    <div className="w-2 h-2 rounded-full mt-1.5 bg-primary"></div>
                    {index < operationLogs.length - 1 && (
                      <div className="w-px flex-1 bg-gray-100 dark:bg-gray-700 mt-1"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-primary/10 text-primary">
                        {log.action}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatOperationTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {log.detail || '无详细信息'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
