"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom for the webkit prefix).
type SRAlternative = { transcript: string };
type SRResult = { 0: SRAlternative; isFinal: boolean; length: number };
type SRResultList = { length: number; [i: number]: SRResult };
type SREvent = { resultIndex: number; results: SRResultList };
type SRErrorEvent = { error?: string };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SRConstructor = new () => SpeechRecognitionLike;

/**
 * Wispr-Flow-style continuous dictation.
 *
 * Streams an interim transcript as you speak, keeps listening through pauses
 * (auto-restarts recognition), and exposes a live mic `level` (0–1) for a
 * reactive waveform. `supported` is false where the Web Speech API is absent
 * (e.g. Firefox) so callers can fall back to text input.
 */
export function useSpeechRecognition(lang = "en-US") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const wantRef = useRef(false); // user intends to keep dictating
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardownAudio = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SRConstructor;
      webkitSpeechRecognition?: SRConstructor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript((finalRef.current + interim).replace(/\s+/g, " ").trimStart());
    };

    rec.onerror = (e) => {
      const err = e?.error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        wantRef.current = false;
        setError("Microphone is blocked. Allow mic access in your browser to dictate.");
      } else if (err === "audio-capture") {
        wantRef.current = false;
        setError("No microphone found.");
      } else if (err && err !== "no-speech" && err !== "aborted") {
        setError("Voice input hit a snag — you can keep typing.");
      }
    };

    // Keep dictation alive through natural pauses until the user stops.
    // Restart on a short debounce — calling start() synchronously inside onend
    // throws on Chrome ("already started"), and a hard error would hot-loop.
    rec.onend = () => {
      if (restartRef.current) clearTimeout(restartRef.current);
      if (!wantRef.current) {
        setListening(false);
        teardownAudio();
        return;
      }
      restartRef.current = setTimeout(() => {
        if (!wantRef.current) return;
        try {
          rec.start();
        } catch {
          wantRef.current = false;
          setListening(false);
          teardownAudio();
        }
      }, 300);
    };

    recRef.current = rec;
    return () => {
      wantRef.current = false;
      if (restartRef.current) clearTimeout(restartRef.current);
      try {
        rec.abort();
      } catch {
        /* no-op */
      }
      teardownAudio();
    };
  }, [lang, teardownAudio]);

  const start = useCallback(async () => {
    const rec = recRef.current;
    if (!rec) return;
    setError(null);
    setTranscript("");
    finalRef.current = "";

    // Pre-flight the mic so permission prompts + denials are handled clearly,
    // and set up a live audio-level meter for the waveform.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          ctxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const data = new Uint8Array(analyser.fftSize);
          const tick = () => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            setLevel((prev) => prev * 0.55 + Math.min(1, rms * 3.2) * 0.45);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      } catch {
        setError("Microphone is blocked. Allow mic access in your browser to dictate.");
        teardownAudio();
        return;
      }
    }

    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already running */
    }
  }, [teardownAudio]);

  const stop = useCallback(() => {
    wantRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
    teardownAudio();
  }, [teardownAudio]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
  }, []);

  return { supported, listening, transcript, level, error, start, stop, reset };
}

/** Speak text aloud via the browser's SpeechSynthesis (best-effort). */
export function speak(text: string, lang = "en-US") {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1.03;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* unsupported */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* no-op */
  }
}
