#!/bin/bash
# Every Neurosynth term's consistency map on Rorqual, then the merged table once all tasks succeed.
# A task that times out leaves its finished terms; resubmitting fits only the rest.
set -euo pipefail
here=/scratch/joshduq/neurosynth_terms
tasks=${1:?number of array tasks}
cpus=${2:?CPUs per task}
log="--output=$here/logs/%x_%A_%a.out"
fit=$(sbatch --parsable --job-name=ns_terms --array=0-$((tasks - 1)) --time=03:00:00 \
    --cpus-per-task="$cpus" --mem-per-cpu="${3:?GB per CPU}G" "$log" "$here/code/scripts/derive_term_scores.sbatch")
merge=$(sbatch --parsable --job-name=ns_merge --account=def-mpcoll --time=00:30:00 --mem=8G \
    --cpus-per-task=1 --output="$here/logs/%x_%j.out" --dependency=afterok:"$fit" \
    --wrap "module load StdEnv/2023 python/3.12 && source $here/venv/bin/activate && python $here/code/scripts/derive_term_scores.py merge $here/out")
printf '%s\n' "$(date -Iseconds)" "fit $fit ($tasks x $cpus CPUs)" "merge $merge" | tee -a "$here/jobs.txt"
