/** Learning progress is independent of free anatomical exploration. `visited` lists the landmarks seen, in order. */
export function createCircuitSession(catalog) {
  let state = { circuit: null, step: 0, visited: [] };
  return {
    snapshot: () => ({ ...state, visited: [...state.visited] }),
    start(id) {
      catalog.get(id);
      state = { circuit: id, step: 0, visited: [0] };
    },
    go(step) {
      const circuit = catalog.get(state.circuit);
      if (!Number.isInteger(step) || step < 0 || step >= circuit.steps.length) {
        throw new RangeError(`Invalid landmark index: ${step}`);
      }
      state = { ...state, step, visited: state.visited.includes(step) ? state.visited : [...state.visited, step] };
    },
  };
}
