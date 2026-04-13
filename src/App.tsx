import React, { useState, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { TopicAnalysis } from './components/TopicAnalysis';
import { ReviewExplorer } from './components/ReviewExplorer';
import { Chatbot } from './components/Chatbot';
import { StrategicDeepDive } from './components/StrategicDeepDive';
import { MultiSelect } from './components/MultiSelect';
import { RawReview, AnalyzedReview, ThemeSummary, CustomThemeInput } from './types';
import { analyzeLanguage, extractThemes, analyzeReviewsBatch, generateSummaries } from './services/geminiService';
import { Loader2, AlertCircle, Filter, LayoutDashboard, Brain, MessageSquare, FileText, Info, X, Calendar } from 'lucide-react';

export default function App() {
  const [rawReviews, setRawReviews] = useState<RawReview[] | null>(null);
  const [analyzedReviews, setAnalyzedReviews] = useState<AnalyzedReview[] | null>(null);
  const [themes, setThemes] = useState<ThemeSummary[] | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [totalReviewsCount, setTotalReviewsCount] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [filterA, setFilterA] = useState<string[]>(['all']);
  const [filterB, setFilterB] = useState<string[]>(['none']);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'topics' | 'chat' | 'data' | 'info'>('dashboard');

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: "Hi! I'm your CX Intelligence Assistant. Ask me anything about the review data, and I'll answer based strictly on what customers have said." }
  ]);

  const handleReset = () => {
    setRawReviews(null);
    setAnalyzedReviews(null);
    setThemes(null);
    setLanguage(null);
    setDatasetName(null);
    setError(null);
    setActiveTab('dashboard');
    setFilterA(['all']);
    setFilterB(['none']);
    setFromDate('');
    setToDate('');
    setChatMessages([
      { role: 'model', text: "Hi! I'm your CX Intelligence Assistant. Ask me anything about the review data, and I'll answer based strictly on what customers have said." }
    ]);
  };

  const firms = useMemo(() => {
    if (!rawReviews) return [];
    return (Array.from(new Set(rawReviews.map(r => r.Location))) as string[]).sort((a, b) => a.localeCompare(b));
  }, [rawReviews]);

  const minDate = useMemo(() => {
    if (!analyzedReviews || analyzedReviews.length === 0) return '';
    const dates = analyzedReviews.map(r => new Date(r.Date).getTime()).filter(t => !isNaN(t));
    if (dates.length === 0) return '';
    return new Date(Math.min(...dates)).toISOString().split('T')[0];
  }, [analyzedReviews]);

  const dateFilteredAnalyzedReviews = useMemo(() => {
    if (!analyzedReviews) return null;
    return analyzedReviews.filter(r => {
      if (!fromDate && !toDate) return true;
      const reviewDate = new Date(r.Date).getTime();
      if (isNaN(reviewDate)) return true;
      
      let isValid = true;
      if (fromDate) {
        const fromTime = new Date(fromDate).getTime();
        if (reviewDate < fromTime) isValid = false;
      }
      if (toDate) {
        const toTime = new Date(toDate).getTime() + 86400000 - 1; 
        if (reviewDate > toTime) isValid = false;
      }
      return isValid;
    });
  }, [analyzedReviews, fromDate, toDate]);

  const filteredAnalyzedReviews = useMemo(() => {
    if (!dateFilteredAnalyzedReviews) return null;
    return dateFilteredAnalyzedReviews.filter(r => {
      const inA = filterA.includes('all') || filterA.includes(r.Location);
      const inB = filterB.includes('all') || filterB.includes(r.Location);
      return inA || inB;
    });
  }, [dateFilteredAnalyzedReviews, filterA, filterB]);

  const handleDataLoaded = async (data: RawReview[], filename: string, customThemes?: CustomThemeInput[]) => {
    setRawReviews(data);
    setDatasetName(filename);
    setError(null);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalyzedCount(0);
    setTotalReviewsCount(data.length);
    
    try {
      setAnalysisStep('Detecting language...');
      const lang = await analyzeLanguage(data);
      setLanguage(lang);
      setAnalysisProgress(10);

      setAnalysisStep(customThemes ? `Analyzing custom themes in ${lang}...` : `Extracting top themes in ${lang}...`);
      const extractedThemes = await extractThemes(data, lang, customThemes);
      setAnalysisProgress(20);

      setAnalysisStep('Analyzing individual reviews for themes and sentiment...');
      const analyzed = await analyzeReviewsBatch(
        data, 
        extractedThemes.map(t => ({
          name: t.theme,
          description: t.description
        })), 
        lang,
        (progress, analyzed, total) => {
          setAnalysisProgress(20 + Math.floor(progress * 0.6));
          setAnalyzedCount(analyzed);
          setTotalReviewsCount(total);
        }
      );
      setAnalyzedReviews(analyzed);
      
      setAnalysisStep('Generating tailored summaries...');
      const finalThemes = await generateSummaries(analyzed, extractedThemes, lang);
      
      // Calculate mention counts to sort themes from most prominent to least prominent
      const themeCounts: Record<string, number> = {};
      analyzed.forEach(r => {
        r.themes.forEach(t => {
          themeCounts[t.theme] = (themeCounts[t.theme] || 0) + 1;
        });
      });
      
      finalThemes.sort((a, b) => (themeCounts[b.theme] || 0) - (themeCounts[a.theme] || 0));
      
      setThemes(finalThemes);
      
      setAnalysisProgress(100);
    } catch (err) {
      setError("An error occurred during analysis. Please try again.");
      console.error(err);
      setRawReviews(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!rawReviews && !isAnalyzing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div>
            <div className="inline-flex items-center justify-center p-4 bg-indigo-600 text-white rounded-2xl mb-6 shadow-lg shadow-indigo-200">
              <Brain className="w-12 h-12" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Experience <span className="text-indigo-600">AI</span>Q</h1>
            <p className="text-xl text-slate-500 font-medium">Unlock next level CX intelligence</p>
          </div>
          
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
            <FileUpload onDataLoaded={handleDataLoaded} onError={setError} />
            {error && (
              <div className="mt-6 p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-3 text-sm font-medium border border-rose-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold">
              {analysisProgress}%
            </div>
          </div>
          {analysisStep === 'Analyzing individual reviews for themes and sentiment...' && totalReviewsCount > 0 && (
            <div className="mb-6 text-sm font-semibold text-indigo-600 bg-indigo-50 inline-block px-3 py-1 rounded-full">
              {analyzedCount} / {totalReviewsCount} reviews analyzed
            </div>
          )}
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Analyzing Data</h2>
          <p className="text-slate-500 font-medium">{analysisStep}</p>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-8 overflow-hidden">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  const getFilterLabel = (filter: string[], name: string) => {
    if (filter.includes('all')) return `${name}: All Firms`;
    if (filter.length === 1) return `${name}: ${filter[0]}`;
    return `${name}: ${filter.length} Firms`;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[5rem] py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Experience <span className="text-indigo-600">AI</span>Q</h1>
              <p className="text-xs font-medium text-slate-500 mt-1">CX Intelligence Platform</p>
            </div>
          </div>
          
          <div className="flex items-end gap-4 flex-wrap">
            {/* Date Filters */}
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Start Date</label>
                <div className="relative">
                  <input 
                    id="from-date-input"
                    type="date" 
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onClick={(e) => { 
                      try { (e.target as HTMLInputElement).showPicker(); } catch (err) {}
                      if (!fromDate) {
                        setTimeout(() => setFromDate(minDate), 0);
                      }
                    }}
                    className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full px-3 py-2 cursor-pointer"
                    title="From Date"
                  />
                </div>
              </div>

              <span className="text-slate-300 font-medium pb-2">-</span>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">End Date</label>
                <div className="relative">
                  <input 
                    id="to-date-input"
                    type="date" 
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onClick={(e) => { 
                      try { (e.target as HTMLInputElement).showPicker(); } catch (err) {}
                      if (!toDate) {
                        setTimeout(() => setToDate(new Date().toISOString().split('T')[0]), 0);
                      }
                    }}
                    className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full px-3 py-2 cursor-pointer"
                    title="To Date"
                  />
                </div>
              </div>
            </div>

            {/* Comparison Filters */}
            <div className="flex items-end gap-3">
              <MultiSelect
                options={firms}
                selected={filterA}
                onChange={setFilterA}
                label="Filter A (Primary)"
              />
              <MultiSelect
                options={firms}
                selected={filterB}
                onChange={setFilterB}
                label="Filter B (Comparison)"
                isComparison
              />
            </div>

            {/* Clear Filters */}
            {(fromDate || toDate || !filterA.includes('all') || !filterB.includes('none')) && (
              <button 
                onClick={() => { setFromDate(''); setToDate(''); setFilterA(['all']); setFilterB(['none']); }}
                className="flex items-center gap-1 px-3 py-2 mb-[1px] bg-white text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-sm font-medium border border-rose-200"
                title="Clear All Filters"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> General KPIs
          </button>
          <button 
            onClick={() => setActiveTab('topics')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === 'topics' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Brain className="w-4 h-4" /> CX Benchmarking
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <MessageSquare className="w-4 h-4" /> Chat with Data
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === 'data' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <FileText className="w-4 h-4" /> Data Explorer
          </button>
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
              ${activeTab === 'info' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Info className="w-4 h-4" /> Information
          </button>
        </div>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'dashboard' && filteredAnalyzedReviews && (
            <Dashboard reviews={dateFilteredAnalyzedReviews!} filterA={filterA} filterB={filterB} />
          )}
          
          {activeTab === 'topics' && filteredAnalyzedReviews && themes && (
            <TopicAnalysis 
              allReviews={dateFilteredAnalyzedReviews!} 
              filteredReviews={filteredAnalyzedReviews} 
              themes={themes} 
              filterA={filterA}
              filterB={filterB}
            />
          )}
          
          {activeTab === 'chat' && filteredAnalyzedReviews && language && (
            <Chatbot 
              reviews={filteredAnalyzedReviews} 
              language={language} 
              messages={chatMessages}
              setMessages={setChatMessages}
            />
          )}
          
          {activeTab === 'data' && filteredAnalyzedReviews && (
            <ReviewExplorer reviews={filteredAnalyzedReviews} />
          )}
          
          {activeTab === 'info' && rawReviews && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Info className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Dataset Information</h2>
              </div>
              
              <div className="space-y-6 mb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-1">Dataset Name</p>
                    <p className="text-lg font-semibold text-slate-800 truncate" title={datasetName || 'Unknown'}>{datasetName || 'Unknown'}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-1">Detected Language</p>
                    <p className="text-lg font-semibold text-slate-800">{language || 'Detecting...'}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Reviews ({getFilterLabel(filterA, 'Filter A')})</p>
                    <p className="text-lg font-semibold text-slate-800">{(filterA.includes('all') ? rawReviews : rawReviews.filter(r => filterA.includes(r.Location))).length.toLocaleString()}</p>
                  </div>
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-sm font-medium text-slate-500 mb-1">Reviews with Text ({getFilterLabel(filterA, 'Filter A')})</p>
                    <p className="text-lg font-semibold text-slate-800">{(filterA.includes('all') ? rawReviews : rawReviews.filter(r => filterA.includes(r.Location))).filter(r => r.Review && r.Review.trim().length > 0).length.toLocaleString()}</p>
                  </div>
                  {!filterB.includes('none') && (
                    <>
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-sm font-medium text-slate-500 mb-1">Total Reviews ({getFilterLabel(filterB, 'Filter B')})</p>
                        <p className="text-lg font-semibold text-slate-800">{(filterB.includes('all') ? rawReviews : rawReviews.filter(r => filterB.includes(r.Location))).length.toLocaleString()}</p>
                      </div>
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-sm font-medium text-slate-500 mb-1">Reviews with Text ({getFilterLabel(filterB, 'Filter B')})</p>
                        <p className="text-lg font-semibold text-slate-800">{(filterB.includes('all') ? rawReviews : rawReviews.filter(r => filterB.includes(r.Location))).filter(r => r.Review && r.Review.trim().length > 0).length.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={handleReset}
                  className="px-6 py-3 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-semibold rounded-xl transition-colors flex items-center gap-2"
                >
                  Reset Dataset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Strategic Deep Dive */}
        {filteredAnalyzedReviews && language && (
          <div className="mt-16 pt-8 border-t border-slate-200">
            <StrategicDeepDive 
              reviews={filteredAnalyzedReviews} 
              language={language}
              location={!filterA.includes('all') ? filterA.join(', ') : undefined} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
