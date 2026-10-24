#!/bin/bash
# One array task of derive_term_scores.py run in its venv on Rorqual: every term whose vocabulary
# index leaves this task's remainder, one fork per CPU. derive_term_scores_submit_rorqual.sh submits it.
#SBATCH --account=def-mpcoll
set -euo pipefail
here=/scratch/joshduq/neurosynth_terms
module load StdEnv/2023 python/3.12
source "$here/venv/bin/activate"
# FlexiBLAS's AOCL backend, the compute nodes' default, segfaults in nilearn's coordinate transform
# of a whole fsaverage surface; each fork keeps a single BLAS thread.
export FLEXIBLAS=OPENBLAS OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 FLEXIBLAS_NUM_THREADS=1
export WORKERS=$SLURM_CPUS_PER_TASK
python "$here/code/scripts/derive_term_scores.py" run "$here/out"
