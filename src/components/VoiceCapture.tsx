'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceCaptureProps {
  onCapture: (input: { audioBase64: string; mimeType: string }) => void;
}

export default function VoiceCapture({ onCapture }: VoiceCaptureProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        onCapture({ audioBase64: base64, mimeType: 'audio/webm' });
        setProcessing(false);
      };

      recorderRef.current = recorder;
      recorder.start(100);
      setRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function toggle() {
    if (recording) stopRecording();
    else startRecording();
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={toggle}
        disabled={processing}
        whileTap={{ scale: 0.92 }}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
          recording
            ? 'bg-red-500/20 text-red-400'
            : 'bg-white/6 hover:bg-white/10 text-white/50 hover:text-white/80'
        } disabled:opacity-40`}
        aria-label={recording ? 'Stop recording' : 'Start voice capture'}
      >
        {recording ? (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1 16.93V20H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07A7.001 7.001 0 0 0 19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7.001 7.001 0 0 0 6 6.93z" />
          </svg>
        )}
        {recording && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse-ring" />
        )}
      </motion.button>

      <AnimatePresence>
        {processing && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40 whitespace-nowrap"
          >
            Processing…
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
