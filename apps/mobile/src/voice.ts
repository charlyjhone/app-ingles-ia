/**
 * Voz do app: ouvir o aluno (fala → texto) e falar a resposta do tutor (texto → fala).
 *
 * Fase 1 (atual): usa os recursos do próprio navegador/celular — sem custo e sem chave extra.
 *  - Ouvir: Web Speech API (Chrome, Edge, Safari). No app nativo entra numa próxima etapa.
 *  - Falar: expo-speech (voz do sistema, em inglês) — funciona no navegador, iPhone e Android.
 * Fase 2 (futura): trocar "ouvir" por um serviço no servidor com nota de pronúncia,
 * mantendo esta mesma interface — nenhuma tela precisa mudar.
 */
import { Platform } from "react-native";
import * as Speech from "expo-speech";

/** Segundos de fala, no formato aceito pelo servidor (inteiro entre 0 e 600). */
export function toSpokenSeconds(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.min(600, Math.max(1, Math.round(ms / 1000)));
}

/* ---------------- Falar (tutor → aluno) ---------------- */

export function speak(text: string, opts: { kids?: boolean } = {}) {
  Speech.stop();
  Speech.speak(text, { language: "en-US", rate: opts.kids ? 0.85 : 0.95, pitch: opts.kids ? 1.15 : 1.0 });
}

export function stopSpeaking() {
  Speech.stop();
}

/* ---------------- Ouvir (aluno → tutor) ---------------- */

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function getRecognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return getRecognitionCtor() !== null;
}

export interface ListenResult {
  text: string;
  spokenSeconds: number;
}

export interface ListenSession {
  /** Termina de ouvir e devolve o que foi entendido. */
  stop(): void;
  /** Cancela sem enviar nada. */
  cancel(): void;
  done: Promise<ListenResult>;
}

/** Mensagens de erro em português para o aluno. */
export function friendlyListenError(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Permita o uso do microfone no navegador para falar com o tutor.";
    case "no-speech":
      return "Não ouvi nada. Toque no microfone e fale em inglês.";
    case "audio-capture":
      return "Nenhum microfone encontrado.";
    case "network":
      return "Sem conexão para reconhecer a fala. Tente de novo.";
    default:
      return "Não consegui entender. Tente de novo ou digite.";
  }
}

export function listen(onPartial?: (text: string) => void): ListenSession {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    return {
      stop() {},
      cancel() {},
      done: Promise.reject(new Error("unsupported")),
    };
  }

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  const startedAt = Date.now();
  let finalText = "";
  let partialText = "";
  let cancelled = false;

  const done = new Promise<ListenResult>((resolve, reject) => {
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += t;
        else interim += t;
      }
      partialText = (finalText + " " + interim).trim();
      onPartial?.(partialText);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      reject(new Error(e.error));
    };
    rec.onend = () => {
      if (cancelled) return reject(new Error("aborted"));
      const text = (finalText || partialText).trim();
      if (!text) return reject(new Error("no-speech"));
      resolve({ text, spokenSeconds: toSpokenSeconds(Date.now() - startedAt) });
    };
  });

  rec.start();
  return {
    stop: () => rec.stop(),
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
    done,
  };
}
