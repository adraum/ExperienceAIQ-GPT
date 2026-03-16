import React, { useMemo, useState } from 'react';
import { AnalyzedReview } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, LabelList, ReferenceLine, Cell } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { Eye, EyeOff, Download } from 'lucide-react';
import { downloadChartAsImage } from '../utils/downloadImage';

interface DashboardProps {
  reviews: AnalyzedReview[];
  filterA: string[];
  filterB: string[];
}

export const Dashboard: React.FC<DashboardProps> = ({ reviews, filterA, filterB }) => {
  const [timeAggregation, setTimeAggregation] = useState<'month' | '3-months' | '6-months' | '1-year'>('month');
  const [colorMode, setColorMode] = useState<'color' | 'grey'>('color');
  const [hiddenFirms, setHiddenFirms] = useState<Set<string>>(new Set());

  const isComparisonActive = !filterB.includes('none');

  const getFilterName = (filter: string[], label: string) => {
    if (filter.includes('all')) return `Average (All Locations)`;
    if (filter.length === 1) return filter[0];
    return `${label} (${filter.length} Locations)`;
  };

  const filterAName = getFilterName(filterA, 'Filter A');
  const filterBName = getFilterName(filterB, 'Filter B');

  const kpis = useMemo(() => {
    const firmStats: Record<string, { sum: number, count: number }> = {};
    reviews.forEach(r => {
      if (!firmStats[r.Location]) firmStats[r.Location] = { sum: 0, count: 0 };
      firmStats[r.Location].sum += r.Stars;
      firmStats[r.Location].count += 1;
    });

    const firms: string[] = (Array.from(new Set(reviews.map(r => r.Location))) as string[]).sort((a: string, b: string) => {
      const avgA = firmStats[a].sum / firmStats[a].count;
      const avgB = firmStats[b].sum / firmStats[b].count;
      return avgB - avgA;
    });
    
    const datasetAvg = Number((reviews.reduce((sum, r) => sum + r.Stars, 0) / reviews.length).toFixed(2));

    // Avg rating per firm
    const avgRatingData = firms.map(firm => {
      const avg = firmStats[firm].sum / firmStats[firm].count;
      return { name: firm, avgRating: Number(avg.toFixed(2)) };
    });

    // Volume per firm (Reversed so the highest rated firm is at the top of the vertical bar chart)
    const volumeData = [...firms].reverse().map(firm => {
      return { name: firm, volume: firmStats[firm].count };
    });

    // Avg rating over time
    const timeDataMap: Record<string, Record<string, { sum: number, count: number }>> = {};
    
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
        timeDataMap[timeKey] = { 
          'Overall Average': { sum: 0, count: 0 },
          [filterAName]: { sum: 0, count: 0 },
          [filterBName]: { sum: 0, count: 0 }
        };
      }
      if (!timeDataMap[timeKey][r.Location]) timeDataMap[timeKey][r.Location] = { sum: 0, count: 0 };
      
      timeDataMap[timeKey][r.Location].sum += r.Stars;
      timeDataMap[timeKey][r.Location].count += 1;
      
      timeDataMap[timeKey]['Overall Average'].sum += r.Stars;
      timeDataMap[timeKey]['Overall Average'].count += 1;

      if (filterA.includes('all') || filterA.includes(r.Location)) {
        timeDataMap[timeKey][filterAName].sum += r.Stars;
        timeDataMap[timeKey][filterAName].count += 1;
      }

      if (isComparisonActive && (filterB.includes('all') || filterB.includes(r.Location))) {
        timeDataMap[timeKey][filterBName].sum += r.Stars;
        timeDataMap[timeKey][filterBName].count += 1;
      }
    });

    const timeData = Object.keys(timeDataMap).sort().map((timeKey: string) => {
      const entry: any = { timeKey };
      firms.forEach((firm: string) => {
        const data = timeDataMap[timeKey][firm];
        entry[firm] = data ? Number((data.sum / data.count).toFixed(2)) : null;
      });
      const overallData = timeDataMap[timeKey]['Overall Average'];
      entry['Overall Average'] = overallData && overallData.count > 0 ? Number((overallData.sum / overallData.count).toFixed(2)) : null;

      const aData = timeDataMap[timeKey][filterAName];
      entry[filterAName] = aData && aData.count > 0 ? Number((aData.sum / aData.count).toFixed(2)) : null;

      if (isComparisonActive) {
        const bData = timeDataMap[timeKey][filterBName];
        entry[filterBName] = bData && bData.count > 0 ? Number((bData.sum / bData.count).toFixed(2)) : null;
      }

      return entry;
    });

    return { avgRatingData, volumeData, timeData, firms, datasetAvg };
  }, [reviews, timeAggregation, filterA, filterB, filterAName, filterBName, isComparisonActive]);

  const COLOR_PALETTE = ['#2590c4', '#bc195f', '#95147c', '#186a98', '#601b7b', '#074771'];
  const GREY_PALETTE = ['#000000', '#565d64', '#878c91', '#b7b9bc', '#e7e8e9'];
  const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'star'];

  const activePalette = colorMode === 'color' ? COLOR_PALETTE : GREY_PALETTE;

  const handleLegendClick = (e: any) => {
    const firm = e.dataKey;
    setHiddenFirms(prev => {
      const next = new Set(prev);
      if (next.has(firm)) next.delete(firm);
      else next.add(firm);
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
    const words = payload.value.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length < 15) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    return (
      <g transform={`translate(${x},${y})`}>
        {lines.map((line: string, index: number) => (
          <text
            key={index}
            x={0}
            y={index * 14}
            dy={16}
            textAnchor="middle"
            fill="#565d64"
            fontSize={11}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const getBarColor = (firmName: string) => {
    const inA = filterA.includes('all') || filterA.includes(firmName);
    const inB = isComparisonActive && (filterB.includes('all') || filterB.includes(firmName));
    
    if (inA && inB) return '#186a98'; // Both? Maybe just use Filter A color if both, or a mixed color. Let's use Filter A color.
    if (inA) return '#186a98'; // Dark Blue
    if (inB) return '#2590c4'; // Light Blue
    return '#b7b9bc'; // Grey
  };

  const CustomBarLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    const formattedValue = Number(value).toFixed(2).replace('.', ',');
    const firmName = kpis.avgRatingData[index]?.name;
    const color = getBarColor(firmName);
    return (
      <text
        x={x + width / 2}
        y={y - 10}
        fill={color}
        fontSize={12}
        fontWeight={600}
        textAnchor="middle"
      >
        {`${formattedValue} ★`}
      </text>
    );
  };

  const CustomYAxisTick = ({ x, y, payload }: any) => {
    let text = String(payload.value || '');
    if (text.length > 50) {
      text = text.substring(0, 50) + '...';
    }
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length < 22) {
        currentLine += ' ' + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    const startY = y - ((lines.length - 1) * 14) / 2;

    return (
      <g transform={`translate(${x},${startY})`}>
        {lines.map((line: string, index: number) => (
          <text
            key={index}
            x={-5}
            y={index * 14}
            dy={4}
            textAnchor="end"
            fill="#565d64"
            fontSize={11}
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const formattedDatasetAvg = kpis.datasetAvg.toFixed(2).replace('.', ',');

  const CustomRefLabel = (props: any) => {
    const { viewBox } = props;
    return (
      <text 
        x={viewBox.x + viewBox.width} 
        y={viewBox.y - 8} 
        textAnchor="end" 
        fill="#565d64" 
        fontSize={12} 
        fontWeight={500}
      >
        Dataset Avg. ({formattedDatasetAvg})
      </text>
    );
  };

  const renderCustomLegend = () => {
    if (isComparisonActive) {
      return (
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-4">
          <div 
            className="flex items-center gap-2 cursor-pointer text-sm select-none"
            onClick={() => handleLegendClick({ dataKey: filterAName })}
          >
            <div className="flex items-center justify-center w-4 h-4">
              {hiddenFirms.has(filterAName) ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
              <line x1="0" y1="8" x2="16" y2="8" stroke={activePalette[0]} strokeWidth="3" />
              <g transform="translate(8, 8)">
                <circle cx="0" cy="0" r="4" stroke={activePalette[0]} strokeWidth="2" fill="#fff" />
              </g>
            </svg>
            <span className={hiddenFirms.has(filterAName) ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>
              {filterAName}
            </span>
          </div>

          <div 
            className="flex items-center gap-2 cursor-pointer text-sm select-none"
            onClick={() => handleLegendClick({ dataKey: filterBName })}
          >
            <div className="flex items-center justify-center w-4 h-4">
              {hiddenFirms.has(filterBName) ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
              <line x1="0" y1="8" x2="16" y2="8" stroke={activePalette[1]} strokeWidth="3" strokeDasharray="4 4" />
              <g transform="translate(8, 8)">
                <rect x="-4" y="-4" width="8" height="8" stroke={activePalette[1]} strokeWidth="2" fill="#fff" />
              </g>
            </svg>
            <span className={hiddenFirms.has(filterBName) ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>
              {filterBName}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-4">
        {/* Overall Average Legend Item */}
        <div 
          className="flex items-center gap-2 cursor-pointer text-sm select-none"
          onClick={() => handleLegendClick({ dataKey: 'Overall Average' })}
        >
          <div className="flex items-center justify-center w-4 h-4">
            {hiddenFirms.has('Overall Average') ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
            <line x1="0" y1="8" x2="16" y2="8" stroke={colorMode === 'color' ? '#000000' : '#601b7b'} strokeWidth="3" />
          </svg>
          <span className={hiddenFirms.has('Overall Average') ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}>
            Overall Average
          </span>
        </div>

        {kpis.firms.map((firm, idx) => {
          const isHidden = hiddenFirms.has(firm);
          const isSelected = filterA.includes('all') || filterA.includes(firm);
          const color = activePalette[idx % activePalette.length];
          const isDashed = idx >= activePalette.length;
          const shapeType = SHAPES[idx % SHAPES.length];
          const isFilled = Math.floor(idx / activePalette.length) % 2 === 0;
          
          const strokeColor = isSelected ? color : '#b7b9bc';
          const fill = isFilled ? strokeColor : '#fff';

          return (
            <div 
              key={firm}
              className="flex items-center gap-2 cursor-pointer text-sm select-none"
              onClick={() => handleLegendClick({ dataKey: firm })}
            >
              <div className="flex items-center justify-center w-4 h-4">
                {isHidden ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
              </div>
              
              <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
                {isDashed ? (
                  <line x1="0" y1="8" x2="16" y2="8" stroke={strokeColor} strokeWidth="2" strokeDasharray="4 4" />
                ) : (
                  <line x1="0" y1="8" x2="16" y2="8" stroke={strokeColor} strokeWidth="2" />
                )}
                <g transform="translate(8, 8)">
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
              </svg>

              <span className={isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}>
                {firm}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average Rating per Firm */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100" id="chart-avg-rating-firm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Average Rating per Firm</h3>
            <button 
              onClick={() => downloadChartAsImage('chart-avg-rating-firm', 'average_rating_per_firm')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={kpis.avgRatingData} margin={{ top: 25, right: 20, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e8e9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={<CustomXAxisTick />} />
                <YAxis domain={[1, 5]} axisLine={false} tickLine={false} tick={{ fill: '#565d64', fontSize: 12 }} width={30} />
                <Tooltip 
                  cursor={{ fill: '#e7e8e9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <ReferenceLine y={kpis.datasetAvg} stroke="#878c91" strokeDasharray="3 3" label={<CustomRefLabel />} />
                <Bar dataKey="avgRating" radius={[4, 4, 0, 0]} barSize={40}>
                  {kpis.avgRatingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
                  ))}
                  <LabelList dataKey="avgRating" content={<CustomBarLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Review Volume per Firm */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100" id="chart-review-volume-firm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Review Volume per Firm</h3>
            <button 
              onClick={() => downloadChartAsImage('chart-review-volume-firm', 'review_volume_per_firm')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="h-80 overflow-y-auto overflow-x-hidden pr-2">
            <div style={{ height: Math.max(320, kpis.volumeData.length * 60) }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <BarChart data={kpis.volumeData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e7e8e9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#565d64', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={160} axisLine={false} tickLine={false} tick={<CustomYAxisTick />} />
                  <Tooltip 
                    cursor={{ fill: '#e7e8e9' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={24}>
                    {kpis.volumeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.name)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Average Rating Over Time */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100" id="chart-avg-rating-time">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800">Average Rating Over Time</h3>
            <button 
              onClick={() => downloadChartAsImage('chart-avg-rating-time', 'average_rating_over_time')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
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
                onClick={() => setColorMode('color')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${colorMode === 'color' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Color
              </button>
              <button
                onClick={() => setColorMode('grey')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${colorMode === 'grey' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Grey
              </button>
            </div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={kpis.timeData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e8e9" />
              <XAxis dataKey="timeKey" axisLine={false} tickLine={false} tick={{ fill: '#565d64', fontSize: 12 }} />
              <YAxis domain={[1, 5]} axisLine={false} tickLine={false} tick={{ fill: '#565d64', fontSize: 12 }} width={30} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                content={renderCustomLegend}
                wrapperStyle={{ paddingTop: '20px' }} 
              />
              
              {!isComparisonActive && !hiddenFirms.has('Overall Average') && (
                <Line
                  type="monotone"
                  dataKey="Overall Average"
                  stroke={colorMode === 'color' ? '#000000' : '#601b7b'}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              )}

              {isComparisonActive ? (
                <>
                  {!hiddenFirms.has(filterAName) && (
                    <Line
                      type="monotone"
                      dataKey={filterAName}
                      stroke={activePalette[0]}
                      strokeWidth={3}
                      dot={<CustomDot shapeType="circle" isFilled={true} />}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  )}
                  {!hiddenFirms.has(filterBName) && (
                    <Line
                      type="monotone"
                      dataKey={filterBName}
                      stroke={activePalette[1]}
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={<CustomDot shapeType="square" isFilled={true} />}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  )}
                </>
              ) : (
                kpis.firms.map((firm, idx) => {
                  if (hiddenFirms.has(firm)) return null;
                  
                  const isSelected = filterA.includes('all') || filterA.includes(firm);
                  const color = activePalette[idx % activePalette.length];
                  const isDashed = idx >= activePalette.length;
                  const shapeType = SHAPES[idx % SHAPES.length] as any;
                  const isFilled = Math.floor(idx / activePalette.length) % 2 === 0;

                  return (
                    <Line 
                      key={firm} 
                      type="monotone" 
                      dataKey={firm} 
                      stroke={isSelected ? color : '#b7b9bc'} 
                      strokeWidth={isSelected ? 2 : 1.5}
                      strokeDasharray={isDashed ? "5 5" : undefined}
                      dot={isSelected ? <CustomDot shapeType={shapeType} isFilled={isFilled} /> : false}
                      activeDot={isSelected ? { r: 6 } : false}
                      iconType={shapeType}
                      connectNulls
                    />
                  );
                })
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
