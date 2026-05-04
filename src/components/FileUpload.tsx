import React, { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { RawReview, CustomThemeInput } from '../types';
import { Upload, Settings2, Plus, Trash2, FileText, Brain, FileSpreadsheet } from 'lucide-react';

interface FileUploadProps {
  onDataLoaded: (data: RawReview[], filename: string, customThemes?: CustomThemeInput[]) => void;
  onError: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onError }) => {
  const [customThemes, setCustomThemes] = useState<CustomThemeInput[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [parsedData, setParsedData] = useState<RawReview[] | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [themeUploadInfo, setThemeUploadInfo] = useState<string | null>(null);
  const themeFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleThemeFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false }) as Record<string, unknown>[];

        if (json.length === 0) {
          onError('The themes file is empty.');
          return;
        }

        // Accept Topic/Theme/Name + Description, case-insensitive.
        const firstRow = json[0];
        const keys = Object.keys(firstRow);
        const findKey = (...candidates: string[]) =>
          keys.find(k => candidates.some(c => k.trim().toLowerCase() === c.toLowerCase()));
        const topicKey = findKey('Topic', 'Theme', 'Name');
        const descKey = findKey('Description', 'Beschreibung');

        if (!topicKey) {
          onError('Themes file must contain a "Topic" (or "Theme"/"Name") column.');
          return;
        }

        const imported: CustomThemeInput[] = [];
        const seen = new Set<string>();
        json.forEach(row => {
          const name = String(row[topicKey] ?? '').trim();
          const description = descKey ? String(row[descKey] ?? '').trim() : '';
          if (!name) return;
          const dedupeKey = name.toLowerCase();
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          imported.push({ name, description });
        });

        if (imported.length === 0) {
          onError('No themes found in the uploaded file.');
          return;
        }

        // Merge with existing themes, deduping by name (case-insensitive).
        const merged: CustomThemeInput[] = [...customThemes];
        const existingNames = new Set(customThemes.map(t => t.name.trim().toLowerCase()).filter(Boolean));
        let added = 0;
        imported.forEach(t => {
          if (existingNames.has(t.name.toLowerCase())) return;
          merged.push(t);
          existingNames.add(t.name.toLowerCase());
          added++;
        });
        setCustomThemes(merged);
        setThemeUploadInfo(
          added === imported.length
            ? `Imported ${added} theme${added === 1 ? '' : 's'} from ${file.name}.`
            : `Imported ${added} new theme${added === 1 ? '' : 's'} from ${file.name} (${imported.length - added} duplicate${imported.length - added === 1 ? '' : 's'} skipped).`
        );
      } catch (err) {
        onError("Failed to parse the themes file. Please ensure it's a valid Excel or CSV file with a 'Topic' column.");
      } finally {
        if (themeFileInputRef.current) themeFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
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
            <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custom Themes (Optional)
                </label>
                <p className="text-xs text-slate-500">
                  Define specific themes and descriptions to guide the AI's analysis. If left empty, themes will be automatically detected.
                  You can also upload an Excel/CSV file with two columns: <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">Topic</span> and <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">Description</span>.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  ref={themeFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleThemeFileUpload(file);
                  }}
                />
                <button
                  onClick={() => themeFileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-medium transition-colors"
                  title="Upload an Excel/CSV file with Topic and Description columns"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Upload Themes
                </button>
                <button
                  onClick={handleAddTheme}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Theme
                </button>
              </div>
            </div>

            {themeUploadInfo && (
              <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center justify-between gap-3">
                <span>{themeUploadInfo}</span>
                <button
                  onClick={() => setThemeUploadInfo(null)}
                  className="text-emerald-600 hover:text-emerald-800 font-bold"
                  aria-label="Dismiss"
                >×</button>
              </div>
            )}

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
