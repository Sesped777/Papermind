
import React, { useCallback } from 'react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, disabled }) => {
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file: File) => file.type === 'application/pdf'
    );
    
    if (droppedFiles.length > 0) {
      onFilesSelected(droppedFiles);
    }
  }, [onFilesSelected, disabled]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || !e.target.files) return;
    const selectedFiles = Array.from(e.target.files).filter(
        (file: File) => file.type === 'application/pdf'
    );
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
    // Reset the input value so the same file can be selected again if needed
    // and to ensure the change event fires on subsequent clicks.
    e.target.value = '';
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300
        ${disabled 
          ? 'border-slate-700 bg-slate-800/50 opacity-50 cursor-not-allowed' 
          : 'border-cyan-500/30 bg-slate-800/50 hover:border-cyan-400 hover:bg-slate-800 cursor-pointer group'
        }
      `}
    >
      <input
        type="file"
        multiple
        accept=".pdf"
        onChange={handleInputChange}
        className="hidden"
        id="file-upload"
        disabled={disabled}
      />
      <label htmlFor="file-upload" className="cursor-pointer block w-full h-full">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full bg-slate-700/50 group-hover:bg-cyan-500/10 transition-colors`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div className="text-slate-300">
            <span className="text-cyan-400 font-medium">Haz clic para subir</span> o arrastra y suelta
          </div>
          <p className="text-xs text-slate-500">
            Solo archivos PDF (máx 20MB por archivo)
          </p>
        </div>
      </label>
    </div>
  );
};
