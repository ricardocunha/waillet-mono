import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Upload, Clock, CheckCircle, XCircle, Trash2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import type { SmartDocument } from '../types/documents';
import { UploadDocumentModal } from './UploadDocumentModal';
import { DocumentDetailModal } from './DocumentDetailModal';

function isImageType(fileType: string) {
  return fileType.startsWith('image/');
}

export function SmartDocuments() {
  const [documents, setDocuments] = useState<SmartDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<SmartDocument | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError('Failed to load documents');
      console.error('Documents load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Fetch presigned URLs for image documents
  useEffect(() => {
    const imageDocs = documents.filter(
      (d) => isImageType(d.file_type) && !thumbnails[d.id]
    );
    if (imageDocs.length === 0) return;

    imageDocs.forEach(async (doc) => {
      try {
        const url = await api.getDocumentURL(doc.id);
        setThumbnails((prev) => ({ ...prev, [doc.id]: url }));
      } catch {
        // Silently fail — will show icon fallback
      }
    });
  }, [documents, thumbnails]);

  // Auto-poll if any documents are pending/processing
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.ocr_status === 'pending' || d.ocr_status === 'processing'
    );
    if (!hasPending) return;

    const interval = setInterval(loadDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, loadDocuments]);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleRename = (updated: SmartDocument) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d))
    );
    setSelectedDoc(updated);
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
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
    }
  };

  const getDocTypeColor = (docType?: string) => {
    const colors: Record<string, string> = {
      invoice: 'bg-blue-900/50 text-blue-300',
      receipt: 'bg-green-900/50 text-green-300',
      contract: 'bg-purple-900/50 text-purple-300',
      deed: 'bg-amber-900/50 text-amber-300',
      certificate: 'bg-cyan-900/50 text-cyan-300',
      id_document: 'bg-red-900/50 text-red-300',
      bank_statement: 'bg-emerald-900/50 text-emerald-300',
      tax_form: 'bg-orange-900/50 text-orange-300',
      insurance: 'bg-indigo-900/50 text-indigo-300',
      medical: 'bg-pink-900/50 text-pink-300',
    };
    return colors[docType || ''] || 'bg-slate-700 text-slate-300';
  };

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Smart Documents</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-900/20 border border-red-700/50 rounded-lg mb-3">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-red-400 text-xs">{error}</span>
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && documents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Loading documents...
          </div>
        ) : documents.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FileText className="w-10 h-10 text-slate-600" />
            <p className="text-slate-400 text-sm">No documents yet</p>
            <button
              onClick={() => setShowUpload(true)}
              className="text-purple-400 hover:text-purple-300 text-xs font-medium transition-colors"
            >
              Upload your first document
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-2.5 bg-slate-800 hover:bg-slate-750 rounded-lg transition-colors cursor-pointer group"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {thumbnails[doc.id] ? (
                      <img
                        src={thumbnails[doc.id]}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover shrink-0 bg-slate-700"
                      />
                    ) : (
                      <div className="p-1.5 bg-slate-700 rounded-lg shrink-0">
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-xs font-medium truncate max-w-[140px]">
                          {doc.metadata?.title || doc.title || doc.file_name}
                        </span>
                        {getStatusIcon(doc.ocr_status)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {doc.document_type && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${getDocTypeColor(doc.document_type)}`}>
                            {doc.document_type.replace('_', ' ')}
                          </span>
                        )}
                        <span className="text-slate-500 text-[10px]">
                          {formatFileSize(doc.file_size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[10px] shrink-0">
                      {formatDate(doc.created_at)}
                    </span>
                    {deleteConfirm === doc.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-medium"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="text-[10px] text-slate-400 hover:text-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(doc.id);
                        }}
                        className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <UploadDocumentModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            loadDocuments();
          }}
        />
      )}

      {selectedDoc && (
        <DocumentDetailModal
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onDelete={() => {
            handleDelete(selectedDoc.id);
            setSelectedDoc(null);
          }}
          onRename={handleRename}
        />
      )}
    </div>
  );
}
