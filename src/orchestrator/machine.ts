// Máquina de estados de un turno de conversación (docs/arquitectura.md, "Estados del orquestador").
// idle → listening → transcribing → resolving → speaking → idle. Una respuesta que pide réplica vuelve a
// listening sin palabra de activación; cualquier error pasa por speaking con un mensaje corto y vuelve a idle.
// No conoce Android: todo efecto entra por Deps, así se prueba con Jest.

export type State = 'idle' | 'listening' | 'transcribing' | 'resolving' | 'speaking';

export type Reply = {say: string; expectReply?: boolean};

export type Deps = {
  /** Convierte el texto del comando en una respuesta (en fase 1, solo la hora). */
  resolve(text: string): Promise<Reply>;
  /** Habla y resuelve al terminar. */
  speak(text: string): Promise<void>;
  /** Muestra la respuesta en la pantalla sobre el bloqueo (ADR-012). */
  show(text: string): void;
  /** Pide al servicio escuchar un comando sin palabra de activación. */
  listenAgain(): void;
  /** Cierra el turno: devuelve el foco de audio (vuelve el volumen de la música). */
  endTurn(): void;
};

export const ERROR_MESSAGE = 'Perdón, algo falló. Inténtalo de nuevo.';
export const NOT_HEARD_MESSAGE = 'No te escuché bien. ¿Puedes repetirlo?';

export class Orchestrator {
  private current: State = 'idle';
  private listeners = new Set<(state: State, detail?: string) => void>();

  constructor(private readonly deps: Deps) {}

  get state(): State {
    return this.current;
  }

  subscribe(listener: (state: State, detail?: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** El servicio detectó "Alfred". Se ignora si ya hay un turno en curso. */
  wake(): void {
    if (this.current === 'idle') this.set('listening');
  }

  /** Terminó el audio del comando; el servicio lo está transcribiendo. */
  captured(): void {
    if (this.current === 'listening') this.set('transcribing');
  }

  /** La activación no trajo comando dentro del plazo. */
  timeout(): void {
    if (this.current === 'listening' || this.current === 'transcribing') this.finish();
  }

  /**
   * Llegó la transcripción del comando. Con "Hola Alfred, ¿qué hora es?" llega sin wake previo,
   * por eso se acepta también desde idle.
   */
  async transcript(text: string): Promise<void> {
    if (this.current === 'resolving' || this.current === 'speaking') return;
    this.set('resolving', text);
    let reply: Reply;
    try {
      reply = text.trim() ? await this.deps.resolve(text) : {say: NOT_HEARD_MESSAGE};
    } catch {
      reply = {say: ERROR_MESSAGE};
    }
    await this.say(reply);
  }

  /** El servicio falló a mitad de turno. */
  async error(): Promise<void> {
    if (this.current === 'speaking') return;
    await this.say({say: ERROR_MESSAGE});
  }

  private async say(reply: Reply): Promise<void> {
    // Respuesta vacía: la acción ya se hizo y no hay nada que decir (por ejemplo, "pausa").
    if (!reply.say) { this.finish(); return; }
    this.set('speaking', reply.say);
    this.deps.show(reply.say);
    try {
      await this.deps.speak(reply.say);
    } catch {
      // Si el TTS falla, la respuesta ya quedó en pantalla; el turno se cierra igual.
    }
    if (reply.expectReply) {
      this.set('listening');
      this.deps.listenAgain();
    } else {
      this.finish();
    }
  }

  private finish(): void {
    this.deps.endTurn();
    this.set('idle');
  }

  private set(state: State, detail?: string): void {
    this.current = state;
    this.listeners.forEach(listener => listener(state, detail));
  }
}
