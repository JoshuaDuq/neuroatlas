import type { CircuitCatalog } from './catalog.ts';

export interface CircuitSessionState {
  circuit: string | null;
  step: number;
  visited: number[];
}

/** Learning progress is independent of free anatomical exploration. `visited` lists the landmarks seen, in order. */
export function createCircuitSession(catalog: Pick<CircuitCatalog, 'get'>) {
  let state: CircuitSessionState = { circuit: null, step: 0, visited: [] };
  return {
    snapshot: (): CircuitSessionState => ({ ...state, visited: [...state.visited] }),
    start(id: string) {
      catalog.get(id);
      state = { circuit: id, step: 0, visited: [0] };
    },
    close() {
      state = { circuit: null, step: 0, visited: [] };
    },
    go(step: number) {
      const circuit = catalog.get(state.circuit!);
      if (!Number.isInteger(step) || step < 0 || step >= circuit.steps.length) {
        throw new RangeError(`Invalid landmark index: ${step}`);
      }
      state = {
        ...state,
        step,
        visited: state.visited.includes(step) ? state.visited : [...state.visited, step],
      };
    },
  };
}
