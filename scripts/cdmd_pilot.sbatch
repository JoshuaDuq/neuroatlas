#!/bin/bash
# One stage of cdmd_pilot.py in the pilot's venv on Rorqual; further arguments reach the stage.
# cdmd_pilot_submit_rorqual.sh submits it.
#SBATCH --account=def-mpcoll
set -euo pipefail
here=/scratch/joshduq/cdmd_pilot
module load StdEnv/2023 python/3.12
source "$here/venv/bin/activate"
export CDMD_PILOT_WORK=$here
# Tracking forks one worker per CPU, so each keeps a single BLAS thread.
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 FLEXIBLAS_NUM_THREADS=1
python "$here/code/scripts/cdmd_pilot.py" "$@"
