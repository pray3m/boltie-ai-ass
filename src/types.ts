export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantConfig {
  openAIKey: string;
  elevenLabsKey: string;
}