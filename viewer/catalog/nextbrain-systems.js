/** Navigation groups of published NextBrain IDs. PVA denotes cerebellar vermis. */
const SYSTEMS = [
  { en: 'Ventricles and CSF', fr: 'Ventricules et LCR', labels: [50] },
  { en: 'White matter pathways', fr: 'Substance blanche', labels: [7, 68, 130, 184, 199, 201, 234, 246, 276, 298, 309, 322, 412, 461, 611] },
  { en: 'Basal ganglia', fr: 'Ganglions de la base', labels: [48, 79, 101, 102, 118, 119, 120, 174, 206, 349, 393] },
  { en: 'Olfactory structures', fr: 'Rhinencéphale', labels: [99, 100, 113, 125, 157] },
  { en: 'Basal forebrain', fr: 'Prosencéphale basal', labels: [103, 108, 111, 128] },
  { en: 'Limbic', fr: 'Limbique', labels: [117, 214, 215, 216, 217, 238, 240, 242, 277, 278, 279, 295, 301, 320, 377] },
  { en: 'Hypothalamus', fr: 'Hypothalamus', labels: [147, 149, 150, 160, 181, 192, 193, 194, 196, 207, 227, 228, 229, 230, 232, 243, 244, 245, 255, 256, 268, 275, 297, 304, 305, 306, 307, 308, 843] },
  { en: 'Visual pathways', fr: 'Voies visuelles', labels: [114, 161, 208, 209] },
  { en: 'Thalamus', fr: 'Thalamus', labels: [190, 191, 218, 219, 220, 221, 222, 223, 224, 225, 252, 253, 254, 274, 282, 283, 284, 285, 286, 303, 312, 313, 314, 350, 378, 379, 380, 381, 382, 394, 395, 396, 397, 398, 399, 423, 424, 425, 426, 441, 442, 443, 454, 458, 478, 479, 492, 508, 512, 517, 519, 578, 811, 813] },
  { en: 'Subthalamus', fr: 'Sous-thalamus', labels: [226, 315, 316, 321, 400, 433] },
  { en: 'Brainstem', fr: 'Tronc cérébral', labels: [310, 352, 384, 385, 414, 435, 451, 465, 496, 498, 521, 531, 541, 580, 654, 662, 666, 687, 697, 765] },
  { en: 'Hippocampus', fr: 'Hippocampe', labels: [326, 339, 340, 341, 342, 343, 344, 345, 346, 347, 354, 364, 365, 367, 368, 369, 370, 371, 372, 373, 374, 375, 404, 405, 407, 408, 409, 410, 411, 418, 419, 420, 421, 422, 432, 558, 559, 561, 562, 563, 564, 565, 566, 567, 568, 569, 571, 572, 573, 574, 575, 576] },
  { en: 'Epithalamus', fr: 'Épithalamus', labels: [430, 444, 493] },
  { en: 'Metathalamus', fr: 'Métathalamus', labels: [484, 504, 510] },
  { en: 'Diencephalon', fr: 'Diencéphale', labels: [506] },
  { en: 'Cerebellum', fr: 'Cervelet', labels: [595, 597, 715, 721, 751, 752, 846] },
  { en: 'Temporal', fr: 'Temporal', labels: [2001, 2006, 2007, 2009, 2015, 2016, 2030, 2033, 2034] },
  { en: 'Cingulate', fr: 'Cingulaire', labels: [2002, 2010, 2023, 2026] },
  { en: 'Frontal', fr: 'Frontal', labels: [2003, 2012, 2014, 2017, 2018, 2019, 2020, 2024, 2027, 2028, 2032] },
  { en: 'Occipital', fr: 'Occipital', labels: [2005, 2011, 2013, 2021] },
  { en: 'Parietal', fr: 'Pariétal', labels: [2008, 2022, 2025, 2029, 2031] },
  { en: 'Insula', fr: 'Insula', labels: [2035] },
];

const byLabel = new Map(SYSTEMS.flatMap(system => system.labels.map(id => [id, system])));

export function nextbrainSystem(region, lang = 'en') {
  const system = byLabel.get(region.source_label_id % 10000);
  if (!system) throw new Error(`NextBrain label has no anatomical system: ${region.source_label_id}`);
  return system[lang];
}
