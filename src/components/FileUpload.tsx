import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { RawReview, CustomThemeInput } from '../types';
import { Upload, Settings2, Plus, Trash2, FileText, Brain } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (data: RawReview[], filename: string, customThemes?: CustomThemeInput[]) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onError }) => {
  const [customThemes, setCustomThemes] = useState<CustomThemeInput[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [parsedData, setParsedData] = useState<RawReview[] | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const handleAddTheme = () => {
    setCustomThemes([...customThemes, { name: '', description: '' }]);
  };

  const handleRemoveTheme = (index: number) => {
    setCustomThemes(customThemes.filter((_, i) => i !== index));
  };

  const handleThemeChange = (index: number, field: 'name' | 'description', value: string) => {
    const newThemes = [...customThemes];
    newThemes[index][field] = value;
    setCustomThemes(newThemes);
  };

  const handleStartAnalysis = () => {
    if (parsedData && filename) {
      const validCustomThemes = customThemes.filter(t => t.name.trim().length > 0);
      onDataLoaded(parsedData, filename, validCustomThemes.length > 0 ? validCustomThemes : undefined);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

        // Validate columns
        if (json.length === 0) {
          onError("The file is empty.");
          return;
        }

        const firstRow = json[0] as any;
        const requiredColumns = ['Date', 'Stars', 'Review', 'Location'];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));

        if (missingColumns.length > 0) {
          onError(`Missing required columns: ${missingColumns.join(', ')}`);
          return;
        }

        const reviews: RawReview[] = json.map((row: any) => {
          let dateStr = String(row.Date);
          // Check if it's an Excel serial date number
          if (typeof row.Date === 'number' && row.Date > 20000) {
            const date = new Date(Math.round((row.Date - 25569) * 86400 * 1000));
            dateStr = date.toISOString().split('T')[0];
          }
          return {
            Date: dateStr,
            Stars: Number(row.Stars),
            Review: row.Review ? String(row.Review).trim() : '',
            Location: String(row.Location),
            Address: row.Address ? String(row.Address) : undefined,
          };
        });

        setParsedData(reviews);
        setFilename(file.name);
      } catch (err) {
        onError("Failed to parse the file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, [onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDrop as any,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  } as any);

  return (
    <div className="space-y-6">
      {!parsedData ? (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <p className="text-lg font-medium text-slate-700">
                {isDragActive ? "Drop the file here" : "Drag & drop your review data"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Supports .xlsx, .xls, .csv
              </p>
            </div>
            <div className="text-xs text-slate-400 mt-4 max-w-md">
              Required columns: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">Date</span>, <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">Stars</span>, <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">Review</span>, <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">Location</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{filename}</h3>
              <p className="text-sm text-slate-600">{parsedData.length.toLocaleString()} reviews ready for analysis</p>
            </div>
          </div>
          <button
            onClick={() => { setParsedData(null); setFilename(null); }}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium px-3 py-1.5 rounded-md hover:bg-indigo-100 transition-colors"
          >
            Change File
          </button>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-400" />
            Advanced Options
          </div>
          <span className="text-xs text-slate-500">{showAdvanced ? 'Hide' : 'Show'}</span>
        </button>
        
        {showAdvanced && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custom Themes (Optional)
                </label>
                <p className="text-xs text-slate-500">
                  Define specific themes and descriptions to guide the AI's analysis. If left empty, themes will be automatically detected.
                </p>
              </div>
              <button
                onClick={handleAddTheme}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-medium transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" /> Add Theme
              </button>
            </div>
            
            <div className="space-y-3">
              {customThemes.map((theme, index) => (
                <div key={index} className="flex gap-3 items-start bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <div className="flex-1 space-y-3">
                    <div>
                      <input
                        type="text"
                        value={theme.name}
                        onChange={(e) => handleThemeChange(index, 'name', e.target.value)}
                        placeholder="Theme Name (e.g., Customer Service)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={theme.description}
                        onChange={(e) => handleThemeChange(index, 'description', e.target.value)}
                        placeholder="Description (e.g., Mentions of staff behavior, wait times, or support quality)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveTheme(index)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                    title="Remove Theme"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {customThemes.length === 0 && (
                <div className="text-center py-6 bg-white border border-dashed border-slate-300 rounded-lg text-slate-500 text-sm">
                  No custom themes defined. The AI will automatically detect top themes.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {parsedData && (
        <button
          onClick={handleStartAnalysis}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
        >
          <Brain className="w-6 h-6" />
          Start AI Analysis
        </button>
      )}
    </div>
  );
};
