import React, { useMemo, useState } from 'react';
import { AnalyzedReview, ThemeSummary } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, isValid } from 'date-fns';
import { Eye, EyeOff, Download } from 'lucide-react';
import { downloadChartAsImage } from '../utils/downloadImage';

interface TopicTrendsChartProps {
  allReviews: AnalyzedReview[];
  reviews: AnalyzedReview[];
  themes: ThemeSummary[];
  filterA: string[];
  filterB: string[];
}

const COLOR_PALETTE = ['#2590c4', '#bc195f', '#95147c', '#186a98', '#601b7b', '#074771'];
const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'];

export const TopicTrendsChart: React.FC<TopicTrendsChartProps> = ({ allReviews, reviews, themes, filterA, filterB }) => {
  const [timeAggregation, setTimeAggregation] = useState<'month' | '3-months' | '6-months' | '1-year'>('month');
  const [sentimentMode, setSentimentMode] = useState<'total' | 'positive' | 'negative'>('total');
  const [valueMode, setValueMode] = useState<'abs' | 'rel'>('abs');
  
  const isComparisonActive = !filterB.includes('none');

  const getFilterName = (filter: string[], label: string) => {
    if (filter.includes('all')) return `All Firms (Overall)`;
    if (filter.length === 1) return filter[0];
    return `${label} (${filter.length} Firms)`;
  };

  const filterAName = getFilterName(filterA, 'Filter A');
  const filterBName = getFilterName(filterB, 'Filter B');
  
  // Top 5 themes by default (computed once per dataset)
  const [hiddenThemes, setHiddenThemes] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    const counts: Record<string, number> = {};
    themes.forEach(t => counts[t.theme] = 0);
    allReviews.forEach(r => {
      r.themes.forEach(t => {
        if (counts[t.theme] !== undefined) counts[t.theme]++;
      });
    });
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);
      
    const hidden = new Set<string>();
    themes.forEach(t => {
      if (!top.includes(t.theme)) hidden.add(t.theme);
    });
    setHiddenThemes(hidden);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themes]); // Only run when themes array changes (new dataset)

  const chartData = useMemo(() => {
    const timeDataMap: Record<string, { 
      totalReviews: number, 
      totalReviewsA: number,
      totalReviewsB: number,
      themes: Record<string, { total: number, pos: number, neg: number }>,
      themesA: Record<string, { total: number, pos: number, neg: number }>,
      themesB: Record<string, { total: number, pos: number, neg: number }>
    }> = {};
    
    reviews.forEach(r => {
      let dateStr = r.Date;
      let timeKey = dateStr;
      try {
        const d = new Date(dateStr);
        if (isValid(d)) {
          if (timeAggregation === 'month') {
            timeKey = format(d, 'yyyy-MM');
          } else if (timeAggregation === '3-months') {
            const q = Math.floor(d.getMonth() / 3) + 1;
            timeKey = `${format(d, 'yyyy')}-Q${q}`;
          } else if (timeAggregation === '6-months') {
            const h = d.getMonth() < 6 ? 1 : 2;
            timeKey = `${format(d, 'yyyy')}-H${h}`;
          } else if (timeAggregation === '1-year') {
            timeKey = format(d, 'yyyy');
          }
        }
      } catch (e) {}

      if (!timeDataMap[timeKey]) {
        timeDataMap[timeKey] = { totalReviews: 0, totalReviewsA: 0, totalReviewsB: 0, themes: {}, themesA: {}, themesB: {} };
        themes.forEach(t => {
          timeDataMap[timeKey].themes[t.theme] = { total: 0, pos: 0, neg: 0 };
          timeDataMap[timeKey].themesA[t.theme] = { total: 0, pos: 0, neg: 0 };
          timeDataMap[timeKey].themesB[t.theme] = { total: 0, pos: 0, neg: 0 };
        });
      }
      
      const inA = filterA.includes('all') || filterA.includes(r.Location);
      const inB = filterB.includes('all') || filterB.includes(r.Location);

      timeDataMap[timeKey].totalReviews++;
      if (inA) timeDataMap[timeKey].totalReviewsA++;
      if (inB) timeDataMap[timeKey].totalReviewsB++;
      
      r.themes.forEach(t => {
        if (timeDataMap[timeKey].themes[t.theme]) {
          timeDataMap[timeKey].themes[t.theme].total++;
          if (t.sentiment === 'positive') timeDataMap[timeKey].themes[t.theme].pos++;
          if (t.sentiment === 'negative') timeDataMap[timeKey].themes[t.theme].neg++;

          if (inA) {
            timeDataMap[timeKey].themesA[t.theme].total++;
            if (t.sentiment === 'positive') timeDataMap[timeKey].themesA[t.theme].pos++;
            if (t.sentiment === 'negative') timeDataMap[timeKey].themesA[t.theme].neg++;
          }
          if (inB) {
            timeDataMap[timeKey].themesB[t.theme].total++;
            if (t.sentiment === 'positive') timeDataMap[timeKey].themesB[t.theme].pos++;
            if (t.sentiment === 'negative') timeDataMap[timeKey].themesB[t.theme].neg++;
          }
        }
      });
    });

    return Object.keys(timeDataMap).sort().map(timeKey => {
      const entry: any = { timeKey };
      const data = timeDataMap[timeKey];
      
      themes.forEach(t => {
        if (isComparisonActive) {
          const themeDataA = data.themesA[t.theme];
          const themeDataB = data.themesB[t.theme];
          let valA = 0;
          let valB = 0;

          if (valueMode === 'abs') {
            if (sentimentMode === 'total') { valA = themeDataA.total; valB = themeDataB.total; }
            else if (sentimentMode === 'positive') { valA = themeDataA.pos; valB = themeDataB.pos; }
            else if (sentimentMode === 'negative') { valA = themeDataA.neg; valB = themeDataB.neg; }
          } else {
            if (sentimentMode === 'total') {
              valA = data.totalReviewsA > 0 ? (themeDataA.total / data.totalReviewsA) * 100 : 0;
              valB = data.totalReviewsB > 0 ? (themeDataB.total / data.totalReviewsB) * 100 : 0;
            } else if (sentimentMode === 'positive') {
              valA = themeDataA.total > 0 ? (themeDataA.pos / themeDataA.total) * 100 : 0;
              valB = themeDataB.total > 0 ? (themeDataB.pos / themeDataB.total) * 100 : 0;
            } else if (sentimentMode === 'negative') {
              valA = themeDataA.total > 0 ? (themeDataA.neg / themeDataA.total) * 100 : 0;
              valB = themeDataB.total > 0 ? (themeDataB.neg / themeDataB.total) * 100 : 0;
            }
          }
          entry[`${t.theme}_A`] = Number(valA.toFixed(2));
          entry[`${t.theme}_B`] = Number(valB.toFixed(2));
        } else {
          const themeData = data.themes[t.theme];
          let val = 0;
          
          if (valueMode === 'abs') {
            if (sentimentMode === 'total') val = themeData.total;
            else if (sentimentMode === 'positive') val = themeData.pos;
            else if (sentimentMode === 'negative') val = themeData.neg;
          } else {
            if (sentimentMode === 'total') {
              val = data.totalReviews > 0 ? (themeData.total / data.totalReviews) * 100 : 0;
            } else if (sentimentMode === 'positive') {
              val = themeData.total > 0 ? (themeData.pos / themeData.total) * 100 : 0;
            } else if (sentimentMode === 'negative') {
              val = themeData.total > 0 ? (themeData.neg / themeData.total) * 100 : 0;
            }
          }
          
          entry[t.theme] = Number(val.toFixed(2));
        }
      });
      
      return entry;
    });
  }, [reviews, themes, timeAggregation, sentimentMode, valueMode, filterA, filterB, isComparisonActive]);

  const handleLegendClick = (theme: string) => {
    setHiddenThemes(prev => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  };

  const CustomDot = (props: any) => {
    const { cx, cy, stroke, value, shapeType, isFilled } = props;
    if (!cx || !cy || value === null) return null;
    
    const fill = isFilled ? stroke : '#fff';
    
    switch (shapeType) {
      case 'square':
        return <rect x={cx - 4} y={cy - 4} width={8} height={8} stroke={stroke} strokeWidth={2} fill={fill} />;
      case 'triangle':
        return <polygon points={`${cx},${cy-5} ${cx-5},${cy+5} ${cx+5},${cy+5}`} stroke={stroke} strokeWidth={2} fill={fill} />;
      case 'diamond':
        return <polygon points={`${cx},${cy-6} ${cx-5},${cy} ${cx},${cy+6} ${cx+5},${cy}`} stroke={stroke} strokeWidth={2} fill={fill} />;
      case 'cross':
        return (
          <g stroke={stroke} strokeWidth={2}>
            <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} />
            <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} />
          </g>
        );
      case 'star':
        return <polygon points={`${cx},${cy-5} ${cx-2},${cy-1} ${cx-6},${cy-1} ${cx-3},${cy+2} ${cx-4},${cy+6} ${cx},${cy+3} ${cx+4},${cy+6} ${cx+3},${cy+2} ${cx+6},${cy-1} ${cx+2},${cy-1}`} stroke={stroke} strokeWidth={1.5} fill={fill} />;
      case 'circle':
      default:
        return <circle cx={cx} cy={cy} r={4} stroke={stroke} strokeWidth={2} fill={fill} />;
    }
  };

  const CustomXAxisTick = ({ x, y, payload }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#565d64" fontSize={11}>
          {payload.value}
        </text>
      </g>
    );
  };

  const CustomYAxisTick = ({ x, y, payload }: any) => {
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={-5} y={0} dy={4} textAnchor="end" fill="#565d64" fontSize={11}>
          {payload.value}{valueMode === 'rel' ? '%' : ''}
        </text>
      </g>
    );
  };

  const renderCustomLegend = () => {
    return (
      <div className="flex flex-col items-center gap-4 pt-6 mt-4 border-t border-slate-100">
        {isComparisonActive && (
          <div className="flex items-center justify-center gap-8 mb-2 bg-slate-50 px-6 py-2 rounded-full">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <svg width="24" height="16" viewBox="0 0 24 16">
                <line x1="0" y1="8" x2="24" y2="8" stroke="#64748b" strokeWidth="2" />
              </svg>
              {filterAName}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <svg width="24" height="16" viewBox="0 0 24 16">
                <line x1="0" y1="8" x2="24" y2="8" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
              </svg>
              {filterBName}
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-4">
          {themes.map((t, idx) => {
            const isHidden = hiddenThemes.has(t.theme);
            const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
            const isDashed = idx >= COLOR_PALETTE.length;
            const shapeType = SHAPES[idx % SHAPES.length];
            const isFilled = Math.floor(idx / COLOR_PALETTE.length) % 2 === 0;
            
            const strokeColor = !isHidden ? color : '#b7b9bc';
            const fill = isFilled ? strokeColor : '#fff';

            const renderShape = (x: number = 8, y: number = 8) => (
              <g transform={`translate(${x}, ${y})`}>
                {shapeType === 'square' && <rect x="-4" y="-4" width="8" height="8" stroke={strokeColor} strokeWidth="2" fill={fill} />}
                {shapeType === 'triangle' && <polygon points="0,-5 -5,5 5,5" stroke={strokeColor} strokeWidth="2" fill={fill} />}
                {shapeType === 'diamond' && <polygon points="0,-6 -5,0 0,6 5,0" stroke={strokeColor} strokeWidth="2" fill={fill} />}
                {shapeType === 'cross' && (
                  <g stroke={strokeColor} strokeWidth="2">
                    <line x1="-4" y1="-4" x2="4" y2="4" />
                    <line x1="4" y1="-4" x2="-4" y2="4" />
                  </g>
                )}
                {shapeType === 'star' && <polygon points="0,-5 -2,-1 -6,-1 -3,2 -4,6 0,3 4,6 3,2 6,-1 2,-1" stroke={strokeColor} strokeWidth="1.5" fill={fill} />}
                {shapeType === 'circle' && <circle cx="0" cy="0" r="4" stroke={strokeColor} strokeWidth="2" fill={fill} />}
              </g>
            );

            return (
              <div 
                key={t.theme}
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => handleLegendClick(t.theme)}
              >
                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                  {isHidden ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
                </div>
                <svg width="24" height="16" viewBox="0 0 24 16" className="overflow-visible shrink-0">
                  {renderShape(12, 8)}
                  {isDashed && !isComparisonActive ? (
                    <line x1="0" y1="8" x2="24" y2="8" stroke={strokeColor} strokeWidth="2" strokeDasharray="4 4" />
                  ) : (
                    <line x1="0" y1="8" x2="24" y2="8" stroke={strokeColor} strokeWidth="2" />
                  )}
                </svg>
                <span className={`text-sm ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700 font-bold'}`}>
                  {t.theme}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col" id="chart-topic-trends">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-slate-800">Topic Trends Over Time</h2>
            <button 
              onClick={() => downloadChartAsImage('chart-topic-trends', 'topic_trends_over_time')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-500">
            {valueMode === 'abs' ? 'Absolute' : 'Relative'} {sentimentMode} mentions for top themes per {timeAggregation.replace('-', ' ')}.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setTimeAggregation('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeAggregation === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setTimeAggregation('3-months')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeAggregation === '3-months' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              3 Months
            </button>
            <button
              onClick={() => setTimeAggregation('6-months')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeAggregation === '6-months' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              6 Months
            </button>
            <button
              onClick={() => setTimeAggregation('1-year')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeAggregation === '1-year' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              1 Year
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setSentimentMode('total')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sentimentMode === 'total' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Total
            </button>
            <button
              onClick={() => setSentimentMode('positive')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sentimentMode === 'positive' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Positive
            </button>
            <button
              onClick={() => setSentimentMode('negative')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${sentimentMode === 'negative' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Negative
            </button>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setValueMode('abs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${valueMode === 'abs' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              # Abs
            </button>
            <button
              onClick={() => setValueMode('rel')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${valueMode === 'rel' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              % Rel
            </button>
          </div>
        </div>
      </div>

      <div className="h-[500px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="timeKey" 
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
              tick={<CustomXAxisTick />}
              dy={10}
            />
            <YAxis 
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={{ stroke: '#cbd5e1' }}
              tick={<CustomYAxisTick />}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              wrapperStyle={{ zIndex: 100 }}
              formatter={(value: number, name: string) => [`${value}${valueMode === 'rel' ? '%' : ''}`, name]}
            />
            
            {themes.flatMap((t, idx) => {
              if (hiddenThemes.has(t.theme)) return [];
              
              const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
              const isDashed = idx >= COLOR_PALETTE.length;
              const shapeType = SHAPES[idx % SHAPES.length];
              const isFilled = Math.floor(idx / COLOR_PALETTE.length) % 2 === 0;

              if (isComparisonActive) {
                return [
                  <Line
                    key={`${t.theme}_A`}
                    type="monotone"
                    dataKey={`${t.theme}_A`}
                    name={`${t.theme} (${filterAName})`}
                    stroke={color}
                    strokeWidth={2}
                    dot={<CustomDot shapeType={shapeType} isFilled={true} />}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />,
                  <Line
                    key={`${t.theme}_B`}
                    type="monotone"
                    dataKey={`${t.theme}_B`}
                    name={`${t.theme} (${filterBName})`}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={<CustomDot shapeType={shapeType} isFilled={false} />}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    connectNulls
                  />
                ];
              }

              return [
                <Line
                  key={t.theme}
                  type="monotone"
                  dataKey={t.theme}
                  name={t.theme}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={isDashed ? '5 5' : undefined}
                  dot={<CustomDot shapeType={shapeType} isFilled={isFilled} />}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />
              ];
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {renderCustomLegend()}
    </div>
  );
};
