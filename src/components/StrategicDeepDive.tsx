import React, { useState } from 'react';
import { AnalyzedReview } from '../types';
import { getDeepAnalysis } from '../services/geminiService';
import { Network, Loader2, Sparkles, ChevronRight } from 'lucide-react';

interface StrategicDeepDiveProps {
  reviews: AnalyzedReview[];
  language: string;
  location?: string;
}

export const StrategicDeepDive: React.FC<StrategicDeepDiveProps> = ({ reviews, language, location }) => {
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const currentLocationKey = location || 'all';
  const currentAnalysis = analyses[currentLocationKey] || null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const result = await getDeepAnalysis(reviews, language, location);
      setAnalyses(prev => ({ ...prev, [currentLocationKey]: result }));
    } catch (e) {
      setAnalyses(prev => ({ ...prev, [currentLocationKey]: "Failed to generate deep analysis." }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl shadow-xl overflow-hidden text-white relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      
      <div className="p-8 md:p-12 relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
            <Network className="w-8 h-8 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Strategic Deep Dive</h2>
            <p className="text-indigo-200/80 mt-1 font-medium flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Powered by Gemini 3.1 Pro Thinking
            </p>
          </div>
        </div>

        {!currentAnalysis && !isLoading ? (
          <div className="mt-8">
            <p className="text-slate-300 text-lg max-w-2xl leading-relaxed mb-8">
              Uncover hidden patterns, root causes for negative feedback, and actionable strategic recommendations based on your review data.
              {location && <span className="block mt-2 text-indigo-300 font-semibold">Currently tailored for: {location}</span>}
            </p>
            <button
              onClick={handleGenerate}
              className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-indigo-950 bg-white rounded-full overflow-hidden transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Generate Deep Analysis
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        ) : isLoading ? (
          <div className="mt-12 flex flex-col items-center justify-center py-12 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-6" />
            <h3 className="text-xl font-semibold text-white mb-2">Thinking Deeply...</h3>
            <p className="text-indigo-200/70 text-center max-w-md">
              Gemini is analyzing subtle patterns in the text, connecting them with star ratings, and formulating strategic recommendations. This may take a minute.
            </p>
          </div>
        ) : (
          <div className="mt-8 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm p-8 prose prose-invert max-w-none prose-headings:text-indigo-300 prose-a:text-indigo-400">
            {currentAnalysis?.split('\n').map((line, i) => {
              if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mt-8 mb-4">{line.replace('## ', '')}</h2>;
              if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-bold mt-10 mb-6">{line.replace('# ', '')}</h1>;
              if (line.startsWith('**') && line.endsWith('**')) return <strong key={i} className="block mt-4 mb-2 text-indigo-200">{line.replace(/\*\*/g, '')}</strong>;
              if (line.startsWith('- ')) return <li key={i} className="ml-4 mb-2 text-slate-300">{line.replace('- ', '')}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="text-slate-300 leading-relaxed mb-4">{line.replace(/\*\*/g, '')}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
