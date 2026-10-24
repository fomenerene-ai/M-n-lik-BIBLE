// Historique des versions, affiché dans l'écran « Mise à jour ».
// Ajouter une entrée en tête à chaque publication notable.

export const CHANGELOG = [
  {
    version: '1.4.0',
    date: '2026-10-24',
    items: [
      'Lecture vocale des chapitres : bouton haut-parleur dans la lecture, verset lu mis en valeur, enchaînement automatique sur le chapitre suivant.',
      'Lecture vocale des histoires : bouton « Écouter le récit », paragraphe en cours mis en valeur.',
      'Barre de lecture : pause, vitesse, arrêt ; l’écran reste allumé pendant l’écoute.',
      'Réglages › Lecture vocale : choix de la voix française, vitesse, annonce des numéros de verset, aide pour installer une voix hors connexion.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-24',
    items: [
      'Bible du Semeur renumérotée comme la Louis Segond : mêmes numéros de versets dans les deux versions (Genèse 32, Nombres 17, 1 Rois 5, Daniel 4, Jonas 2…).',
      'Joël 3 et Malachie 4 désormais disponibles en Bible du Semeur.',
      'Retéléchargement automatique de la Bible du Semeur au premier lancement connecté. Surlignages, notes et favoris conservés.',
      'Références corrigées dans les histoires d’Acan, d’Ésaïe et de Michée.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-24',
    items: [
      'Nouvel écran « Mise à jour » sur l’accueil : version installée, recherche de nouveautés, aide en cas de blocage.',
      'Interface affinée : accueil, tuiles, cartes, lecture, histoires (lettrine, frise chronologique) et mode sombre.',
      'Verset du jour sur l’accueil, tiré des textes installés.',
      'Accessibilité : lien d’accès direct au contenu, versets utilisables au clavier, focus conservé dans les fenêtres, suggestions de livres au clavier.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-15',
    items: [
      'Recherche automatique des mises à jour à l’ouverture et bouton « Rechercher une mise à jour ».',
      'Numéro de build affiché dans les réglages.',
      'Export de la structure des textes (Réglages › Textes bibliques).',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-15',
    items: [
      'Première version : lecture LSG 1910 et Bible du Semeur 2015 hors ligne, recherche par référence, surlignage, notes, favoris, projection.',
      '92 histoires de personnages bibliques, de la Genèse aux compagnons de Paul.',
    ],
  },
];
