'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  StopCircle,
  Play,
  Pause,
  Send,
  Bot,
  X,
  ChevronDown,
  Activity,
  Compass,
  Radio,
  Check
} from '@/components/ui/icons';
import {
  trackerApi,
  JarvisChatResult,
  JarvisVoiceStatusData
} from '@/lib/api';
import {
  JarvisVoiceRecorder,
  jarvisVoicePlayer,
  createSpeechRecognizer
} from '@/lib/audio';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCall?: { name: string; arguments: Record<string, any> } | null;
  toolSummary?: string | null;
  audioBlob?: Blob | null;
  timestamp: string;
}

export function JarvisAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<JarvisVoiceStatusData | null>(null);

  // Voice Interaction States: 'idle' | 'listening' | 'processing' | 'speaking'
  const [voiceMode, setVoiceMode] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Chat conversation history
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Greetings, Commander. J.A.R.V.I.S. flight director is initialized. Press the microphone button or type below to query satellite passes, telemetry, or station control.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');

  // Refs
  const recorderRef = useRef<JarvisVoiceRecorder | null>(null);
  const recognizerRef = useRef<{ start: () => void; stop: () => void; isSupported: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentFrequenciesRef = useRef<Uint8Array>(new Uint8Array(64));
  const liveTranscriptRef = useRef('');

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, liveTranscript]);

  // Check health and voice status on mount and periodically
  const checkStatus = useCallback(async () => {
    try {
      const res = await trackerApi.getJarvisStatus();
      setIsOnline(res.online);

      const vStatus = await trackerApi.getJarvisVoiceStatus().catch(() => null);
      if (vStatus) {
        setVoiceStatus(vStatus);
      }
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('jarvis') === 'open' || window.location.hash === '#jarvis') {
        setIsOpen(true);
      }
      const initialQuery = urlParams.get('query');
      if (initialQuery) {
        setIsOpen(true);
        setTimeout(() => {
          dispatchJarvisQuery(initialQuery);
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 15000);
    return () => clearInterval(timer);
  }, [checkStatus]);

  // Real-time canvas audio visualizer loop
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const renderWave = () => {
      animId = requestAnimationFrame(renderWave);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      phase += 0.08;

      if (voiceMode === 'listening' || voiceMode === 'speaking') {
        // Active Waveform reacting to mic frequency or speaking rhythm
        const freqData = currentFrequenciesRef.current;
        const barCount = 32;
        const barWidth = width / barCount;

        for (let i = 0; i < barCount; i++) {
          const rawAmp = (freqData[i % freqData.length] || 0) / 255;
          const dynamicAmp = voiceMode === 'speaking'
            ? Math.max(0.15, Math.sin(phase + i * 0.3) * 0.7)
            : Math.max(0.08, rawAmp * 1.5 + Math.sin(phase + i * 0.2) * 0.1);

          const barHeight = Math.min(height - 4, dynamicAmp * height);
          const x = i * barWidth;
          const y = (height - barHeight) / 2;

          const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
          if (voiceMode === 'listening') {
            gradient.addColorStop(0, '#06b6d4'); // cyan
            gradient.addColorStop(1, '#3b82f6'); // blue
          } else {
            gradient.addColorStop(0, '#10b981'); // emerald
            gradient.addColorStop(1, '#06b6d4'); // cyan
          }

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 2);
          ctx.fill();
        }
      } else if (voiceMode === 'processing') {
        // Glowing orbital pulse during AI reasoning
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const midY = height / 2;
        for (let x = 0; x < width; x++) {
          const y = midY + Math.sin((x / 15) + phase * 2) * 6;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Gentle resting idle line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }
    };

    renderWave();
    return () => cancelAnimationFrame(animId);
  }, [isOpen, voiceMode]);

  // Teardown audio on unmount or modal close
  const cleanupVoiceResources = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cleanup();
      recorderRef.current = null;
    }
    if (recognizerRef.current) {
      recognizerRef.current.stop();
      recognizerRef.current = null;
    }
    jarvisVoicePlayer.stop();
    setVoiceMode('idle');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanupVoiceResources();
    };
  }, [cleanupVoiceResources]);

  // Start microphone recording (Press-to-Talk)
  const handleStartSpeaking = async () => {
    setErrorMessage(null);
    setLiveTranscript('');
    liveTranscriptRef.current = '';

    // Stop any existing assistant speech before operator begins speaking
    jarvisVoicePlayer.stop();

    try {
      const recorder = new JarvisVoiceRecorder();
      recorderRef.current = recorder;

      // Start recording with real-time frequency analysis
      await recorder.start((level, freqs) => {
        setAudioLevel(level);
        currentFrequenciesRef.current = freqs;
      });

      setVoiceMode('listening');

      // Initialize Web Speech API for immediate live text preview if available
      const recognizer = createSpeechRecognizer(
        (interim) => {
          setLiveTranscript(interim);
          liveTranscriptRef.current = interim;
        },
        (final) => {
          setLiveTranscript(final);
          liveTranscriptRef.current = final;
        },
        (err) => {
          // Fall back gracefully to backend audio transcription
          console.log('[JARVIS] Local speech recognition note:', err);
        }
      );

      recognizerRef.current = recognizer;
      if (recognizer.isSupported) {
        recognizer.start();
      }
    } catch (err: any) {
      console.error('[JARVIS] Microphone access error:', err);
      setErrorMessage(
        err.name === 'NotAllowedError' || err.message?.includes('Permission')
          ? 'Microphone permission was denied. Please allow microphone access in your browser settings.'
          : `Microphone unavailable: ${err.message || 'Check audio hardware'}`
      );
      setVoiceMode('idle');
    }
  };

  // Stop recording and process command
  const handleStopSpeaking = async () => {
    if (voiceMode !== 'listening') return;

    setVoiceMode('processing');

    // Stop local recognizer
    if (recognizerRef.current) {
      recognizerRef.current.stop();
    }

    let finalQuery = liveTranscriptRef.current.trim();
    let audioBlob: Blob | null = null;

    // Collect recorded PCM WAV blob
    if (recorderRef.current) {
      try {
        const { blob } = await recorderRef.current.stop();
        audioBlob = blob;

        // If local speech recognition did not capture text, transcribe via OpenJarvis backend
        if (!finalQuery && audioBlob) {
          try {
            const transResult = await trackerApi.transcribeAudio(audioBlob);
            if (transResult.text) {
              finalQuery = transResult.text.trim();
            }
          } catch (tErr: any) {
            console.warn('[JARVIS] Backend transcription error:', tErr);
          }
        }
      } catch (recErr) {
        console.error('[JARVIS] Recording stop error:', recErr);
      }
    }

    recorderRef.current = null;
    recognizerRef.current = null;

    if (!finalQuery) {
      setErrorMessage('No intelligible speech detected. Please speak clearly into your microphone.');
      setVoiceMode('idle');
      return;
    }

    // Process recognized query through JARVIS
    await dispatchJarvisQuery(finalQuery, audioBlob);
  };

  // Dispatch message to JARVIS, retrieve response & play voice audio
  const dispatchJarvisQuery = async (queryText: string, userAudioBlob?: Blob | null) => {
    setVoiceMode('processing');
    setErrorMessage(null);

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      audioBlob: userAudioBlob,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';

    try {
      // 1. Send query to NAVIC-TRACK backend -> OpenJarvis ReAct flight director
      const chatRes: JarvisChatResult = await trackerApi.sendJarvisMessage(queryText);

      const assistantMsgId = `asst-${Date.now()}`;
      const assistantMsg: ChatMessageItem = {
        id: assistantMsgId,
        role: 'assistant',
        content: chatRes.reply,
        toolCall: chatRes.toolCall,
        toolSummary: chatRes.toolSummary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // 2. Synthesize speech and play audio response aloud
      if (!isMuted) {
        setVoiceMode('speaking');

        try {
          const ttsBlob = await trackerApi.synthesizeSpeech(chatRes.reply);
          jarvisVoicePlayer.play(
            ttsBlob,
            () => setVoiceMode('speaking'),
            () => setVoiceMode('idle'),
            (err) => {
              console.warn('[JARVIS] Audio element playback error, trying browser fallback:', err);
              // Fallback to browser Web SpeechSynthesis
              jarvisVoicePlayer.speakWithBrowser(
                chatRes.reply,
                () => setVoiceMode('speaking'),
                () => setVoiceMode('idle')
              );
            }
          );
        } catch (synthErr) {
          console.warn('[JARVIS] Speech synthesis service warning, using browser voice fallback:', synthErr);
          jarvisVoicePlayer.speakWithBrowser(
            chatRes.reply,
            () => setVoiceMode('speaking'),
            () => setVoiceMode('idle')
          );
        }
      } else {
        setVoiceMode('idle');
      }
    } catch (err: any) {
      console.error('[JARVIS] Query dispatch failed:', err);
      setErrorMessage(`Communication error: ${err.message || 'Could not reach JARVIS service'}`);
      setVoiceMode('idle');
    }
  };

  // Text input submit handler
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || voiceMode === 'processing' || voiceMode === 'listening') return;
    dispatchJarvisQuery(inputText.trim());
  };

  // Interrupt assistant voice playback
  const handleInterruptPlayback = () => {
    jarvisVoicePlayer.stop();
    setVoiceMode('idle');
  };

  // Toggle mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    jarvisVoicePlayer.setMuted(nextMuted);
  };

  return (
    <>
      {/* Floating Launch Button (FAB) */}
      {!isOpen && (
        <aside
          aria-label="JARVIS AI Assistant"
          className="fixed bottom-6 right-6 z-50 flex items-center"
        >
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open JARVIS AI Voice Assistant"
            className="group relative flex items-center gap-2.5 px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-900 border border-sky-200 shadow-xl shadow-sky-500/10 backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            {/* Status indicator pulse dot */}
            <span className="relative flex h-3 w-3">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isOnline ? 'bg-sky-400' : 'bg-slate-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${
                  isOnline ? 'bg-sky-500' : 'bg-slate-500'
                }`}
              />
            </span>

            <div className="flex items-center gap-1.5 font-bold text-sm tracking-wide text-slate-900">
              <Sparkles className="w-4 h-4 text-sky-500 group-hover:rotate-12 transition-transform" />
              <span>JARVIS</span>
            </div>

            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 font-semibold hidden sm:inline-block">
              Voice Active
            </span>
          </button>
        </aside>
      )}

      {/* Floating JARVIS Interactive HUD Drawer */}
      {isOpen && (
        <aside
          aria-label="JARVIS AI Assistant Interface"
          className="fixed bottom-4 right-4 z-50 w-[95vw] sm:w-[440px] max-h-[92vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-300"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-600">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm tracking-wide text-slate-900">J.A.R.V.I.S.</h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold border ${
                      isOnline
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Autonomous Ground Flight Director</p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-500">
              {/* Audio Mute toggle */}
              <button
                onClick={handleToggleMute}
                title={isMuted ? 'Unmute Assistant' : 'Mute Assistant'}
                className="p-1.5 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-amber-600" /> : <Volume2 className="w-4 h-4 text-slate-600" />}
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Collapse'}
                className="p-1.5 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isMinimized ? 'rotate-180' : ''}`} />
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  cleanupVoiceResources();
                  setIsOpen(false);
                }}
                title="Close JARVIS"
                className="p-1.5 rounded-lg hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Offline Warning Notice */}
              {isOnline === false && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between">
                  <span>OpenJarvis service is currently offline.</span>
                  <button
                    onClick={checkStatus}
                    className="underline text-amber-900 hover:text-amber-950 font-bold cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Chat Message Scroll Window */}
              <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[300px] min-h-[180px] text-xs bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-sky-500 text-white rounded-br-none'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Tool Summary Card */}
                      {msg.toolSummary && (
                        <div className="mt-2 p-2 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
                          <div className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider text-sky-700 mb-0.5">
                            <Activity className="w-3 h-3" />
                            <span>Executed: {msg.toolCall?.name}</span>
                          </div>
                          <div>{msg.toolSummary}</div>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                  </div>
                ))}

                {/* Live Speech Recognition Transcription Preview */}
                {voiceMode === 'listening' && (
                  <div className="flex flex-col items-end animate-pulse">
                    <div className="max-w-[85%] rounded-2xl rounded-br-none px-3.5 py-2.5 bg-sky-50 border border-sky-300 text-sky-800">
                      <p className="italic">
                        {liveTranscript || 'Listening... speak your command'}
                      </p>
                    </div>
                    <span className="text-[10px] text-sky-600 font-semibold mt-1 px-1">Transcribing speech...</span>
                  </div>
                )}

                {/* Processing State Indicator */}
                {voiceMode === 'processing' && (
                  <div className="flex items-center gap-2 text-sky-600 text-xs py-2 px-1 font-semibold">
                    <Sparkles className="w-4 h-4 animate-spin text-sky-500" />
                    <span>JARVIS is calculating orbital telemetry...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Real-time Audio Waveform Visualizer Canvas */}
              <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={28}
                  className="w-full h-7 rounded-lg bg-white border border-slate-200"
                />
              </div>

              {/* Error Alert Display */}
              {errorMessage && (
                <div className="mx-3 my-1 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-bold ml-2">
                    &times;
                  </button>
                </div>
              )}

              {/* Voice Interaction & Controls Center */}
              <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2.5">
                {/* Large Voice Action Controls */}
                <div className="flex items-center justify-between gap-3">
                  {/* Interrupt / Stop Speaking button */}
                  {voiceMode === 'speaking' ? (
                    <button
                      onClick={handleInterruptPlayback}
                      className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>Stop Speaking</span>
                    </button>
                  ) : (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">
                        {voiceMode === 'listening' ? 'Speaking...' : voiceMode === 'processing' ? 'Thinking...' : 'Press Mic to Speak'}
                      </span>
                    </div>
                  )}

                  {/* Main Animated Microphone Button */}
                  <div className="relative flex items-center justify-center">
                    {/* Pulsing halo rings when listening */}
                    {voiceMode === 'listening' && (
                      <>
                        <span className="animate-ping absolute inline-flex h-16 w-16 rounded-full bg-sky-400 opacity-30" />
                        <span className="animate-pulse absolute inline-flex h-14 w-14 rounded-full bg-sky-500 opacity-40" />
                      </>
                    )}

                    {voiceMode === 'listening' ? (
                      <button
                        onClick={handleStopSpeaking}
                        title="Finish Speaking"
                        className="relative z-10 w-13 h-13 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 hover:bg-sky-600 transition-all scale-105 cursor-pointer"
                      >
                        <Check className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    ) : (
                      <button
                        onClick={handleStartSpeaking}
                        disabled={voiceMode === 'processing'}
                        title="Click to speak with JARVIS"
                        className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all duration-200 cursor-pointer ${
                          voiceMode === 'processing'
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-sky-500 text-white hover:bg-sky-600 hover:scale-105 active:scale-95 shadow-sky-500/25'
                        }`}
                      >
                        <Mic className="w-5 h-5 stroke-[2.5]" />
                      </button>
                    )}
                  </div>

                  {/* Mute toggle button */}
                  <button
                    onClick={handleToggleMute}
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isMuted
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-slate-600" />}
                    <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Voice'}</span>
                  </button>
                </div>

                {/* Quick Voice Prompt Shortcuts */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                  <button
                    onClick={() => dispatchJarvisQuery('Where is NavIC-1B right now?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors cursor-pointer font-medium"
                  >
                    🛰️ NavIC-1B Position
                  </button>
                  <button
                    onClick={() => dispatchJarvisQuery('When is the next ISS pass?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors cursor-pointer font-medium"
                  >
                    ⏰ Next ISS Pass
                  </button>
                  <button
                    onClick={() => dispatchJarvisQuery('What is our station weather?')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors cursor-pointer font-medium"
                  >
                    ⛅ Station Weather
                  </button>
                  <button
                    onClick={() => dispatchJarvisQuery('Check tracker hardware status')}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 transition-colors cursor-pointer font-medium"
                  >
                    🔧 Hardware Status
                  </button>
                </div>

                {/* Text Input Box Alternative */}
                <form onSubmit={handleTextSubmit} className="relative flex items-center mt-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a command or ask a question..."
                    disabled={voiceMode === 'listening' || voiceMode === 'processing'}
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors shadow-2xs"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || voiceMode === 'listening' || voiceMode === 'processing'}
                    className="absolute right-1.5 p-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500 transition-colors cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>
      )}
    </>
  );
}
