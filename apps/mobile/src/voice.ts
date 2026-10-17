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

/** Velocidade da voz: mais devagar para crianças e para quem está começando. */
export function speechRate(opts: { kids?: boolean; level?: string }): number {
  if (opts.kids) return 0.85;
  if (opts.level === "beginner") return 0.85;
  if (opts.level === "advanced") return 1.0;
  return 0.95;
}

export interface SpeakOptions {
  kids?: boolean;
  level?: string;
  /** áudio de voz natural vindo do servidor (preferido quando existe) */
  audio?: { mime: string; base64: string } | null;
}

interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

/**
 * Entre as vozes instaladas no aparelho, escolhe a que soa mais humana.
 * As vozes "Natural/Neural/Premium/Enhanced" e as do Google são bem melhores
 * que a voz padrão do sistema (que é a "robótica").
 */
export function pickBestVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const english = voices.filter((v) => /^en[-_]/i.test(v.lang) || v.lang.toLowerCase() === "en");
  if (!english.length) return null;
  const score = (v: V) => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/natural|neural/.test(n)) s += 100;
    if (/premium|enhanced/.test(n)) s += 80;
    if (/google/.test(n)) s += 60;
    if (/(aria|jenny|ava|emma|samantha|allison|joanna|guy|andrew|brian)/.test(n)) s += 30;
    if (/^en[-_]us/i.test(v.lang)) s += 20;
    if (/(compact|espeak|novelty|whisper|zarvox|bells|bad news|trinoids|albert|jester|organ|cellos|bubbles|boing)/.test(n)) s -= 200;
    return s;
  };
  return [...english].sort((a, b) => score(b) - score(a))[0] ?? null;
}

let currentAudio: { pause(): void } | null = null;

function webSynth(): SpeechSynthesis | null {
  if (Platform.OS !== "web" || typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

/** Fala o texto: voz natural do servidor se houver; senão, a melhor voz do aparelho. */
export function speak(text: string, opts: SpeakOptions = {}) {
  stopSpeaking();
  if (opts.audio && Platform.OS === "web" && typeof Audio !== "undefined") {
    const el = new Audio(`data:${opts.audio.mime};base64,${opts.audio.base64}`);
    currentAudio = el;
    el.play().catch(() => {
      // Navegador bloqueou o som automático: usa a voz do aparelho.
      if (currentAudio === el) speakWithDevice(text, opts);
    });
    return;
  }
  speakWithDevice(text, opts);
}

function speakWithDevice(text: string, opts: SpeakOptions) {
  const synth = webSynth();
  if (synth) {
    const u = new SpeechSynthesisUtterance(text);
    const best = pickBestVoice(synth.getVoices());
    if (best) u.voice = best;
    u.lang = best?.lang ?? "en-US";
    u.rate = speechRate(opts);
    u.pitch = opts.kids ? 1.1 : 1.0;
    synth.speak(u);
    return;
  }
  Speech.speak(text, { language: "en-US", rate: speechRate(opts), pitch: opts.kids ? 1.1 : 1.0 });
}

export function stopSpeaking() {
  currentAudio?.pause();
  currentAudio = null;
  webSynth()?.cancel();
  Speech.stop();
}

// Algumas vozes só aparecem depois do primeiro carregamento: pede a lista cedo.
webSynth()?.getVoices();

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
