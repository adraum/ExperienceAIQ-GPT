import React, { useMemo, useState } from 'react';
import { AnalyzedReview, ThemeSummary } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { MessageSquare, TrendingUp, Download } from 'lucide-react';
import { downloadChartAsImage } from '../utils/downloadImage';
import { OverallSentimentBreakdown } from './OverallSentimentBreakdown';
import { TopicTrendsChart } from './TopicTrendsChart';
import { CXMatrix } from './CXMatrix';

interface TopicAnalysisProps {
  allReviews: AnalyzedReview[];
  filteredReviews: AnalyzedReview[];
  themes: ThemeSummary[];
  filterA: string[];
  filterB: string[];
}

export const TopicAnalysis: React.FC<TopicAnalysisProps> = ({ allReviews, filteredReviews, themes, filterA, filterB }) => {
  const { themeStats, themeStatsA, themeStatsB, overallSentiment, overallSentimentA, overallSentimentB, heatmapData, datasetAverages, firms, totalPos, totalNeg, totalNeu, totalPosA, totalNegA, totalNeuA, totalPosB, totalNegB, totalNeuB, reviewsA, reviewsB, isComparisonActive } = useMemo(() => {
    const themeStats: Record<string, { total: number, pos: number, neg: number, neu: number, quotes: string[] }> = {};
    const themeStatsA: Record<string, { total: number, pos: number, neg: number, neu: number, quotes: string[] }> = {};
    const themeStatsB: Record<string, { total: number, pos: number, neg: number, neu: number, quotes: string[] }> = {};
    let totalPos = 0, totalNeg = 0, totalNeu = 0;
    let totalPosA = 0, totalNegA = 0, totalNeuA = 0;
    let totalPosB = 0, totalNegB = 0, totalNeuB = 0;
    
    const isComparisonActive = !filterB.includes('none');
    const reviewsA = filteredReviews.filter(r => filterA.includes('all') || filterA.includes(r.Location));
    const reviewsB = isComparisonActive ? filteredReviews.filter(r => filterB.includes('all') || filterB.includes(r.Location)) : [];

    themes.forEach(t => {
      themeStats[t.theme] = { total: 0, pos: 0, neg: 0, neu: 0, quotes: [] };
      themeStatsA[t.theme] = { total: 0, pos: 0, neg: 0, neu: 0, quotes: [] };
      themeStatsB[t.theme] = { total: 0, pos: 0, neg: 0, neu: 0, quotes: [] };
    });

    filteredReviews.forEach(r => {
      const inA = filterA.includes('all') || filterA.includes(r.Location);
      const inB = filterB.includes('all') || filterB.includes(r.Location);

      r.themes.forEach(t => {
        if (themeStats[t.theme]) {
          themeStats[t.theme].total++;
          if (t.sentiment === 'positive') { themeStats[t.theme].pos++; totalPos++; }
          if (t.sentiment === 'negative') { themeStats[t.theme].neg++; totalNeg++; }
          if (t.sentiment === 'neutral') { themeStats[t.theme].neu++; totalNeu++; }
          
          if (themeStats[t.theme].quotes.length < 3 && t.snippet && t.snippet.length > 5) {
            themeStats[t.theme].quotes.push(t.snippet);
          }

          if (inA) {
            themeStatsA[t.theme].total++;
            if (t.sentiment === 'positive') { themeStatsA[t.theme].pos++; totalPosA++; }
            if (t.sentiment === 'negative') { themeStatsA[t.theme].neg++; totalNegA++; }
            if (t.sentiment === 'neutral') { themeStatsA[t.theme].neu++; totalNeuA++; }
            if (themeStatsA[t.theme].quotes.length < 3 && t.snippet && t.snippet.length > 5) {
              themeStatsA[t.theme].quotes.push(t.snippet);
            }
          }

          if (inB) {
            themeStatsB[t.theme].total++;
            if (t.sentiment === 'positive') { themeStatsB[t.theme].pos++; totalPosB++; }
            if (t.sentiment === 'negative') { themeStatsB[t.theme].neg++; totalNegB++; }
            if (t.sentiment === 'neutral') { themeStatsB[t.theme].neu++; totalNeuB++; }
            if (themeStatsB[t.theme].quotes.length < 3 && t.snippet && t.snippet.length > 5) {
              themeStatsB[t.theme].quotes.push(t.snippet);
            }
          }
        }
      });
    });

    const overallSentiment = [
      { name: 'Positive', value: totalPos, color: '#186a98' },
      { name: 'Neutral', value: totalNeu, color: '#878c91' },
      { name: 'Negative', value: totalNeg, color: '#bc195f' },
    ];

    const overallSentimentA = [
      { name: 'Positive', value: totalPosA, color: '#186a98' },
      { name: 'Neutral', value: totalNeuA, color: '#878c91' },
      { name: 'Negative', value: totalNegA, color: '#bc195f' },
    ];

    const overallSentimentB = [
      { name: 'Positive', value: totalPosB, color: '#2590c4' },
      { name: 'Neutral', value: totalNeuB, color: '#878c91' },
      { name: 'Negative', value: totalNegB, color: '#bc195f' },
    ];

    const firmStats: Record<string, { sum: number, count: number }> = {};
    allReviews.forEach(r => {
      if (!firmStats[r.Location]) firmStats[r.Location] = { sum: 0, count: 0 };
      firmStats[r.Location].sum += r.Stars;
      firmStats[r.Location].count += 1;
    });

    const firms: string[] = (Array.from(new Set(allReviews.map(r => r.Location))) as string[]).sort((a: string, b: string) => {
      const avgA = firmStats[a].sum / firmStats[a].count;
      const avgB = firmStats[b].sum / firmStats[b].count;
      return avgB - avgA;
    });

    const heatmapData: Record<string, Record<string, { percent: number, count: number, total: number }>> = {};
    const datasetAverages: Record<string, { percent: number, count: number, total: number }> = {};
    
    themes.forEach(theme => {
      const reviewsWithTheme = allReviews.filter(r => r.themes.some(t => t.theme === theme.theme));
      const negCount = reviewsWithTheme.filter(r => r.themes.some(t => t.theme === theme.theme && t.sentiment === 'negative')).length;
      datasetAverages[theme.theme] = {
        percent: reviewsWithTheme.length > 0 ? Math.round((negCount / reviewsWithTheme.length) * 100) : -1,
        count: negCount,
        total: reviewsWithTheme.length
      };
    });
    
    firms.forEach((firm: string) => {
      heatmapData[firm] = {};
      themes.forEach(theme => {
        const firmReviewsWithTheme = allReviews.filter(r => r.Location === firm && r.themes.some(t => t.theme === theme.theme));
        const negCount = firmReviewsWithTheme.filter(r => r.themes.some(t => t.theme === theme.theme && t.sentiment === 'negative')).length;
        
        heatmapData[firm][theme.theme] = {
          percent: firmReviewsWithTheme.length > 0 ? Math.round((negCount / firmReviewsWithTheme.length) * 100) : -1,
          count: negCount,
          total: firmReviewsWithTheme.length
        };
      });
    });

    return { themeStats, themeStatsA, themeStatsB, overallSentiment, overallSentimentA, overallSentimentB, heatmapData, datasetAverages, firms, totalPos, totalNeg, totalNeu, totalPosA, totalNegA, totalNeuA, totalPosB, totalNegB, totalNeuB, reviewsA, reviewsB, isComparisonActive };
  }, [allReviews, filteredReviews, themes, filterA, filterB]);

  const [heatmapMode, setHeatmapMode] = useState<'percent' | 'count'>('percent');

  const getHeatmapClasses = (percentage: number) => {
    if (percentage < 0) return 'bg-slate-50 text-slate-300';
    if (percentage <= 15) return 'bg-green-100 text-green-900'; 
    if (percentage <= 30) return 'bg-green-50 text-green-800';
    if (percentage <= 50) return 'bg-yellow-50 text-yellow-800'; 
    if (percentage <= 70) return 'bg-orange-100 text-orange-800'; 
    return 'bg-red-100 text-red-900';
  };

  const renderPieChart = (data: any[], total: number) => (
    <div className="w-64 h-64">
      {total > 0 ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <PieChart>
            <Pie
              data={data.filter((s: any) => s.value > 0)}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.filter((s: any) => s.value > 0).map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No sentiment data available</div>
      )}
    </div>
  );

  return (
    <div className="space-y-12">
      {/* Overall Sentiment */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-start gap-8" id="chart-overall-sentiment">
        <div className="flex w-full items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">Overall Sentiment</h2>
            <button 
              onClick={() => downloadChartAsImage('chart-overall-sentiment', 'overall_sentiment')}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download Chart"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-slate-500 mb-6">Distribution of sentiment across all identified themes in the dataset.</p>
        
        {isComparisonActive ? (
          <div className="flex flex-col md:flex-row w-full gap-8 justify-around">
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">{filterA.includes('all') ? 'All Firms' : (filterA.length === 1 ? filterA[0] : `Filter A (${filterA.length} Firms)`)}</h3>
              <div className="flex gap-4 mb-4">
                {overallSentimentA.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                    <span className="text-sm font-medium text-slate-700">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
              {renderPieChart(overallSentimentA, totalPosA + totalNeuA + totalNegA)}
            </div>
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">{filterB.includes('all') ? 'All Firms' : (filterB.length === 1 ? filterB[0] : `Filter B (${filterB.length} Firms)`)}</h3>
              <div className="flex gap-4 mb-4">
                {overallSentimentB.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                    <span className="text-sm font-medium text-slate-700">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
              {renderPieChart(overallSentimentB, totalPosB + totalNeuB + totalNegB)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8 w-full">
            <div className="flex-1">
              <div className="flex gap-4">
                {overallSentiment.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></div>
                    <span className="text-sm font-medium text-slate-700">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </div>
            {renderPieChart(overallSentiment, totalPos + totalNeu + totalNeg)}
          </div>
        )}
      </div>

      {/* Overall Theme Breakdown */}
      <OverallSentimentBreakdown 
        allReviews={allReviews} 
        topTopics={themes.map(t => t.theme)} 
        filterA={filterA}
        filterB={filterB}
      />

      {/* Topic Trends Over Time */}
      <TopicTrendsChart 
        allReviews={allReviews}
        reviews={filteredReviews} 
        themes={themes} 
        filterA={filterA}
        filterB={filterB}
      />

      {/* Trending Topics */}
      <div id="chart-trending-topics">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-800">Trending Topics</h2>
          <button 
            onClick={() => downloadChartAsImage('chart-trending-topics', 'trending_topics')}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-auto"
            title="Download Chart"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        
        <div className={`grid grid-cols-1 ${isComparisonActive ? '' : 'lg:grid-cols-2'} gap-6`}>
          {themes.map(theme => {
            const renderThemeCard = (stats: any, filter: string[], label: string, totalReviews: number, bgColor: string = 'bg-white', borderColor: string = 'border-slate-100') => {
              const hasReviews = stats && stats.total > 0;
              
              const sentimentData = hasReviews ? [
                { name: 'Pos', value: stats.pos, fill: '#186a98' },
                { name: 'Neu', value: stats.neu, fill: '#878c91' },
                { name: 'Neg', value: stats.neg, fill: '#bc195f' },
              ] : [];

              const relativeShare = hasReviews && totalReviews > 0 ? Math.round((stats.total / totalReviews) * 100) : 0;
              
              let summaryContent: React.ReactNode = <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{theme.summary}</p>;
              
              if (!hasReviews) {
                summaryContent = <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">No reviews available for this topic.</p>;
              } else if (theme.firmSummaries) {
                const selectedFirms = filter.filter(f => f !== 'all' && f !== 'none');
                if (selectedFirms.length > 0) {
                  const summaries = selectedFirms.map(firm => {
                    const firmKey = Object.keys(theme.firmSummaries!).find(k => k.toLowerCase().trim() === firm.toLowerCase().trim());
                    return firmKey && theme.firmSummaries![firmKey] ? { firm, text: theme.firmSummaries![firmKey] } : null;
                  }).filter(Boolean);
                  
                  if (summaries.length > 0) {
                    summaryContent = (
                      <div className="space-y-3">
                        {summaries.map((s, i) => (
                          <p key={i} className="text-sm text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-800">{s!.firm}:</span> {s!.text}
                          </p>
                        ))}
                      </div>
                    );
                  }
                }
              }

              return (
                <div key={`${theme.theme}-${label}`} className={`${bgColor} rounded-2xl shadow-sm border ${borderColor} overflow-hidden flex flex-col`}>
                  <div className="p-6 border-b border-slate-50 flex justify-between items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">{theme.theme}</h3>
                        {isComparisonActive && (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${label.includes('Filter A') ? 'bg-blue-100 text-blue-800' : 'bg-cyan-100 text-cyan-800'}`}>
                            {label}
                          </span>
                        )}
                      </div>
                      {summaryContent}
                    </div>
                    <div className="text-right shrink-0 bg-slate-50 p-3 rounded-xl">
                      <div className="text-2xl font-black text-indigo-600">{relativeShare}%</div>
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-1">{hasReviews ? stats.total : 0} mentions</div>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
                    <div className="md:col-span-1 h-40">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Sentiment</h4>
                      {hasReviews ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                          <BarChart data={sentimentData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-100">
                          No Data
                        </div>
                      )}
                    </div>
                    
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Voice of Customer
                      </h4>
                      {hasReviews && stats.quotes.length > 0 ? (
                        stats.quotes.map((quote: string, idx: number) => (
                          <div key={idx} className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 italic border-l-2 border-indigo-200">
                            "{quote}"
                          </div>
                        ))
                      ) : (
                        <div className="bg-slate-50 rounded-lg p-6 text-sm text-slate-400 italic flex items-center justify-center h-full border border-slate-100">
                          No reviews available for this topic.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            };

            if (isComparisonActive) {
              const filterALabel = filterA.includes('all') ? 'All Firms' : (filterA.length === 1 ? filterA[0] : `Filter A (${filterA.length} Firms)`);
              const filterBLabel = filterB.includes('all') ? 'All Firms' : (filterB.length === 1 ? filterB[0] : `Filter B (${filterB.length} Firms)`);
              
              return (
                <React.Fragment key={theme.theme}>
                  {renderThemeCard(themeStatsA[theme.theme], filterA, filterALabel, reviewsA.length, 'bg-blue-50/30', 'border-blue-100')}
                  {renderThemeCard(themeStatsB[theme.theme], filterB, filterBLabel, reviewsB.length, 'bg-cyan-50/30', 'border-cyan-100')}
                </React.Fragment>
              );
            }

            return renderThemeCard(themeStats[theme.theme], filterA, 'Overall', filteredReviews.length);
          })}
        </div>
      </div>

      {/* Benchmarking Heatmap */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col" id="chart-cx-heatmap">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-800">CX Benchmarking Heatmap</h2>
              <button 
                onClick={() => downloadChartAsImage('chart-cx-heatmap', 'cx_benchmarking_heatmap')}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Download Chart"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-500">Percentage of negative reviews per theme for each firm.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setHeatmapMode('percent')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${heatmapMode === 'percent' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                % Percent
              </button>
              <button
                onClick={() => setHeatmapMode('count')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${heatmapMode === 'count' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                # Count
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="mr-2 hidden lg:inline">Negative Share:</span>
              <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-green-100"></div> 0-15%</div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-green-50"></div> 16-30%</div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-yellow-50"></div> 31-50%</div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-orange-100"></div> 51-70%</div>
              <div className="flex items-center gap-1"><div className="w-4 h-4 rounded bg-red-100"></div> 71-100%</div>
              <div className="flex items-center gap-1 ml-2"><div className="w-4 h-4 rounded bg-slate-50 border border-slate-200"></div> N/A</div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto pb-4">
          <div className="w-max min-w-full">
            <div className="flex">
              <div className="w-48 shrink-0"></div>
              {themes.map(t => (
                <div key={t.theme} className="w-40 shrink-0 px-2 pb-4 text-xs font-semibold text-slate-600 text-center flex items-end justify-center break-words hyphens-auto leading-tight min-h-[60px]">
                  {t.theme}
                </div>
              ))}
            </div>
            
            {/* Dataset Average Row */}
            <div className="flex border-t-2 border-b-2 border-slate-200 bg-slate-50/50 mb-2 items-center">
              <div className="w-48 shrink-0 py-3 pr-4 text-sm font-bold text-slate-800 flex items-center">
                Dataset Average
              </div>
              {themes.map(theme => {
                const data = datasetAverages[theme.theme];
                const val = data.percent;
                const displayValue = heatmapMode === 'percent' 
                  ? (val >= 0 ? `${val}%` : '-') 
                  : (val >= 0 ? `${data.count}/${data.total}` : '-');
                const tooltipValue = heatmapMode === 'percent'
                  ? (val >= 0 ? `${data.count}/${data.total} negative reviews` : 'No data')
                  : (val >= 0 ? `${val}% negative reviews` : 'No data');

                return (
                  <div key={theme.theme} className="w-40 shrink-0 p-1 flex items-center justify-center relative group">
                    <div 
                      className={`w-full h-12 rounded-md flex items-center justify-center text-sm font-bold transition-colors hover:ring-2 hover:ring-indigo-400 shadow-sm ${getHeatmapClasses(val)}`}
                    >
                      {displayValue}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-slate-800 text-white text-xs rounded py-1.5 px-2.5 whitespace-nowrap shadow-lg pointer-events-none">
                      {tooltipValue}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {firms.map(firm => {
              const isSelected = filterA.includes(firm) || filterB.includes(firm);
              return (
              <div key={firm} className={`flex border-t border-slate-100 transition-colors items-center ${isSelected ? 'bg-indigo-50/50 ring-1 ring-indigo-200 shadow-sm z-10 relative' : 'hover:bg-slate-50/50'}`}>
                <div className={`w-48 shrink-0 py-3 pr-4 text-sm flex items-center text-left ${isSelected ? 'font-bold text-indigo-700' : 'font-medium text-slate-700'}`}>
                  {firm}
                </div>
                {themes.map(theme => {
                  const data = heatmapData[firm][theme.theme];
                  const val = data.percent;
                  const displayValue = heatmapMode === 'percent' 
                    ? (val >= 0 ? `${val}%` : '-') 
                    : (val >= 0 ? `${data.count}/${data.total}` : '-');
                  const tooltipValue = heatmapMode === 'percent'
                    ? (val >= 0 ? `${data.count}/${data.total} negative reviews` : 'No data')
                    : (val >= 0 ? `${val}% negative reviews` : 'No data');

                  return (
                    <div key={theme.theme} className="w-40 shrink-0 p-1 flex items-center justify-center relative group">
                      <div 
                        className={`w-full h-12 rounded-md flex items-center justify-center text-sm font-medium transition-colors hover:ring-2 hover:ring-indigo-400 ${getHeatmapClasses(val)} ${isSelected ? 'ring-1 ring-indigo-300 shadow-sm' : ''}`}
                      >
                        {displayValue}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 bg-slate-800 text-white text-xs rounded py-1.5 px-2.5 whitespace-nowrap shadow-lg pointer-events-none">
                        {tooltipValue}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CX Performance Matrix */}
      <CXMatrix reviews={filteredReviews} filterA={filterA} filterB={filterB} />
    </div>
  );
};
