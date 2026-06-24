import { useCallback } from 'react'
import { useSettings } from './settings.js'

/**
 * Tiny i18n layer. Translations live in plain `{ en, es, ca, fr }` dictionaries
 * keyed by a short message id. Shared screens use the `UI` / `TITLES` dicts
 * below; each game ships its own co-located dict and reads it with `useT()`.
 *
 *   const STR = { en: { hi: 'Hi {name}' }, es: { hi: 'Hola {name}' }, ... }
 *   const t = useT(STR)
 *   <p>{t('hi', { name })}</p>
 *
 * Lookups fall back to English, then to the raw key, so a missing translation
 * degrades gracefully instead of blanking the screen. `{name}` placeholders in
 * the string are filled from the optional `vars` object.
 */

export const FALLBACK_LOCALE = 'en'

export function translate(dict, locale, key, vars) {
  let s
  if (dict) {
    const table = dict[locale] || dict[FALLBACK_LOCALE]
    s = table && table[key]
    if (s == null && dict[FALLBACK_LOCALE]) s = dict[FALLBACK_LOCALE][key]
  }
  if (s == null) s = key
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.split(`{${k}}`).join(String(vars[k]))
    }
  }
  return s
}

/**
 * Returns a `t(key, vars)` bound to the current locale and a message dictionary.
 * Re-renders whenever the locale setting changes (via useSettings).
 */
export function useT(dict) {
  const { locale } = useSettings()
  return useCallback((key, vars) => translate(dict, locale, key, vars), [dict, locale])
}

/**
 * Localized display names for every game card. Keyed by game id (see
 * games/registry.js). Used by the home grid and the in-game header.
 */
export const TITLES = {
  en: {
    coloring: 'Coloring Studio',
    puzzle: 'Puzzle Adventure',
    train: 'Rail Routes',
    pipes: 'Pipe Connect',
    memory: 'Memory Match',
    maze: 'Find the Way!',
    sorting: 'Sorting Factory',
    butterfly: 'Butterfly Catcher',
    aquarium: 'Magic Aquarium',
    music: 'Rhythm Band',
    racing: 'Star Racing',
    slice: 'Fruit Slash',
    mosaic: 'Mosaic Art',
    dino: 'Dino Run',
    pong: 'Pong',
    candy: 'Sweet Match',
    connect4: 'Four in a Row',
    count: "Count 'Em!",
    math: 'Add It Up!',
    whack: 'Mole Pop',
    tictactoe: 'Tic-Tac-Toe',
    simon: 'Color Echo',
    balloon: 'Balloon Pump',
    flight: 'Flight Path',
    mathquiz: 'Math Quiz',
    doctor: 'Tiny Doctor',
    cannon: 'Sky Cannon',
    trace: 'Trace It!',
    cups: 'Find the Ball',
    popit: 'Quick Pop',
    coaster: 'Ball Run',
    frog: 'Froggy Tongue',
    compare: 'More or Less',
    wordsearch: 'Word Search',
    golf: 'Mini Golf',
    bricks: 'Brick Breaker',
    worm: 'Hungry Worm',
    mathtiles: 'Math Tiles',
    domino: 'Dominoes',
    blocks: 'Block Drop',
  },
  es: {
    coloring: 'Estudio de Color',
    puzzle: 'Aventura de Puzle',
    train: 'Rutas de Tren',
    pipes: 'Conecta Tuberías',
    memory: 'Memoria',
    maze: '¡Encuentra el Camino!',
    sorting: 'Fábrica de Clasificar',
    butterfly: 'Caza Mariposas',
    aquarium: 'Acuario Mágico',
    music: 'Banda de Ritmo',
    racing: 'Carrera de Estrellas',
    slice: 'Corta Frutas',
    mosaic: 'Arte Mosaico',
    dino: 'Dino Corre',
    pong: 'Pong',
    candy: 'Une Dulces',
    connect4: 'Cuatro en Raya',
    count: '¡A Contar!',
    math: '¡Suma!',
    whack: 'Topos',
    tictactoe: 'Tres en Raya',
    simon: 'Eco de Colores',
    balloon: 'Infla el Globo',
    flight: 'Ruta de Vuelo',
    mathquiz: 'Quiz de Mates',
    doctor: 'Pequeño Doctor',
    cannon: 'Cañón del Cielo',
    trace: '¡Repasa!',
    cups: 'Encuentra la Bola',
    popit: 'Pop Rápido',
    coaster: 'Pista de Bola',
    frog: 'Lengua de Rana',
    compare: 'Más o Menos',
    wordsearch: 'Sopa de Letras',
    golf: 'Minigolf',
    bricks: 'Rompe Ladrillos',
    worm: 'Gusano Glotón',
    mathtiles: 'Fichas de Sumar',
    domino: 'Dominó',
    blocks: 'Caída de Bloques',
  },
  ca: {
    coloring: 'Estudi de Color',
    puzzle: 'Aventura de Trencaclosques',
    train: 'Rutes de Tren',
    pipes: 'Connecta Canonades',
    memory: 'Memòria',
    maze: 'Troba el Camí!',
    sorting: 'Fàbrica de Classificar',
    butterfly: 'Caça Papallones',
    aquarium: 'Aquari Màgic',
    music: 'Banda de Ritme',
    racing: "Cursa d'Estrelles",
    slice: 'Talla Fruites',
    mosaic: 'Art de Mosaic',
    dino: 'Dino Corre',
    pong: 'Pong',
    candy: 'Uneix Llaminadures',
    connect4: 'Quatre en Ratlla',
    count: 'A Comptar!',
    math: 'Suma!',
    whack: 'Talps',
    tictactoe: 'Tres en Ratlla',
    simon: 'Eco de Colors',
    balloon: 'Infla el Globus',
    flight: 'Ruta de Vol',
    mathquiz: 'Qüestionari de Mates',
    doctor: 'Petit Doctor',
    cannon: 'Canó del Cel',
    trace: 'Ressegueix!',
    cups: 'Troba la Bola',
    popit: 'Pop Ràpid',
    coaster: 'Pista de Bola',
    frog: 'Llengua de Granota',
    compare: 'Més o Menys',
    wordsearch: 'Sopa de Lletres',
    golf: 'Minigolf',
    bricks: 'Trenca Maons',
    worm: 'Cuc Afamat',
    mathtiles: 'Fitxes de Sumar',
    domino: 'Dòmino',
    blocks: 'Caiguda de Blocs',
  },
  fr: {
    coloring: 'Atelier de Coloriage',
    puzzle: 'Aventure Puzzle',
    train: 'Trajets de Train',
    pipes: 'Relie les Tuyaux',
    memory: 'Jeu de Mémoire',
    maze: 'Trouve le Chemin !',
    sorting: 'Usine de Tri',
    butterfly: 'Attrape-Papillons',
    aquarium: 'Aquarium Magique',
    music: 'Orchestre du Rythme',
    racing: 'Course aux Étoiles',
    slice: 'Coupe-Fruits',
    mosaic: 'Art Mosaïque',
    dino: 'Dino Court',
    pong: 'Pong',
    candy: 'Relie les Bonbons',
    connect4: 'Puissance 4',
    count: 'Compte-les !',
    math: 'Additionne !',
    whack: 'Tape-Taupe',
    tictactoe: 'Morpion',
    simon: 'Écho des Couleurs',
    balloon: 'Gonfle le Ballon',
    flight: 'Plan de Vol',
    mathquiz: 'Quiz de Maths',
    doctor: 'Petit Docteur',
    cannon: 'Canon du Ciel',
    trace: 'Trace !',
    cups: 'Trouve la Balle',
    popit: 'Pop Rapide',
    coaster: 'Parcours de Bille',
    frog: 'Langue de Grenouille',
    compare: 'Plus ou Moins',
    wordsearch: 'Mots Mêlés',
    golf: 'Mini-Golf',
    bricks: 'Casse-Briques',
    worm: 'Ver Gourmand',
    mathtiles: 'Tuiles à Compter',
    domino: 'Dominos',
    blocks: 'Chute de Blocs',
  },
}

/**
 * Strings shared across screens and the game frame (Splash settings, header,
 * countdown, generic praise). Game-specific copy lives with each game.
 */
export const UI = {
  en: {
    start: 'Start',
    settings: 'Settings',
    age: 'Age',
    ageAll: 'All ages',
    language: 'Language',
    sound: 'Sound',
    toggleSound: 'Toggle sound',
    fullScreen: 'Full screen',
    toggleFullScreen: 'Toggle full screen on start',
    done: 'Done',
    stars: '{n} stars',
    closeGame: 'Close game',
    napping: 'That game is taking a nap. 💤',
    backHome: 'Back home',
    gettingReady: 'Getting ready… 🎈',
    go: 'Go!',
    excellent: 'Excellent!',
    wellDone: 'Well done!',
    goodTry: 'Good try!',
  },
  es: {
    start: 'Empezar',
    settings: 'Ajustes',
    age: 'Edad',
    ageAll: 'Todas',
    language: 'Idioma',
    sound: 'Sonido',
    toggleSound: 'Activar o desactivar el sonido',
    fullScreen: 'Pantalla completa',
    toggleFullScreen: 'Empezar en pantalla completa',
    done: 'Listo',
    stars: '{n} estrellas',
    closeGame: 'Cerrar juego',
    napping: 'Ese juego está durmiendo. 💤',
    backHome: 'Volver al inicio',
    gettingReady: 'Preparando… 🎈',
    go: '¡Ya!',
    excellent: '¡Excelente!',
    wellDone: '¡Muy bien!',
    goodTry: '¡Buen intento!',
  },
  ca: {
    start: 'Comença',
    settings: 'Ajustos',
    age: 'Edat',
    ageAll: 'Totes',
    language: 'Idioma',
    sound: 'So',
    toggleSound: 'Activa o desactiva el so',
    fullScreen: 'Pantalla completa',
    toggleFullScreen: 'Comença en pantalla completa',
    done: 'Fet',
    stars: '{n} estrelles',
    closeGame: 'Tanca el joc',
    napping: 'Aquest joc està dormint. 💤',
    backHome: "Torna a l'inici",
    gettingReady: 'Preparant… 🎈',
    go: 'Ja!',
    excellent: 'Excel·lent!',
    wellDone: 'Molt bé!',
    goodTry: 'Bon intent!',
  },
  fr: {
    start: 'Commencer',
    settings: 'Réglages',
    age: 'Âge',
    ageAll: 'Tous',
    language: 'Langue',
    sound: 'Son',
    toggleSound: 'Activer ou couper le son',
    fullScreen: 'Plein écran',
    toggleFullScreen: 'Démarrer en plein écran',
    done: 'Terminé',
    stars: '{n} étoiles',
    closeGame: 'Fermer le jeu',
    napping: 'Ce jeu fait la sieste. 💤',
    backHome: "Retour à l'accueil",
    gettingReady: 'Préparation… 🎈',
    go: 'Partez !',
    excellent: 'Excellent !',
    wellDone: 'Bravo !',
    goodTry: 'Bien essayé !',
  },
}

/** Hook for the shared UI dict. */
export function useUI() {
  return useT(UI)
}

/** Localized title for a game id, for the current locale. */
export function useTitle() {
  return useT(TITLES)
}
