import { app } from 'electron';

interface QuitState {
  isQuitting?: boolean;
}

function state(): typeof app & QuitState {
  return app as typeof app & QuitState;
}

export function isQuitting(): boolean {
  return state().isQuitting === true;
}

export function markQuitting(): void {
  state().isQuitting = true;
}
