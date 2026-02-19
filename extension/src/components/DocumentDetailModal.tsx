import { useState, useEffect, useRef } from 'react';
import { X, FileText, Calendar, Users, DollarSign, Hash, Globe, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { api } from '../services/api';
import type { SmartDocument } from '../types/documents';

interface DocumentDetailModalProps {
  document: SmartDocument;
  onClose: () => void;
  onDelete: () => void;
  onRename: (updated: SmartDocument) => void;
}

export function DocumentDetailModal({ document, onClose, onDelete, onRename }: DocumentDetailModalProps) {
  const meta = document.metadata;
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isImage = document.file_type.startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    api.getDocumentURL(document.id).then((url) => {
      if (!cancelled) setPreviewURL(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [document.id, isImage]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const handleSaveTitle = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === document.title) {
      setIsEditing(false);
      setEditTitle(document.title);
      return;
    }
    setIsSaving(true);
    try {
      const updated = await api.renameDocument(document.id, trimmed);
      onRename(updated);
      setIsEditing(false);
    } catch {
      setEditTitle(document.title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(document.title);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDocTypeBadge = (docType: string) => {
    const colors: Record<string, string> = {
      invoice: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
      receipt: 'bg-green-900/50 text-green-300 border-green-700/50',
      contract: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
      deed: 'bg-amber-900/50 text-amber-300 border-amber-700/50',
      certificate: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/50',
      id_document: 'bg-red-900/50 text-red-300 border-red-700/50',
      bank_statement: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50',
      tax_form: 'bg-orange-900/50 text-orange-300 border-orange-700/50',
      insurance: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/50',
      medical: 'bg-pink-900/50 text-pink-300 border-pink-700/50',
    };
    const style = colors[docType] || 'bg-slate-700 text-slate-300 border-slate-600';
    return (
      <span className={`text-xs px-2 py-0.5 rounded border ${style}`}>
        {docType.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="bg-slate-800 rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-5 h-5 text-purple-400 shrink-0" />
            {isEditing ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <input
                  ref={inputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveTitle}
                  className="bg-slate-700 text-white text-lg font-bold rounded px-2 py-0.5 min-w-0 flex-1 outline-none focus:ring-1 focus:ring-purple-500"
                  disabled={isSaving}
                />
                {isSaving && <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />}
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold truncate">
                  {meta?.title || document.title || document.file_name}
                </h2>
                <button
                  onClick={() => {
                    setEditTitle(document.title);
                    setIsEditing(true);
                  }}
                  className="p-1 text-slate-500 hover:text-purple-400 transition-colors shrink-0"
                  title="Rename"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {/* Thumbnail Preview */}
          {isImage && previewURL && (
            <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
              <img
                src={previewURL}
                alt={document.file_name}
                className="w-full max-h-48 object-contain"
              />
            </div>
          )}

          {/* File Info */}
          <div className="bg-slate-700/50 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">File</span>
              <span className="text-white truncate ml-2 max-w-[200px]">{document.file_name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Type</span>
              <span className="text-white">{document.file_type}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Size</span>
              <span className="text-white">{formatFileSize(document.file_size)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Uploaded</span>
              <span className="text-white">{formatDate(document.created_at)}</span>
            </div>
          </div>

          {/* OCR Status: Processing */}
          {(document.ocr_status === 'pending' || document.ocr_status === 'processing') && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-amber-300 text-sm font-medium">Analysis in progress...</p>
              <p className="text-slate-500 text-xs">This may take a few seconds</p>
            </div>
          )}

          {/* OCR Status: Failed */}
          {document.ocr_status === 'failed' && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 text-sm font-medium">Analysis failed</p>
                {document.ocr_error && (
                  <p className="text-red-400/80 text-xs mt-1">{document.ocr_error}</p>
                )}
              </div>
            </div>
          )}

          {/* OCR Status: Completed — Metadata */}
          {document.ocr_status === 'completed' && meta && (
            <>
              {/* Document Type & Confidence */}
              <div className="flex items-center justify-between">
                {getDocTypeBadge(meta.document_type)}
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        meta.confidence >= 80 ? 'bg-green-500' : meta.confidence >= 50 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${meta.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{meta.confidence}%</span>
                </div>
              </div>

              {/* Summary */}
              {meta.summary && (
                <div>
                  <p className="text-slate-300 text-xs leading-relaxed">{meta.summary}</p>
                </div>
              )}

              {/* Dates */}
              {meta.dates && meta.dates.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Dates</span>
                  </div>
                  <div className="space-y-1">
                    {meta.dates.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{d.label}</span>
                        <span className="text-white">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parties */}
              {meta.parties && meta.parties.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Parties</span>
                  </div>
                  <div className="space-y-1">
                    {meta.parties.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{p.role}</span>
                        <span className="text-white">{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amounts */}
              {meta.amounts && meta.amounts.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Amounts</span>
                  </div>
                  <div className="space-y-1">
                    {meta.amounts.map((a, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-400">{a.label}</span>
                        <span className="text-white">
                          {a.value} {a.currency}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Fields */}
              {meta.key_fields && Object.keys(meta.key_fields).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300">Key Fields</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(meta.key_fields).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-slate-400">{key.replace(/_/g, ' ')}</span>
                        <span className="text-white truncate ml-2 max-w-[180px]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Language */}
              {meta.language && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Globe className="w-3 h-3" />
                  <span>Language: {meta.language.toUpperCase()}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-slate-700 shrink-0">
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 text-red-300 rounded-lg text-sm font-medium transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
