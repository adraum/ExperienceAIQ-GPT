import React, { useState, useMemo } from 'react';
import { AnalyzedReview } from '../types';
import { Search, Filter, Star, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReviewExplorerProps {
  reviews: AnalyzedReview[];
}

type SortColumn = 'Date' | 'Location' | 'Stars' | 'Review' | 'Themes';
type SortDirection = 'asc' | 'desc';

export const ReviewExplorer: React.FC<ReviewExplorerProps> = ({ reviews }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [selectedTheme, setSelectedTheme] = useState<string>('all');
  
  const [sortColumn, setSortColumn] = useState<SortColumn>('Date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  
  const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set());

  const allThemes = useMemo(() => {
    const themes = new Set<string>();
    reviews.forEach(r => r.themes.forEach(t => themes.add(t.theme)));
    return Array.from(themes).sort((a, b) => a.localeCompare(b));
  }, [reviews]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleReviewExpansion = (index: number) => {
    const newExpanded = new Set(expandedReviews);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedReviews(newExpanded);
  };

  const filteredAndSortedReviews = useMemo(() => {
    let result = reviews.filter(r => {
      const matchesSearch = r.Review.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.Location.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSentiment = selectedSentiment === 'all' || 
                               r.themes.some(t => t.sentiment === selectedSentiment);
                               
      const matchesTheme = selectedTheme === 'all' || 
                           r.themes.some(t => t.theme === selectedTheme);
                               
      return matchesSearch && matchesSentiment && matchesTheme;
    });

    result.sort((a, b) => {
      let valA: any = a[sortColumn as keyof AnalyzedReview];
      let valB: any = b[sortColumn as keyof AnalyzedReview];
      
      if (sortColumn === 'Themes') {
        valA = a.themes.map(t => t.theme).join(', ');
        valB = b.themes.map(t => t.theme).join(', ');
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [reviews, searchTerm, selectedSentiment, selectedTheme, sortColumn, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedReviews.length / itemsPerPage);
  const paginatedReviews = filteredAndSortedReviews.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSentiment, selectedTheme, itemsPerPage]);

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <div className="w-4 h-4 inline-block ml-1 opacity-0 group-hover:opacity-50 transition-opacity"><ChevronUp className="w-4 h-4" /></div>;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline-block ml-1 text-indigo-600" /> : 
      <ChevronDown className="w-4 h-4 inline-block ml-1 text-indigo-600" />;
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">Review Data Explorer</h2>
        
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search reviews..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>
          
          <select 
            value={selectedTheme}
            onChange={(e) => setSelectedTheme(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all appearance-none min-w-[140px]"
          >
            <option value="all">All Themes</option>
            {allThemes.map(theme => (
              <option key={theme} value={theme}>{theme}</option>
            ))}
          </select>

          <select 
            value={selectedSentiment}
            onChange={(e) => setSelectedSentiment(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all appearance-none min-w-[140px]"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-100 select-none">
            <tr>
              <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => handleSort('Date')}>
                <div className="flex items-center gap-1">Date {renderSortIcon('Date')}</div>
              </th>
              <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => handleSort('Location')}>
                <div className="flex items-center gap-1">Location {renderSortIcon('Location')}</div>
              </th>
              <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => handleSort('Stars')}>
                <div className="flex items-center gap-1">Rating {renderSortIcon('Stars')}</div>
              </th>
              <th className="px-6 py-4 w-1/2 cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => handleSort('Review')}>
                <div className="flex items-center gap-1">Review {renderSortIcon('Review')}</div>
              </th>
              <th className="px-6 py-4 cursor-pointer group hover:bg-slate-100 transition-colors whitespace-nowrap" onClick={() => handleSort('Themes')}>
                <div className="flex items-center gap-1">Themes & Sentiment {renderSortIcon('Themes')}</div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedReviews.map((review, idx) => {
              const globalIdx = (currentPage - 1) * itemsPerPage + idx;
              const isExpanded = expandedReviews.has(globalIdx);
              const isLong = review.Review.length > 150;
              
              return (
                <tr key={globalIdx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">{review.Date}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">{review.Location}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-800">{review.Stars}</span>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {review.Review.length > 0 ? (
                      <>
                        <p className="text-slate-700">
                          {isExpanded || !isLong ? review.Review : `${review.Review.substring(0, 150)}...`}
                        </p>
                        {isLong && (
                          <button 
                            onClick={() => toggleReviewExpansion(globalIdx)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold mt-2 focus:outline-none"
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">No text</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {review.themes.map((t, i) => (
                        <span 
                          key={i} 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${t.sentiment === 'positive' ? 'bg-[#186a98]/10 text-[#186a98] border-[#186a98]/20' : 
                              t.sentiment === 'negative' ? 'bg-[#bc195f]/10 text-[#bc195f] border-[#bc195f]/20' : 
                              'bg-[#878c91]/10 text-[#878c91] border-[#878c91]/20'}`}
                        >
                          {t.theme}
                        </span>
                      ))}
                      {review.themes.length === 0 && <span className="text-slate-400 italic">None detected</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {filteredAndSortedReviews.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Show</span>
              <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
                {[50, 100, 150].map(num => (
                  <button
                    key={num}
                    onClick={() => setItemsPerPage(num)}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${itemsPerPage === num ? 'bg-indigo-50 text-indigo-700 border-r last:border-r-0 border-indigo-100' : 'hover:bg-slate-50 border-r last:border-r-0 border-slate-200 text-slate-600'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <span>per page</span>
            </div>

            <div className="text-sm text-slate-600 font-medium">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedReviews.length)} of {filteredAndSortedReviews.length} entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-medium text-slate-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        
        {filteredAndSortedReviews.length === 0 && (
          <div className="p-12 text-center text-slate-500">
            No reviews found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};
