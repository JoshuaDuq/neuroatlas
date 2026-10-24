#!/bin/bash
# The CDMD sub_013 pilot's Rorqual stages: tracking, then RecoBundles once it succeeds. The fit
# and tissue maps come from the local run; check runs locally on the downloaded bundles.
set -euo pipefail
here=/scratch/joshduq/cdmd_pilot
log="--output=$here/logs/%x_%j.out"
track=$(sbatch --parsable --job-name=cdmd_track --time=03:00:00 --mem=48G --cpus-per-task=64 \
    "$log" "$here/code/scripts/cdmd_pilot.sbatch" track)
bundles=$(sbatch --parsable --job-name=cdmd_bundles --time=03:00:00 --mem=32G --cpus-per-task=1 \
    "$log" --dependency=afterok:"$track" "$here/code/scripts/cdmd_pilot.sbatch" bundles)
printf '%s\n' "$(date -Iseconds)" "track $track" "bundles $bundles" | tee -a "$here/jobs.txt"
