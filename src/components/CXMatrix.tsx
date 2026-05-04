import React, { useMemo, useState, useEffect } from 'react';
import { AnalyzedReview, ThemeSummary } from '../types';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell, LabelList, Label } from 'recharts';
import { Download } from 'lucide-react';
import { downloadChartAsImage } from '../utils/downloadImage';

interface CXMatrixProps {
  reviews: AnalyzedReview[];
  themes?: ThemeSummary[];
  filterA: string[];
  filterB: string[];
}

type MatrixType = 'firm' | 'topic' | 'location_by_topic';

export const CXMatrix: React.FC<CXMatrixProps> = ({ reviews, themes, filterA, filterB }) => {
  const [matrixType, setMatrixType] = useState<MatrixType>('firm');
  const [selectedTopic, setSelectedTopic] = useState<string>('');

  const hasSpecificSelection = (!filterA.includes('all') && filterA.length > 0) ||
                               (filterB.length > 0 && filterB[0] !== 'none' && !filterB.includes('all'));

  // Use the full theme list from props (preserving the global frequency order) and
  // append any extra themes that only show up in the reviews. This guarantees that
  // every defined theme appears in the topic dropdown / matrix even with 0 mentions.
  const allTopics = useMemo(() => {
    const topicCounts: Record<string, number> = {};
    reviews.forEach(r => {
      r.themes?.forEach(t => {
        topicCounts[t.theme] = (topicCounts[t.theme] || 0) + 1;
      });
    });
    const ordered: string[] = [];
    const seen = new Set<string>();
    if (themes) {
      themes.forEach(t => {
        if (!seen.has(t.theme)) {
          ordered.push(t.theme);
          seen.add(t.theme);
        }
      });
    }
    Object.keys(topicCounts)
      .sort((a, b) => topicCounts[b] - topicCounts[a])
      .forEach(t => {
        if (!seen.has(t)) {
          ordered.push(t);
          seen.add(t);
        }
      });
    return ordered;
  }, [reviews, themes]);

  useEffect(() => {
    if (allTopics.length > 0 && !selectedTopic) {
      setSelectedTopic(allTopics[0]);
    }
  }, [allTopics, selectedTopic]);

  const { data, xMid, yMid, minVolume, maxVolume, minY, maxY, yLabel, yFormatter, tooltipYFormatter, qLabels, qSizes } = useMemo(() => {
    let rawData: any[] = [];
    let yLabelText = '';
    let yFormatterFn = (val: any) => val;
    let tFormatterFn = (val: any) => val;
    let qLabelsObj = { tl: '', tr: '', bl: '', br: '' };

    if (matrixType === 'firm') {
      const firmStats: Record<string, { sum: number, count: number }> = {};
      reviews.forEach(r => {
        if (!firmStats[r.Location]) firmStats[r.Location] = { sum: 0, count: 0 };
        firmStats[r.Location].sum += r.Stars;
        firmStats[r.Location].count += 1;
      });

      const firms = Object.keys(firmStats);
      rawData = firms.map(firm => {
        const isSelectedA = filterA.includes('all') || filterA.includes(firm);
        const isSelectedB = filterB[0] !== 'none' && (filterB.includes('all') || filterB.includes(firm));
        return {
          name: firm,
          volume: firmStats[firm].count,
          yValue: Number((firmStats[firm].sum / firmStats[firm].count).toFixed(2)),
          isSelected: isSelectedA || isSelectedB
        };
      });

      yLabelText = 'Average Rating';
      yFormatterFn = (val: any) => Number(val).toFixed(2).replace(/\.?0+$/, '') || '0';
      tFormatterFn = (val: any) => `${val} / 5`;
      qLabelsObj = { tl: 'NICHE PERFORMERS', tr: 'MARKET LEADERS', bl: 'NEEDS ATTENTION', br: 'AT RISK' };

    } else if (matrixType === 'topic') {
      const topicStats: Record<string, { total: number, positive: number }> = {};
      reviews.forEach(r => {
        r.themes?.forEach(t => {
          if (!topicStats[t.theme]) topicStats[t.theme] = { total: 0, positive: 0 };
          topicStats[t.theme].total += 1;
          if (t.sentiment === 'positive') {
            topicStats[t.theme].positive += 1;
          }
        });
      });

      // Seed with the full theme list so themes with 0 mentions still render.
      allTopics.forEach(t => {
        if (!topicStats[t]) topicStats[t] = { total: 0, positive: 0 };
      });

      rawData = Object.keys(topicStats).map(theme => {
        const stats = topicStats[theme];
        return {
          name: theme,
          volume: stats.total,
          yValue: stats.total > 0 ? Number(((stats.positive / stats.total) * 100).toFixed(1)) : 0,
          isSelected: true // Topics don't fade based on location filters
        };
      });

      yLabelText = 'Positive Sentiment (%)';
      yFormatterFn = (val: any) => `${Math.round(val)}%`;
      tFormatterFn = (val: any) => `${val}% Positive`;
      qLabelsObj = { tl: 'NICHE STRENGTHS', tr: 'CORE STRENGTHS', bl: 'MONITOR', br: 'CRITICAL ISSUES' };

    } else if (matrixType === 'location_by_topic') {
      const locStats: Record<string, { total: number, positive: number }> = {};
      reviews.forEach(r => {
        const themeObj = r.themes?.find(t => t.theme === selectedTopic);
        if (themeObj) {
          const loc = r.Location;
          if (!locStats[loc]) locStats[loc] = { total: 0, positive: 0 };
          locStats[loc].total += 1;
          if (themeObj.sentiment === 'positive') {
            locStats[loc].positive += 1;
          }
        }
      });

      rawData = Object.keys(locStats).map(loc => {
        const isSelectedA = filterA.includes('all') || filterA.includes(loc);
        const isSelectedB = filterB[0] !== 'none' && (filterB.includes('all') || filterB.includes(loc));
        return {
          name: loc,
          volume: locStats[loc].total,
          yValue: Number(((locStats[loc].positive / locStats[loc].total) * 100).toFixed(1)),
          isSelected: isSelectedA || isSelectedB
        };
      });

      yLabelText = `Sentiment: ${selectedTopic} (%)`;
      yFormatterFn = (val: any) => `${Math.round(val)}%`;
      tFormatterFn = (val: any) => `${val}% Positive`;
      qLabelsObj = { tl: 'NICHE PERFORMERS', tr: 'MARKET LEADERS', bl: 'NEEDS ATTENTION', br: 'AT RISK' };
    }

    if (rawData.length === 0) {
      return { data: [], xMid: 0, yMid: 0, minVolume: 0, maxVolume: 0, minY: 0, maxY: 0, yLabel: yLabelText, yFormatter: yFormatterFn, tooltipYFormatter: tFormatterFn, qLabels: qLabelsObj, qSizes: { tl: 28, tr: 28, bl: 28, br: 28 } };
    }

    // Calculate medians or averages for the crosshairs
    const volumes = rawData.map(d => d.volume).sort((a, b) => a - b);
    const yValues = rawData.map(d => d.yValue).sort((a, b) => a - b);
    
    // Use median for crosshairs to evenly distribute points
    const xMid = volumes.length % 2 === 0 
      ? (volumes[volumes.length / 2 - 1] + volumes[volumes.length / 2]) / 2 
      : volumes[Math.floor(volumes.length / 2)];
      
    const yMid = yValues.length % 2 === 0 
      ? (yValues[yValues.length / 2 - 1] + yValues[yValues.length / 2]) / 2 
      : yValues[Math.floor(yValues.length / 2)];

    // Assign colors based on quadrants
    rawData.forEach(d => {
      if (d.volume >= xMid && d.yValue >= yMid) {
        d.color = '#186a98'; // Market Leaders: Dark Blue
      } else if (d.volume < xMid && d.yValue >= yMid) {
        d.color = '#0ea5e9'; // Niche Performers: Light Blue
      } else if (d.volume >= xMid && d.yValue < yMid) {
        d.color = '#bc195f'; // At Risk: Pinkish corporate color
      } else {
        d.color = '#9333ea'; // Needs Attention: Purple color
      }
    });

    // Add some padding to domains
    const volumeRange = (volumes[volumes.length - 1] - volumes[0]) || 1;
    const minVolume = Math.max(0, volumes[0] - volumeRange * 0.15);
    const maxVolume = volumes[volumes.length - 1] + volumeRange * 0.15;
    
    const yRange = (yValues[yValues.length - 1] - yValues[0]) || 1;
    let minY = Math.max(0, yValues[0] - yRange * 0.15);
    let maxY = yValues[yValues.length - 1] + yRange * 0.25; // 25% padding at the top for labels

    if (matrixType === 'firm') {
      minY = Math.max(1, minY);
      maxY = Math.min(5, maxY);
      // Snap to nearest 0.5 for clean ticks
      minY = Math.floor(minY * 2) / 2;
      maxY = Math.ceil(maxY * 2) / 2;
    } else {
      minY = Math.max(0, minY);
      maxY = Math.min(100, maxY);
      // Snap to nearest 10
      minY = Math.floor(minY / 10) * 10;
      maxY = Math.ceil(maxY / 10) * 10;
    }

    // Assign label positions to avoid overlap using a greedy placement algorithm
    const xRange = maxVolume - minVolume || 1;
    const yRange2 = maxY - minY || 1;
    
    // Approximate chart dimensions based on common container size
    const chartW = 800;
    const chartH = 400;
    
    const dotBoxes = rawData.map(d => {
      const px = ((d.volume - minVolume) / xRange) * chartW;
      const py = chartH - ((d.yValue - minY) / yRange2) * chartH;
      return { x: px - 4, y: py - 4, width: 8, height: 8, px, py, d };
    });

    const labelBoxes: any[] = [];
    // Sort dots by volume ascending, so we place labels from left to right.
    // This ensures dots on the left get their labels placed closer, creating a more natural reading flow.
    const sortedDots = [...dotBoxes].sort((a, b) => a.d.volume - b.d.volume);

    const angles = [
      -Math.PI / 2, // top
      0, // right
      Math.PI / 2, // bottom
      Math.PI, // left
      -Math.PI / 4, // top-right
      -3 * Math.PI / 4, // top-left
      Math.PI / 4, // bottom-right
      3 * Math.PI / 4 // bottom-left
    ];

    const getLabelRect = (px: number, py: number, width: number, height: number, angle: number, radius: number) => {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      const cx = px + radius * cosA;
      const cy = py + radius * sinA;
      
      let textAnchor = 'middle';
      let rectX = cx;
      let rectY = cy;
      let labelX = cx;
      let labelY = cy;

      if (Math.abs(cosA) < 0.1) {
        textAnchor = 'middle';
        rectX = cx - width / 2;
        if (sinA < 0) { // top
           rectY = cy - height;
           labelY = cy - height / 2;
        } else { // bottom
           rectY = cy;
           labelY = cy + height / 2;
        }
      } else if (cosA > 0) {
        textAnchor = 'start';
        rectX = cx;
        rectY = cy - height / 2;
        labelY = cy;
      } else {
        textAnchor = 'end';
        rectX = cx - width;
        rectY = cy - height / 2;
        labelY = cy;
      }

      return {
        x: rectX,
        y: rectY,
        width,
        height,
        cx,
        cy,
        textAnchor,
        labelX,
        labelY,
        radius
      };
    };

    const rectIntersect = (r1: any, r2: any, padX = 2, padY = 2) => {
      return !(r2.x > r1.x + r1.width + padX || 
               r2.x + r2.width + padX < r1.x || 
               r2.y > r1.y + r1.height + padY ||
               r2.y + r2.height + padY < r1.y);
    };

    const outOfBounds = (r: any) => {
      // Allow slightly outside the chart area, but within SVG margins
      return r.x < -15 || r.y < -50 || r.x + r.width > chartW + 35 || r.y + r.height > chartH + 15;
    };

    sortedDots.forEach(dot => {
      const words = dot.d.name.split(' ');
      const lines = [];
      let currentLine = words[0];
      for (let i = 1; i < words.length; i++) {
        if (currentLine.length + words[i].length > 15) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine += ' ' + words[i];
        }
      }
      lines.push(currentLine);
      
      const estWidth = Math.max(...lines.map(l => l.length)) * 6.5; // Slightly wider estimate to prevent horizontal overlap
      const estHeight = lines.length * 12 + 4; // Add a little vertical padding

      let bestRect = null;
      let placed = false;

      for (let radius = 12; radius <= 200; radius += 8) {
        for (const angle of angles) {
          const rect = getLabelRect(dot.px, dot.py, estWidth, estHeight, angle, radius);
          
          if (outOfBounds(rect)) continue;
          
          let overlap = false;
          for (const otherLabel of labelBoxes) {
            if (rectIntersect(rect, otherLabel, 4, 4)) { // Increased padding between labels
              overlap = true;
              break;
            }
          }
          if (overlap) continue;
          
          for (const otherDot of dotBoxes) {
            if (otherDot === dot) continue;
            if (rectIntersect(rect, otherDot, 4, 4)) {
              overlap = true;
              break;
            }
          }
          if (overlap) continue;
          
          bestRect = rect;
          placed = true;
          break;
        }
        if (placed) break;
      }

      if (!placed) {
        // Fallback to top if completely stuck
        bestRect = getLabelRect(dot.px, dot.py, estWidth, estHeight, -Math.PI / 2, 12);
      }

      bestRect.lines = lines;
      bestRect.d = dot.d;
      labelBoxes.push(bestRect);
      
      dot.d.labelXOffset = bestRect.labelX - dot.px;
      dot.d.labelYOffset = bestRect.labelY - dot.py;
      dot.d.textAnchor = bestRect.textAnchor;
      dot.d.lines = lines;
      dot.d.showLine = bestRect.radius > 16; // Show line if we had to push it away
    });

    const leftWidthRatio = (xMid - minVolume) / xRange;
    const rightWidthRatio = (maxVolume - xMid) / xRange;
    
    const getFontSize = (wRatio: number, text: string) => {
      if (!text) return 28;
      const maxFontSize = (wRatio * 800) / (text.length * 0.6);
      return Math.max(10, Math.min(28, maxFontSize));
    };

    const qSizesObj = {
      tl: getFontSize(leftWidthRatio, qLabelsObj.tl),
      tr: getFontSize(rightWidthRatio, qLabelsObj.tr),
      bl: getFontSize(leftWidthRatio, qLabelsObj.bl),
      br: getFontSize(rightWidthRatio, qLabelsObj.br),
    };

    return { data: rawData, xMid, yMid, minVolume, maxVolume, minY, maxY, yLabel: yLabelText, yFormatter: yFormatterFn, tooltipYFormatter: tFormatterFn, qLabels: qLabelsObj, qSizes: qSizesObj };
  }, [reviews, filterA, filterB, matrixType, selectedTopic]);

  if (data.length === 0) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-xl">
          <p className="font-bold text-slate-800 mb-1">{data.name}</p>
          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate-600">Volume: <span className="font-semibold text-slate-900">{data.volume} mentions</span></p>
            <p className="text-sm text-slate-600">{yLabel.split(':')[0]}: <span className="font-semibold text-slate-900">{tooltipYFormatter(data.yValue)}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = (props: any) => {
    const { x, y, cx, cy, width, height, value, index, payload } = props;
    if (!value) return null;
    
    const centerX = cx !== undefined ? cx : (width ? x + width / 2 : x + 4);
    const centerY = cy !== undefined ? cy : (height ? y + height / 2 : y + 4);
    
    const entry = payload || data[index] || {};
    const opacity = (matrixType !== 'topic' && hasSpecificSelection && !entry.isSelected) ? 0.2 : 1;
    
    // Split long names into multiple lines
    const words = value.split(' ');
    const lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length > 15) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine += ' ' + words[i];
      }
    }
    lines.push(currentLine);

    const xOffset = entry.labelXOffset || 0;
    const yOffset = entry.labelYOffset || -15;
    const textAnchor = entry.textAnchor || 'middle';
    const showLine = entry.showLine;

    const labelX = centerX + xOffset;
    const labelY = centerY + yOffset;

    // Calculate line target
    let lineTargetX = labelX;
    let lineTargetY = labelY;
    
    if (textAnchor === 'start') {
      lineTargetX -= 2;
    } else if (textAnchor === 'end') {
      lineTargetX += 2;
    } else {
      if (yOffset > 0) {
        lineTargetY = labelY - (lines.length * 12) / 2 - 2;
      } else {
        lineTargetY = labelY + (lines.length * 12) / 2 + 2;
      }
    }

    return (
      <g opacity={opacity}>
        {showLine && (
          <line 
            x1={centerX} 
            y1={centerY} 
            x2={lineTargetX} 
            y2={lineTargetY} 
            stroke="#94a3b8" 
            strokeWidth={1} 
            strokeDasharray="2 2"
          />
        )}
        <text 
          x={labelX} 
          y={labelY - (lines.length - 1) * 12 / 2} 
          textAnchor={textAnchor} 
          fill="#475569" 
          fontSize="11px" 
          fontWeight={600} 
        >
          {lines.map((line, i) => (
            <tspan key={i} x={labelX} dy={i === 0 ? '0.3em' : 12}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col" id="chart-cx-matrix">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-slate-800">CX Performance Matrix</h2>
            <button 
              onClick={() => downloadChartAsImage('chart-cx-matrix', 'cx_performance_matrix')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-500">Compare performance based on Review Volume and Sentiment/Rating.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={matrixType}
            onChange={(e) => setMatrixType(e.target.value as MatrixType)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="firm">Firm Performance</option>
            <option value="topic">Topic Performance</option>
            <option value="location_by_topic">Location Performance by Topic</option>
          </select>
          
          {matrixType === 'location_by_topic' && (
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
            >
              {allTopics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      <div className="h-[500px] w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 60, right: 40, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            
            {/* Quadrant Background Labels */}
            <ReferenceArea x1={minVolume} x2={xMid} y1={yMid} y2={maxY} fill="transparent">
              <Label value={qLabels.tl} position="center" fill="#64748b" fontSize={qSizes.tl} fontWeight={800} opacity={0.2} />
            </ReferenceArea>
            <ReferenceArea x1={xMid} x2={maxVolume} y1={yMid} y2={maxY} fill="transparent">
              <Label value={qLabels.tr} position="center" fill="#64748b" fontSize={qSizes.tr} fontWeight={800} opacity={0.2} />
            </ReferenceArea>
            <ReferenceArea x1={minVolume} x2={xMid} y1={minY} y2={yMid} fill="transparent">
              <Label value={qLabels.bl} position="center" fill="#64748b" fontSize={qSizes.bl} fontWeight={800} opacity={0.2} />
            </ReferenceArea>
            <ReferenceArea x1={xMid} x2={maxVolume} y1={minY} y2={yMid} fill="transparent">
              <Label value={qLabels.br} position="center" fill="#64748b" fontSize={qSizes.br} fontWeight={800} opacity={0.2} />
            </ReferenceArea>

            <XAxis 
              type="number" 
              dataKey="volume" 
              name="Volume" 
              domain={[minVolume, maxVolume]}
              tickFormatter={(val) => Math.round(val).toString()}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              label={{ value: 'Review Volume', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12, fontWeight: 500 }}
            />
            <YAxis 
              type="number" 
              dataKey="yValue" 
              name={yLabel}
              domain={[minY, maxY]}
              ticks={matrixType === 'firm' ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] : undefined}
              tickFormatter={yFormatter}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12, fontWeight: 500 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} wrapperStyle={{ zIndex: 100 }} />
            
            <ReferenceLine x={xMid} stroke="#cbd5e1" strokeWidth={2} />
            <ReferenceLine y={yMid} stroke="#cbd5e1" strokeWidth={2} />
            
            <Scatter name="Data" data={data}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color} 
                  opacity={(matrixType !== 'topic' && hasSpecificSelection && !entry.isSelected) ? 0.2 : 1}
                />
              ))}
              <LabelList 
                dataKey="name" 
                content={<CustomLabel />}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

