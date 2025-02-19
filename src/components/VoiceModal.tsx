import React from 'react';
import { X } from 'lucide-react';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  children: React.ReactNode;
}

export function VoiceModal({ isOpen, onClose, isRecording, children }: VoiceModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Voice Recording</h2>
          <div className={`w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isRecording ? 'bg-red-100 animate-pulse' : 'bg-gray-100'
          }`}>
            <div className={`w-24 h-24 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'
            }`} />
          </div>
          <p className="text-lg text-gray-700 mb-4">
            {isRecording ? 'Listening...' : 'Ready to record'}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}