import React, { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { VoiceModal } from './VoiceModal';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
}

export function VoiceRecorder({ onRecordingComplete }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        onRecordingComplete(audioBlob);
        setIsModalOpen(false);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <>
      <button
        onClick={startRecording}
        className={`p-3 rounded-full transition-colors ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        <Mic className="w-6 h-6 text-white" />
      </button>

      <VoiceModal
        isOpen={isModalOpen}
        onClose={stopRecording}
        isRecording={isRecording}
      >
        <button
          onClick={stopRecording}
          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold"
        >
          Stop Recording
        </button>
      </VoiceModal>
    </>
  );
}