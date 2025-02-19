import React from 'react';
import { Bot, User } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fadeIn`}>
      <div className={`shrink-0 p-2 rounded-full ${
        isUser 
          ? 'bg-blue-500' 
          : 'bg-gray-500'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
        isUser 
          ? 'bg-blue-500 text-white' 
          : 'bg-gray-100 text-gray-800'
      }`}>
        <p className="text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}