import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  isComparison?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onChange, label, isComparison }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (option: string) => {
    if (option === 'all' || option === 'none') {
      onChange([option]);
      setIsOpen(false);
      return;
    }

    let newSelected = [...selected];
    if (newSelected.includes('all') || newSelected.includes('none')) {
      newSelected = [];
    }

    if (newSelected.includes(option)) {
      newSelected = newSelected.filter(item => item !== option);
      if (newSelected.length === 0) {
        newSelected = [isComparison ? 'none' : 'all'];
      }
    } else {
      newSelected.push(option);
    }
    onChange(newSelected);
  };

  const getDisplayText = () => {
    if (selected.includes('all')) return 'All Firms (Overall)';
    if (selected.includes('none')) return 'No Comparison';
    if (selected.length === 1) return selected[0];
    if (selected.length === options.length) return 'All Firms (Overall)';
    return `${selected.length} Selected`;
  };

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <div 
        className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 flex items-center justify-between px-3 py-2 cursor-pointer min-w-[180px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate mr-2">{getDisplayText()}</span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {isComparison && (
            <div 
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between ${selected.includes('none') ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
              onClick={() => handleToggle('none')}
            >
              <span>No Comparison</span>
              {selected.includes('none') && <Check className="w-4 h-4 shrink-0" />}
            </div>
          )}
          <div 
            className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between ${selected.includes('all') ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
            onClick={() => handleToggle('all')}
          >
            <span>{isComparison ? 'Average (All Locations)' : 'All Firms (Overall)'}</span>
            {selected.includes('all') && <Check className="w-4 h-4 shrink-0" />}
          </div>
          <div className="h-px bg-slate-100 my-1"></div>
          {options.map(option => (
            <div 
              key={option}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 flex items-center justify-between ${selected.includes(option) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
              onClick={() => handleToggle(option)}
            >
              <span className="truncate pr-2">{option}</span>
              {selected.includes(option) && <Check className="w-4 h-4 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
