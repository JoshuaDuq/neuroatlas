# Subject Anatomies & Cohort Selection

NeuroAtlas supports multiple complete anatomical reconstructions, configured via [`config/model.yaml`](../config/model.yaml). Rather than synthesizing a generic template, every build is anchored in real MRI acquisitions and complete FreeSurfer reconstructions.

---

## 1. Declared Anatomies

```yaml
# config/model.yaml
anatomy: bert        # Default anatomy loaded by the web viewer
```

| Anatomy ID | Subject Description | Acquisition & Reconstruction | Licensing | Anatomical Role |
| :--- | :--- | :--- | :--- | :--- |
| **`bert`** | FreeSurfer's canonical worked example | Single-subject 1 mm T1w, FreeSurfer 5.2.0 (2013) | FreeSurfer Software License | Default reference anatomy |
| **`aomic`** | AOMIC-PIOP1 `sub-0022` | Single-subject 3T T1w, FreeSurfer 6.0.1 (2021) | **CC0 (Public Domain)** | Permissively licensed individual |
| **`fsaverage`** | FreeSurfer group average template | 40-subject surface template, FreeSurfer 6 | FreeSurfer Software License | Intersubject template reference |

---

## 2. Selection Rationale for `aomic` (`sub-0022`)

While `bert` serves as the historical reference, its FreeSurfer license restricts downstream redistribution. To provide a completely open, public-domain brain, NeuroAtlas integrates the Amsterdam Open MRI Collection ([AOMIC-PIOP1, OpenNeuro ds002785](https://openneuro.org/datasets/ds002785)).

### Quantitative MRIQC Selection
Rather than selecting a participant arbitrarily, `sub-0022` was selected objectively by ranking all 216 participants in the AOMIC-PIOP1 dataset against their published MRIQC metrics:

```
Metric                             Cohort Median    sub-0022 Value    Significance
-----------------------------------------------------------------------------------------
Coefficient of Joint Variation (CJV)    0.326            0.258        Lowest in cohort (Rank 1)
Contrast-to-Noise Ratio (CNR)          3.850            4.714        Highest in cohort (Rank 1)
Signal-to-Noise Ratio (SNR)            7.120            8.430        Top decile
```

`sub-0022` represents the highest image quality and grey/white contrast among all 216 participants, minimizing surface reconstruction artifacts and partial volume errors.

---

## 3. Candidate Dataset Audit (Excluded Anatomies)

Every candidate anatomy evaluated for NeuroAtlas had to satisfy a non-negotiable scientific requirement: **a complete, published `recon-all` directory** containing pial, white, sulc, and `sphere.reg` surfaces, native Destrieux `.annot` parcellations, and conformed $256^3$ `orig.mgz`, `aseg.mgz`, `ribbon.mgz`, and `aparc.a2009s+aseg.mgz` volumes.

Candidates failing this contract were excluded:

| Dataset | Candidate Status | Reason for Exclusion |
| :--- | :--- | :--- |
| **FreeSurfer Maintenance Dataset** (`ds004958`) | Excluded | Raw BIDS MRI only; provides no precomputed `recon-all` derivatives. |
| **Penn LEAD Anatomical Derivatives** (`ds007089`)| Excluded | fMRIPrep derivatives only. Publishes GIFTI in fsnative and T1w volumes, but no FreeSurfer `.annot` parcellation. Reconciling grids would require re-running parcellations. |
| **Mindboggle-101** | Excluded | VTK surface meshes with DKT labels only. Lacks FreeSurfer directory structure, registered spheres (`sphere.reg`), and native conformed volumes. |
| **FreeSurfer 2018 Tutorial Subjects** | Excluded | Incomplete reconstruction directories missing `sulc`, `aseg.mgz`, and `aparc.a2009s+aseg.mgz`; unstated licensing. |
| **FreeSurfer 8.2 Distribution** (2026) | Excluded | Ships no reconstruction. Distributes only raw sample files (`sample-001.mgz`) requiring local `recon-all` execution. Annexed `bert` is an unversioned test fixture. |

---

## 4. Subject Preparation Workflow

Anatomies are staged independently without modifying source archives:

```bash
# 1. Download and verify subject archives against data/sources.json checksums
uv run python scripts/prepare_subject.py --anatomy bert
uv run python scripts/prepare_subject.py --anatomy aomic

# 2. Warp NextBrain histological atlas via ANTs non-linear SyN registration
uv run python scripts/warp_nextbrain.py --anatomy bert --record

# 3. Compile optimized binary models for the selected anatomy
uv run python -m brain_model.build --anatomy bert
uv run python -m brain_model.build --anatomy aomic
```

`data/sources.json` cryptographically hashes every source file (SHA-256) upon first download, ensuring that model generation is deterministic and reproducible.
