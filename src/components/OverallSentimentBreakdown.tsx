import React, { useMemo, useState, useEffect } from 'react';
import { AnalyzedReview } from '../types';
import { Download } from 'lucide-react';
import { downloadChartAsImage } from '../utils/downloadImage';

interface OverallSentimentBreakdownProps {
  allReviews: AnalyzedReview[];
  topTopics: string[];
  filterA: string[];
  filterB: string[];
}

const POSITIVE_PALETTE = [
    '#042d48', // indigo-900
    '#074771', // indigo-800
    '#105882', // indigo-700
    '#186a98', // indigo-600
    '#1e7dae', // indigo-500
    '#2590c4', // indigo-400
];

const NEGATIVE_PALETTE = [
    '#6f123b', // rose-900
    '#831043', // rose-800
    '#9e104e', // rose-700
    '#bc195f', // rose-600
    '#d6246e', // rose-500
    '#e54d8d', // rose-400
];

const SentimentChart: React.FC<{ 
    reviews: AnalyzedReview[], 
    topTopics: string[], 
    activeTopics: Set<string>, 
    toggleTopic: (t: string) => void,
}> = ({ reviews, topTopics, activeTopics, toggleTopic }) => {

    // 1. Calculate Stats for ALL Top Topics (for the Legend)
    const allTopicStats = useMemo(() => {
        if (!reviews || reviews.length === 0 || !topTopics || topTopics.length === 0) return null;

        const totalReviews = reviews.length;
        const posStats: { topic: string, count: number, percentage: number }[] = [];
        const negStats: { topic: string, count: number, percentage: number }[] = [];

        topTopics.forEach(topic => {
            const posCount = reviews.filter(r => 
                r.themes?.some(t => t.theme === topic && t.sentiment === 'positive')
            ).length;

            const negCount = reviews.filter(r => 
                r.themes?.some(t => t.theme === topic && t.sentiment === 'negative')
            ).length;

            if (posCount > 0) {
                posStats.push({ topic, count: posCount, percentage: (posCount / totalReviews) * 100 });
            }
            if (negCount > 0) {
                negStats.push({ topic, count: negCount, percentage: (negCount / totalReviews) * 100 });
            }
        });

        // Sort by percentage descending (fixed order for legend)
        posStats.sort((a, b) => b.percentage - a.percentage);
        negStats.sort((a, b) => b.percentage - a.percentage);

        return { posStats, negStats, totalReviews };
    }, [reviews, topTopics]);

    // 2. Calculate Chart Data based on ACTIVE Topics
    const chartData = useMemo(() => {
        if (!allTopicStats) return null;

        const { posStats, negStats, totalReviews } = allTopicStats;

        // Filter segments based on activeTopics
        const activePosSegments = posStats.filter(s => activeTopics.has(s.topic));
        const activeNegSegments = negStats.filter(s => activeTopics.has(s.topic));

        // Recalculate Uncovered based on ACTIVE topics
        const uncoveredCount = reviews.filter(r => {
            if (!r.themes || r.themes.length === 0) return true;
            // Check if review has ANY of the ACTIVE top topics
            const hasActiveTopic = r.themes.some(t => activeTopics.has(t.theme));
            return !hasActiveTopic;
        }).length;

        const uncoveredPercentage = (uncoveredCount / totalReviews) * 100;

        return { 
            activePosSegments, 
            activeNegSegments, 
            uncoveredPercentage 
        };
    }, [allTopicStats, activeTopics, reviews]);

    if (!allTopicStats || !chartData) return <div className="h-40 flex items-center justify-center text-slate-400">No data available</div>;

    const { posStats, negStats, totalReviews } = allTopicStats;
    const { activePosSegments, activeNegSegments, uncoveredPercentage } = chartData;

    const totalPositiveShare = activePosSegments.reduce((acc, seg) => acc + seg.percentage, 0);
    const totalNegativeShare = activeNegSegments.reduce((acc, seg) => acc + seg.percentage, 0);
    
    const totalSelectedShare = totalPositiveShare + totalNegativeShare;
    
    // Normalize widths to fill 100% of the bar
    const normalizedPosWidth = totalSelectedShare > 0 ? (totalPositiveShare / totalSelectedShare) * 100 : 0;
    const normalizedNegWidth = totalSelectedShare > 0 ? (totalNegativeShare / totalSelectedShare) * 100 : 0;

    return (
        <div className="flex-1 min-w-[300px]">
            <div className="mb-4">
                 {/* Uncovered Reviews Circle Chart */}
                 <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 w-fit">
                    <div className="relative w-9 h-9 flex items-center justify-center">
                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                            <path
                                className="text-slate-200"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="text-slate-400"
                                strokeDasharray={`${uncoveredPercentage}, 100`}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                        </svg>
                        <span className="absolute text-[9px] font-bold text-slate-600">
                            {Math.round(uncoveredPercentage)}%
                        </span>
                    </div>
                    <div className="text-xs text-slate-600 whitespace-nowrap leading-tight">
                        <strong>{Math.round(uncoveredPercentage)}% of reviews</strong> do not contain any of the Top {activeTopics.size} Themes.
                    </div>
                </div>
            </div>

            {/* The Bar Container */}
            <div className="relative w-full h-16 bg-white rounded-lg flex border border-slate-100">
                {/* Positive Section (Left) */}
                <div className="h-full flex justify-start transition-all duration-500 ease-in-out" style={{ width: `${normalizedPosWidth}%` }}>
                    {activePosSegments.map((seg, idx) => (
                        <div 
                            key={seg.topic}
                            className={`h-full flex flex-col justify-center items-center relative group transition-all hover:brightness-110 border-r border-white/10 cursor-help 
                                ${idx === 0 ? 'rounded-l-lg' : ''} 
                                ${(idx === activePosSegments.length - 1 && activeNegSegments.length === 0) ? 'rounded-r-lg' : ''}
                            `}
                            style={{ 
                                width: `${(seg.percentage / totalPositiveShare) * 100}%`, 
                                backgroundColor: POSITIVE_PALETTE[idx % POSITIVE_PALETTE.length],
                            }}
                        >
                            {/* Only show label if segment is wide enough (e.g. > 5% of the BAR width) */}
                            {((seg.percentage / totalSelectedShare) * 100) > 5 && (
                                <span className="text-[10px] font-bold text-white/90 truncate px-1 max-w-full pointer-events-none">
                                    {seg.percentage.toFixed(1)}%
                                </span>
                            )}
                            
                            {/* Custom Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap transition-opacity">
                                <div className="font-bold">{seg.topic}</div>
                                <div>{seg.count}/{totalReviews} ({seg.percentage.toFixed(1)}%)</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Negative Section (Right) */}
                <div className="h-full flex justify-end transition-all duration-500 ease-in-out" style={{ width: `${normalizedNegWidth}%` }}>
                    {activeNegSegments.map((seg, idx) => (
                        <div 
                            key={seg.topic}
                            className={`h-full flex flex-col justify-center items-center relative group transition-all hover:brightness-110 border-l border-white/10 cursor-help 
                                ${idx === activeNegSegments.length - 1 ? 'rounded-r-lg' : ''}
                                ${(idx === 0 && activePosSegments.length === 0) ? 'rounded-l-lg' : ''}
                            `}
                            style={{ 
                                width: `${(seg.percentage / totalNegativeShare) * 100}%`, 
                                backgroundColor: NEGATIVE_PALETTE[idx % NEGATIVE_PALETTE.length],
                            }}
                        >
                            {/* Only show label if segment is wide enough */}
                            {((seg.percentage / totalSelectedShare) * 100) > 5 && (
                                <span className="text-[10px] font-bold text-white/90 truncate px-1 max-w-full pointer-events-none">
                                    {seg.percentage.toFixed(1)}%
                                </span>
                            )}

                            {/* Custom Tooltip */}
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap transition-opacity">
                                <div className="font-bold">{seg.topic}</div>
                                <div>{seg.count}/{totalReviews} ({seg.percentage.toFixed(1)}%)</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend / List below */}
            <div className="mt-4 grid grid-cols-2 gap-4">
                {/* Positive Legend */}
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-left">Top Positive Themes</h4>
                    <div className="flex flex-wrap gap-2">
                        {posStats.map((seg) => {
                            const isActive = activeTopics.has(seg.topic);
                            const activeIdx = activePosSegments.findIndex(s => s.topic === seg.topic);
                            return (
                                <div 
                                    key={seg.topic} 
                                    onClick={() => toggleTopic(seg.topic)}
                                    className={`legend-item flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all cursor-pointer select-none
                                        ${isActive 
                                            ? 'bg-slate-50 border-slate-200 text-slate-700 shadow-sm' 
                                            : 'bg-white border-slate-100 text-slate-400 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <span 
                                        className={`w-2.5 h-2.5 rounded-full transition-colors ${!isActive ? 'bg-slate-300' : ''}`} 
                                        style={isActive ? { backgroundColor: POSITIVE_PALETTE[activeIdx % POSITIVE_PALETTE.length] } : {}}
                                    ></span>
                                    <span className="font-medium">{seg.topic}</span>
                                    <span className="text-slate-400">({seg.percentage.toFixed(1)}%)</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Negative Legend */}
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 text-right">Top Negative Themes</h4>
                    <div className="flex flex-wrap gap-2 justify-end">
                        {negStats.map((seg) => {
                            const isActive = activeTopics.has(seg.topic);
                            const activeIdx = activeNegSegments.findIndex(s => s.topic === seg.topic);
                            return (
                                <div 
                                    key={seg.topic} 
                                    onClick={() => toggleTopic(seg.topic)}
                                    className={`legend-item flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-all cursor-pointer select-none
                                        ${isActive 
                                            ? 'bg-slate-50 border-slate-200 text-slate-700 shadow-sm' 
                                            : 'bg-white border-slate-100 text-slate-400 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <span 
                                        className={`w-2.5 h-2.5 rounded-full transition-colors ${!isActive ? 'bg-slate-300' : ''}`} 
                                        style={isActive ? { backgroundColor: NEGATIVE_PALETTE[activeIdx % NEGATIVE_PALETTE.length] } : {}}
                                    ></span>
                                    <span className="font-medium">{seg.topic}</span>
                                    <span className="text-slate-400">({seg.percentage.toFixed(1)}%)</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const OverallSentimentBreakdown: React.FC<OverallSentimentBreakdownProps> = ({ 
    allReviews, 
    topTopics, 
    filterA,
    filterB
}) => {
    
    // State to track which topics are active (visible)
    const [activeTopics, setActiveTopics] = useState<Set<string>>(new Set());

    // Initialize active topics (Default: Top 6)
    useEffect(() => {
        if (topTopics && topTopics.length > 0) {
            // Take the first 6 topics as default active
            const defaults = topTopics.slice(0, 6);
            setActiveTopics(new Set(defaults));
        }
    }, [topTopics]); // Re-run if topTopics changes (e.g. new filter)

    const toggleTopic = (topic: string) => {
        setActiveTopics(prev => {
            const next = new Set(prev);
            if (next.has(topic)) {
                next.delete(topic);
            } else {
                next.add(topic);
            }
            return next;
        });
    };

    const isComparisonActive = !filterB.includes('none');

    const reviewsA = allReviews.filter(r => filterA.includes('all') || filterA.includes(r.Location));
    const reviewsB = isComparisonActive ? allReviews.filter(r => filterB.includes('all') || filterB.includes(r.Location)) : [];

    const getFilterLabel = (filter: string[], name: string) => {
      if (filter.includes('all')) return `${name}: All Firms`;
      if (filter.length === 1) return `${name}: ${filter[0]}`;
      return `${name}: ${filter.length} Firms`;
    };

    return (
        <div id="card-sentiment-breakdown" className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-slate-800">Overall Theme Breakdown</h2>
                        <button 
                            onClick={() => downloadChartAsImage('card-sentiment-breakdown', 'overall_theme_breakdown')}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Download Chart"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-slate-500 mb-4">
                        Sentiment distribution for top {activeTopics.size} topics (% of total reviews).
                    </p>
                </div>
            </div>

            <div className={`flex flex-col ${isComparisonActive ? 'xl:flex-col gap-12' : 'xl:flex-row gap-8'}`}>
                {/* Primary Chart */}
                <div className="flex-1">
                    {isComparisonActive && <h3 className="text-lg font-semibold text-slate-800 mb-4">{getFilterLabel(filterA, 'Filter A')}</h3>}
                    <SentimentChart 
                        reviews={reviewsA} 
                        topTopics={topTopics} 
                        activeTopics={activeTopics} 
                        toggleTopic={toggleTopic}
                    />
                </div>
                
                {/* Comparison Chart */}
                {isComparisonActive && (
                    <div className="flex-1 pt-8 border-t border-slate-100 xl:pt-0 xl:border-t-0">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">{getFilterLabel(filterB, 'Filter B')}</h3>
                        <SentimentChart 
                            reviews={reviewsB} 
                            topTopics={topTopics} 
                            activeTopics={activeTopics} 
                            toggleTopic={toggleTopic}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
