import React, { useEffect, useRef } from 'react';
import { Square, PhoneOff, Mic, Brain, Speaker } from 'lucide-react';

interface AssistantAnimationProps {
  isActive: boolean;
  isListening: boolean;
  audioLevel?: number;
  status: 'idle' | 'listening' | 'processing' | 'responding';
  onStopListening: () => void;
  onEndCall: () => void;
  currentTranscript?: string;
}

export function AssistantAnimation({ 
  isActive, 
  isListening, 
  audioLevel = 0,
  status,
  onStopListening,
  onEndCall,
  currentTranscript = ''
}: AssistantAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveforms = useRef<number[]>(Array(64).fill(0));
  const animationFrameId = useRef<number>();
  
  useEffect(() => {
    if (!isListening || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      waveforms.current = waveforms.current.map((_, index) => {
        const baseHeight = audioLevel * 0.8;
        const variance = Math.sin((Date.now() / 150) + index * 0.2) * 0.2;
        return Math.min(1, Math.max(0.1, baseHeight + variance));
      });

      const barWidth = canvas.width / waveforms.current.length;
      const centerY = canvas.height / 2;

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      waveforms.current.forEach((height, index) => {
        const x = index * barWidth;
        const amplitude = height * (canvas.height / 3);
        
        ctx.fillStyle = `hsla(${200 + height * 40}, 70%, 60%, 0.8)`;
        ctx.fillRect(x, centerY - amplitude, barWidth - 1, amplitude);
        
        ctx.fillStyle = `hsla(${200 + height * 40}, 70%, 60%, 0.4)`;
        ctx.fillRect(x, centerY, barWidth - 1, amplitude);
      });

      ctx.stroke();
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isListening, audioLevel]);

  const getStatusIcon = () => {
    switch (status) {
      case 'listening':
        return <Mic className="w-8 h-8 text-white animate-pulse" />;
      case 'processing':
        return <Brain className="w-8 h-8 text-white animate-spin" />;
      case 'responding':
        return <Speaker className="w-8 h-8 text-white animate-bounce" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'listening':
        return "I'm listening...";
      case 'processing':
        return "Processing your message...";
      case 'responding':
        return "Speaking response...";
      default:
        return "Ready to chat";
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'listening':
        return "Speak clearly into your microphone";
      case 'processing':
        return "Converting speech to text and thinking about response";
      case 'responding':
        return "Playing AI response through speakers";
      default:
        return "Click the phone icon to start";
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'listening':
        return 'from-blue-600 to-blue-400';
      case 'processing':
        return 'from-yellow-500 to-yellow-400';
      case 'responding':
        return 'from-green-500 to-green-400';
      default:
        return 'from-gray-500 to-gray-400';
    }
  };

  return (
    <div className={`fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300 ${
      isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="relative max-w-2xl w-full mx-4">
        {/* Status Card */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon()}
              <div>
                <h3 className="text-lg font-semibold">{getStatusText()}</h3>
                <p className="text-sm text-gray-600">{getStatusDescription()}</p>
              </div>
            </div>
            {status === 'listening' && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-75"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main Circle */}
        <div className="relative">
          <div className={`absolute inset-0 rounded-full bg-blue-500/20 blur-xl transform scale-150 ${
            status === 'listening' ? 'animate-pulse' : ''
          }`} />
          
          <div className={`relative w-64 h-64 bg-gradient-to-br ${getStatusColor()} 
            rounded-full shadow-xl flex items-center justify-center transition-colors duration-300 overflow-hidden`}>
            <div className="absolute inset-2 bg-black/10 rounded-full" />
            
            <canvas
              ref={canvasRef}
              width={256}
              height={128}
              className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
                status === 'listening' ? 'opacity-80' : 'opacity-0'
              }`}
            />
          </div>

          {/* Control Buttons */}
          <div className="absolute -bottom-20 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
            {isListening && (
              <button
                onClick={onStopListening}
                className="p-4 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors shadow-lg"
                title="Stop listening"
              >
                <Square className="w-6 h-6 text-white" />
              </button>
            )}
            <button
              onClick={onEndCall}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
              title="End call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
        
        {/* Transcription Display */}
        {currentTranscript && (
          <div className="absolute -bottom-48 left-1/2 -translate-x-1/2 w-full max-w-md">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-xl">
              <p className="text-sm font-medium text-gray-600 mb-1">Transcription</p>
              <p className="text-lg text-gray-800">{currentTranscript}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}