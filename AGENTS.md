# Scientific coding instructions (EEG / fMRI / neuroimaging)

## Highest-priority rules
1. Before writing new analysis code, check the official examples and tutorials for the relevant library and adapt those patterns. Prefer proven library idioms over inventing new approaches.
2. Prefer established libraries and domain standards:
   - EEG/MEG/iEEG → MNE-Python
   - fMRI → Nilearn + NiBabel
   - Data organization → BIDS (MNE-BIDS when relevant)
   - Core numerics → NumPy / SciPy
3. Fail fast. Do not add silent fallbacks, broad exception swallowing, or compatibility shims unless the task explicitly requires them. Let unexpected errors surface.
4. When refactoring, preserve existing numerical results, outputs, and side effects unless the task requires a change.
5. Match the style, naming, structure, and idioms of the surrounding code and the library you are using. Prefer clarity and scientific rigor over cleverness.

## Official example galleries (check these first)
- MNE-Python: https://mne.tools/stable/auto_examples/index.html  
  Tutorials: https://mne.tools/stable/auto_tutorials/index.html
- Nilearn: https://nilearn.github.io/stable/auto_examples/index.html
- Braindecode: https://braindecode.org/stable/auto_examples/index.html
- NeuroDSP: https://neurodsp-tools.github.io/neurodsp/auto_examples/index.html
- MNE-BIDS: https://mne.tools/mne-bids/stable/auto_examples/index.html
- Scikit-learn: https://scikit-learn.org/stable/auto_examples/index.html

## Scientific and code-quality constraints
- Validate inputs at boundaries (shapes, types, ranges, BIDS compliance where relevant).
- Prefer deterministic steps; control randomness explicitly (set seeds, document stochastic parts).
- Prefer clear, concise, preferably vectorized NumPy/SciPy operations when they improve clarity or correctness.
- Keep configuration in one place (e.g. a single config module or YAML) rather than scattering constants.
- Write code that is easy to validate: clear inputs/outputs, minimal hidden state, intermediate results saved when useful for pipelines.
- Do not add abstractions, flags, extra parameters, or flexibility that are not required by the current task.
- Avoid redundancy. Prefer fewer, focused functions that do one clear thing.

## Verification
- Confirm the result matches the expected scientific behavior or the pattern shown in the library’s official examples.
- Prefer a small validation check, comparison against known outputs, or relevant tests over claiming success without evidence.

## Maintenance
This file is intentionally short. Add a rule only after the agent repeatedly makes the same mistake. Periodically delete rules that are no longer needed. Longer style or architecture notes belong in a separate document read only when relevant.
