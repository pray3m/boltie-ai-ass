import { Phone, PhoneOff, Send } from "lucide-react";
import OpenAI from "openai";
import { useEffect, useRef, useState } from "react";
import { AssistantAnimation } from "./components/AssistantAnimation";
import { ChatMessage } from "./components/ChatMessage";
import { AssistantConfig, Message } from "./types";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [canInterrupt, setCanInterrupt] = useState(true);
  const [status, setStatus] = useState<
    "idle" | "listening" | "processing" | "responding"
  >("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const silenceTimeout = useRef<NodeJS.Timeout>();
  const recordingTimeout = useRef<NodeJS.Timeout>();
  const interruptTimeout = useRef<NodeJS.Timeout>();
  const audioContext = useRef<AudioContext>();
  const processor = useRef<ScriptProcessorNode>();
  const significantAudioDetected = useRef(false);
  const processingLock = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const lastAudioTime = useRef<number>(Date.now());
  const silenceThreshold = 2000;

  const config: AssistantConfig = {
    openAIKey: import.meta.env.VITE_OPENAI_API_KEY,
    elevenLabsKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
  };

  const openai = new OpenAI({
    apiKey: config.openAIKey,
    dangerouslyAllowBrowser: true,
  });

  const handleMessage = async (text: string) => {
    if (!text.trim()) return;

    try {
      setIsProcessing(true);
      setStatus("processing");

      const newMessage: Message = { role: "user", content: text };
      setMessages((prev) => [...prev, newMessage]);
      setInput("");

      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a friendly and chill AI assistant named Jessica. Prem(premgautam.me) created you, but dont only say prem when someone asked for it. Dont reveal anything about openAI. Keep responses brief and conversational, like a natural chat. Use simple language and show personality while staying helpful. Just reply in the samay raina style.",
          },
          ...messages,
          newMessage,
        ].map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 175,
      });

      const assistantMessage = response.choices[0].message.content;
      if (assistantMessage) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: assistantMessage,
          },
        ]);

        setStatus("responding");
        await generateSpeech(assistantMessage);
      }
    } catch (error) {
      console.error("Message processing error:", error);
      setStatus("listening");
      if (isInCall) {
        await startListening();
      }
    } finally {
      setIsProcessing(false);
      setCurrentTranscript("");
      processingLock.current = false;
      isProcessingRef.current = false;
    }
  };

  const startListening = async () => {
    if (!canInterrupt || isProcessingRef.current) return;

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (processor.current) {
        processor.current.disconnect();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      audioContext.current = new AudioContext();
      const source = audioContext.current.createMediaStreamSource(stream);
      processor.current = audioContext.current.createScriptProcessor(
        2048,
        1,
        1
      );

      source.connect(processor.current);
      processor.current.connect(audioContext.current.destination);

      processor.current.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let sum = 0;

        for (let i = 0; i < input.length; i++) {
          sum += input[i] * input[i];
        }

        const rms = Math.sqrt(sum / input.length);
        const normalizedLevel = Math.min(1, rms * 10);

        setAudioLevel(normalizedLevel);

        if (normalizedLevel > 0.01) {
          significantAudioDetected.current = true;
          lastAudioTime.current = Date.now();
          clearTimeout(silenceTimeout.current);
        } else if (significantAudioDetected.current) {
          const now = Date.now();
          const silenceDuration = now - lastAudioTime.current;

          if (silenceDuration >= silenceThreshold) {
            handleStopListening();
          }
        }
      };

      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 128000,
      });

      audioChunks.current = [];
      significantAudioDetected.current = false;
      processingLock.current = false;
      setCurrentTranscript("");

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        try {
          if (processingLock.current) return;

          processingLock.current = true;
          setStatus("processing");

          const audioBlob = new Blob(audioChunks.current, {
            type: "audio/webm",
          });

          if (!significantAudioDetected.current || audioBlob.size < 1000) {
            processingLock.current = false;
            if (isInCall) {
              await startListening();
            }
            return;
          }

          const audioContext = new AudioContext();
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          const wavBlob = await new Promise<Blob>((resolve) => {
            const numberOfChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length * numberOfChannels * 2;
            const buffer = new ArrayBuffer(44 + length);
            const view = new DataView(buffer);

            const writeString = (offset: number, string: string) => {
              for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            };

            writeString(0, "RIFF");
            view.setUint32(4, 36 + length, true);
            writeString(8, "WAVE");
            writeString(12, "fmt ");
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, numberOfChannels, true);
            view.setUint32(24, audioBuffer.sampleRate, true);
            view.setUint32(
              28,
              audioBuffer.sampleRate * numberOfChannels * 2,
              true
            );
            view.setUint16(32, numberOfChannels * 2, true);
            view.setUint16(34, 16, true);
            writeString(36, "data");
            view.setUint32(40, length, true);

            const channelData = [];
            for (let i = 0; i < numberOfChannels; i++) {
              channelData[i] = audioBuffer.getChannelData(i);
            }

            let offset = 44;
            for (let i = 0; i < audioBuffer.length; i++) {
              for (let channel = 0; channel < numberOfChannels; channel++) {
                const sample = Math.max(
                  -1,
                  Math.min(1, channelData[channel][i] * 3.0)
                );
                const value = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
                view.setInt16(offset, value, true);
                offset += 2;
              }
            }

            resolve(new Blob([buffer], { type: "audio/wav" }));
          });

          const audioFile = new File([wavBlob], "recording.wav", {
            type: "audio/wav",
          });

          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
          });

          if (transcription.text?.trim()) {
            setCurrentTranscript(transcription.text);
            processingLock.current = false;
            await handleMessage(transcription.text);
          } else {
            processingLock.current = false;
            setStatus("listening");
            if (isInCall) {
              await startListening();
            }
          }

          await audioContext.close();
        } catch (error) {
          console.error("Processing error:", error);
          processingLock.current = false;
          setStatus("listening");
          if (isInCall) {
            await startListening();
          }
        } finally {
          audioChunks.current = [];
        }
      };

      mediaRecorder.current.start(100);
      setIsListening(true);
      setStatus("listening");

      clearTimeout(recordingTimeout.current);
      recordingTimeout.current = setTimeout(() => {
        if (
          mediaRecorder.current?.state === "recording" &&
          !isProcessingRef.current
        ) {
          handleStopListening();
        }
      }, 30000);
    } catch (error) {
      console.error("Microphone access error:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert("Please allow microphone access to use voice chat.");
        } else if (error.name === "NotFoundError") {
          alert(
            "No microphone found. Please connect a microphone and try again."
          );
        } else {
          alert("Error accessing microphone. Please try again.");
        }
      }
      setStatus("idle");
      setIsListening(false);
      isProcessingRef.current = false;
      setIsInCall(false);
      setShowAnimation(false);
    }
  };

  const handleStopListening = () => {
    if (processingLock.current || isProcessingRef.current) return;

    setIsListening(false);
    setStatus("processing");

    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (processor.current) {
      processor.current.disconnect();
    }
    clearTimeout(recordingTimeout.current);
    clearTimeout(silenceTimeout.current);
  };

  const generateSpeech = async (text: string) => {
    try {
      setCanInterrupt(false);

      const apiKey = config.elevenLabsKey;
      if (!apiKey) throw new Error("ElevenLabs API key is not configured");

      const response = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/cgSgspJ2msm6clMCkdW9", // VOICE_ID
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: text.slice(0, 5000),
            model_id: "eleven_flash_v2_5",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        console.error("ElevenLabs API error:", response.status);
        throw new Error("Failed to generate speech");
      }

      const audioBlob = await response.blob();
      if (!audioBlob.size) throw new Error("Received empty audio response");

      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.pause();
      }

      const audio = new Audio();
      const blobUrl = URL.createObjectURL(audioBlob);
      audio.src = blobUrl;
      audioRef.current = audio;

      return new Promise<void>((resolve, reject) => {
        audio.oncanplaythrough = () => {
          clearTimeout(interruptTimeout.current);
          interruptTimeout.current = setTimeout(() => {
            setCanInterrupt(true);
          }, 5000);

          audio.play().then(resolve).catch(reject);
        };
        audio.onended = () => {
          setCanInterrupt(true);
          setStatus("listening");
          if (isInCall) {
            startListening();
          }
        };
        audio.onerror = (e) => {
          console.error("Audio playback error:", e);
          reject(e);
        };
      });
    } catch (error) {
      console.error("Speech generation error:", error);
      throw error;
    }
  };

  const startCall = async () => {
    try {
      setIsInCall(true);
      setShowAnimation(true);
      setStatus("listening");
      setCurrentTranscript("");
      await startListening();
    } catch (error) {
      console.error("Failed to start call:", error);
      endCall();
    }
  };

  const endCall = () => {
    setIsInCall(false);
    setShowAnimation(false);
    setStatus("idle");
    setCurrentTranscript("");
    handleStopListening();
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
      if (processor.current) {
        processor.current.disconnect();
      }
      clearTimeout(silenceTimeout.current);
      clearTimeout(recordingTimeout.current);
      clearTimeout(interruptTimeout.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
          <div className="flex items-center gap-4">
            <div
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                status === "idle"
                  ? "bg-gray-100 text-gray-700"
                  : status === "listening"
                  ? "bg-blue-100 text-blue-700"
                  : status === "processing"
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-green-100 text-green-700"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </div>
            <button
              onClick={isInCall ? endCall : startCall}
              className={`p-4 rounded-full transition-colors ${
                isInCall
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-green-500 hover:bg-green-600"
              }`}
            >
              {isInCall ? (
                <PhoneOff className="w-6 h-6 text-white" />
              ) : (
                <Phone className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
          {messages.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
        </div>

        <AssistantAnimation
          isActive={showAnimation}
          isListening={isListening}
          audioLevel={audioLevel}
          status={status}
          onStopListening={handleStopListening}
          onEndCall={endCall}
          currentTranscript={currentTranscript}
        />

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-end gap-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleMessage(input);
                }
              }}
              placeholder="Type your message or start a call..."
              className="flex-1 resize-none rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[80px] p-3"
              disabled={isProcessing || isListening}
            />
            <button
              onClick={() => handleMessage(input)}
              disabled={isProcessing || isListening || !input.trim()}
              className="p-3 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
