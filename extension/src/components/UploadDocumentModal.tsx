import { useState, useRef } from 'react';
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface UploadDocumentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export function UploadDocumentModal({ onClose, onSuccess }: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Unsupported file type. Please upload an image (JPEG, PNG, WebP, GIF) or PDF.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      await api.uploadDocument(file);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return 'PDF';
    if (type.startsWith('image/')) return 'IMG';
    return 'DOC';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Upload Document</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            disabled={isUploading || success}
          >
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="bg-green-500 rounded-full p-3 mb-4">
              <Check size={32} className="text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-400 mb-2">Document Uploaded!</h3>
            <p className="text-slate-400 text-sm text-center">
              Your document is being analyzed...
            </p>
          </div>
        ) : (
          <>
            {/* Dropzone / File Preview */}
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-lg p-8 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <p className="text-slate-300 text-sm mb-1">
                  Click to select or drag & drop
                </p>
                <p className="text-slate-500 text-xs">
                  Images (JPEG, PNG, WebP, GIF) or PDF, max 10MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>
            ) : (
              <div className="bg-slate-700 rounded-lg p-4 flex items-center gap-3">
                <div className="bg-purple-900/50 rounded-lg p-2.5 shrink-0">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                  <p className="text-slate-400 text-xs">
                    {getFileIcon(file.type)} · {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  className="text-slate-400 hover:text-white p-1 transition-colors"
                  disabled={isUploading}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-700 rounded-lg p-3 flex gap-2">
                <AlertCircle className="flex-shrink-0 text-red-400 mt-0.5" size={20} />
                <div className="text-sm text-red-200">{error}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading & analyzing...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
