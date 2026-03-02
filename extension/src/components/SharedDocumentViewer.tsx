import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, Clock, User } from 'lucide-react';
import { api } from '../services/api';
import type { SharedDocumentView } from '../types/documents';

interface SharedDocumentViewerProps {
  sharedDoc: SharedDocumentView;
  viewerAddress: string;
  onClose: () => void;
}

export function SharedDocumentViewer({ sharedDoc, viewerAddress, onClose }: SharedDocumentViewerProps) {
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { share, document } = sharedDoc;
  const isImage = document.file_type.startsWith('image/');
  const isPdf = document.file_type === 'application/pdf';

  useEffect(() => {
    let cancelled = false;

    api
      .getSharedDocumentURL(share.id)
      .then((url) => {
        if (!cancelled) {
          setDocUrl(url);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load document');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [share.id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Shorten address for watermark display
  const shortAddr = `${viewerAddress.slice(0, 6)}...${viewerAddress.slice(-4)}`;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-40">
      <div className="bg-slate-800 rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate">{document.title || document.file_name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <User className="w-3 h-3" />
                <span>From: {share.owner_address.slice(0, 6)}...{share.owner_address.slice(-4)}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>Expires: {formatDate(share.expires_at)}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0 relative">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64 gap-2 p-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {docUrl && !error && (
            <div className="relative w-full h-full min-h-[300px]">
              {/* Document content */}
              {isImage && (
                <img
                  src={docUrl}
                  alt={document.file_name}
                  className="w-full h-full object-contain"
                />
              )}
              {isPdf && (
                <iframe
                  src={docUrl}
                  title={document.file_name}
                  className="w-full h-full min-h-[400px]"
                />
              )}
              {!isImage && !isPdf && (
                <div className="flex flex-col items-center justify-center h-64 gap-2">
                  <p className="text-slate-400 text-sm">Preview not available for this file type</p>
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 text-xs"
                  >
                    Download file
                  </a>
                </div>
              )}

              {/* Watermark overlay */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                <div
                  className="absolute inset-0"
                  style={{
                    transform: 'rotate(-45deg) scale(1.5)',
                    transformOrigin: 'center center',
                  }}
                >
                  <div className="flex flex-col gap-16 -mt-32">
                    {Array.from({ length: 12 }).map((_, row) => (
                      <div key={row} className="flex gap-12 justify-center">
                        {Array.from({ length: 6 }).map((_, col) => (
                          <span
                            key={col}
                            className="text-white/10 text-[10px] font-mono whitespace-nowrap"
                          >
                            {viewerAddress}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              Viewing as: {shortAddr}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
