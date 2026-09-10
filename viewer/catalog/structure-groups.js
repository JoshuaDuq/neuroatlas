/**
 * FreeSurfer aseg structures, their readable names, and the anatomical system
 * used for navigation.
 *
 * Names drop the Left-/Right- prefix because laterality is displayed as its
 * own field rather than folded into the name. The systems are the conventional
 * groupings for these 35 labels; like the cortical lobes they are a navigation
 * aid, not a measured boundary.
 */
export const STRUCTURE_LABELS = {
  'Left-Lateral-Ventricle': { name: 'Lateral ventricle', system: 'Ventricles and CSF' },
  'Right-Lateral-Ventricle': { name: 'Lateral ventricle', system: 'Ventricles and CSF' },
  'Left-Inf-Lat-Vent': { name: 'Inferior lateral ventricle', system: 'Ventricles and CSF' },
  'Right-Inf-Lat-Vent': { name: 'Inferior lateral ventricle', system: 'Ventricles and CSF' },
  '3rd-Ventricle': { name: 'Third ventricle', system: 'Ventricles and CSF' },
  '4th-Ventricle': { name: 'Fourth ventricle', system: 'Ventricles and CSF' },
  'Left-choroid-plexus': { name: 'Choroid plexus', system: 'Ventricles and CSF' },
  'Right-choroid-plexus': { name: 'Choroid plexus', system: 'Ventricles and CSF' },

  'Left-Caudate': { name: 'Caudate nucleus', system: 'Basal ganglia' },
  'Right-Caudate': { name: 'Caudate nucleus', system: 'Basal ganglia' },
  'Left-Putamen': { name: 'Putamen', system: 'Basal ganglia' },
  'Right-Putamen': { name: 'Putamen', system: 'Basal ganglia' },
  'Left-Pallidum': { name: 'Globus pallidus', system: 'Basal ganglia' },
  'Right-Pallidum': { name: 'Globus pallidus', system: 'Basal ganglia' },
  'Left-Accumbens-area': { name: 'Nucleus accumbens', system: 'Basal ganglia' },
  'Right-Accumbens-area': { name: 'Nucleus accumbens', system: 'Basal ganglia' },

  'Left-Hippocampus': { name: 'Hippocampus', system: 'Limbic' },
  'Right-Hippocampus': { name: 'Hippocampus', system: 'Limbic' },
  'Left-Amygdala': { name: 'Amygdala', system: 'Limbic' },
  'Right-Amygdala': { name: 'Amygdala', system: 'Limbic' },

  'Left-Thalamus-Proper': { name: 'Thalamus', system: 'Diencephalon' },
  'Right-Thalamus-Proper': { name: 'Thalamus', system: 'Diencephalon' },
  'Left-VentralDC': { name: 'Ventral diencephalon', system: 'Diencephalon' },
  'Right-VentralDC': { name: 'Ventral diencephalon', system: 'Diencephalon' },

  'Left-Cerebellum-Cortex': { name: 'Cerebellar cortex', system: 'Cerebellum' },
  'Right-Cerebellum-Cortex': { name: 'Cerebellar cortex', system: 'Cerebellum' },
  'Left-Cerebellum-White-Matter': { name: 'Cerebellar white matter', system: 'Cerebellum' },
  'Right-Cerebellum-White-Matter': { name: 'Cerebellar white matter', system: 'Cerebellum' },

  'Brain-Stem': { name: 'Brainstem', system: 'Brainstem' },
  'Optic-Chiasm': { name: 'Optic chiasm', system: 'Brainstem' },

  'CC_Anterior': { name: 'Corpus callosum, anterior', system: 'Corpus callosum' },
  'CC_Mid_Anterior': { name: 'Corpus callosum, mid-anterior', system: 'Corpus callosum' },
  'CC_Central': { name: 'Corpus callosum, central', system: 'Corpus callosum' },
  'CC_Mid_Posterior': { name: 'Corpus callosum, mid-posterior', system: 'Corpus callosum' },
  'CC_Posterior': { name: 'Corpus callosum, posterior', system: 'Corpus callosum' },
};
