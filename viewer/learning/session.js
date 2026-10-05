/** Learning progress is independent of free anatomical exploration. */
export function createCircuitSession(catalog) {
  let state = { circuit: null, step: 0, answer: null };
  return {
    snapshot: () => ({ ...state }),
    start(id) {
      catalog.get(id);
      state = { circuit: id, step: 0, answer: null };
    },
    go(step) {
      const circuit = catalog.get(state.circuit);
      if (!Number.isInteger(step) || step < 0 || step >= circuit.steps.length) {
        throw new RangeError(`Invalid landmark index: ${step}`);
      }
      state = { ...state, step };
    },
    answer(answer) {
      const circuit = catalog.get(state.circuit);
      if (!Number.isInteger(answer) || answer < 0 || answer >= circuit.question.options.length) {
        throw new RangeError(`Invalid answer index: ${answer}`);
      }
      state = { ...state, answer };
    },
  };
}
