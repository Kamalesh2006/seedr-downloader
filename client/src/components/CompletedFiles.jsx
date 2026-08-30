import React from 'react';
import { Folder, File, Download, Trash2 } from 'lucide-react';

export default function CompletedFiles({ files, onDownload, onDelete }) {
  if (!files || files.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl shadow-lg p-8 border border-gray-800 text-center">
        <Folder className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-300">Your Seedr is empty</h3>
        <p className="text-sm text-gray-500 mt-1">Search for a torrent or paste a magnet link to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
        <h3 className="text-lg font-semibold text-gray-100">Files in Seedr</h3>
      </div>
      
      <div className="divide-y divide-gray-800">
        {files.map(file => (
          <div key={`${file.type}-${file.id}`} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="p-2 bg-gray-800 rounded-lg shrink-0">
                {file.type === 'folder' ? (
                  <Folder className="w-6 h-6 text-blue-400" />
                ) : (
                  <File className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-gray-200 font-medium truncate" title={file.name}>{file.name}</div>
                <div className="text-xs text-gray-500">
                  {file.type === 'folder' ? 'Folder' : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pl-4 shrink-0">
              {file.type === 'file' && (
                <button
                  onClick={() => onDownload(file.id)}
                  className="p-2 text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-colors"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => onDelete(file.id, file.type)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                title={`Delete ${file.type}`}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
