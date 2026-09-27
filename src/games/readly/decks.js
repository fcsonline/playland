/*
 * Read Along — sentence decks, ported from Readly.
 *
 * Syllables are separated with the middle dot "·" inside each word. Words are
 * separated with a plain space. Punctuation stays glued to its syllable. Every
 * sentence is split by hand so the division is right for the language:
 * Catalan digraphs like ll / ny / qu / gu never split, while rr / ss / tj / tx
 * / l·l do; French keeps ch / ph / gn / ou / eu / au / eau / ai / oi together
 * and splits double consonants (pom·me). French "!" is preceded by a
 * no-break space so it stays glued to the last word.
 */

/** Milliseconds each syllable is held, slowest first. The slow end is very
 * slow on purpose: a child sounding out first words needs seconds per
 * syllable, not tenths. Prefs store the index into this table. */
export const SPEEDS = [3000, 2600, 2250, 1950, 1700, 1500, 1300, 1150, 1000, 880, 760, 660, 570, 490, 420, 350]
export const DEFAULT_SPEED = 8

/** BCP 47 tags for speech synthesis, per app locale. */
export const SPEECH_LANG = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB', fr: 'fr-FR' }

const FR = [
  'Le chat dort sur le ca·na·pé.',
  'La fil·le joue dans le sa·ble.',
  'Le chien court dans la rue.',
  'Ma·man fait un gâ·teau.',
  'Pa·pa lit u·ne his·toi·re.',
  'Les oi·seaux vo·lent très haut.',
  'La lu·ne bril·le dans la nuit.',
  "Le pois·son na·ge dans l'eau.",
  "J'ai·me beau·coup le cho·co·lat.",
  'Le so·leil chauf·fe la pla·ge.',
  'Le pa·pil·lon a des ai·les jau·nes.',
  'Le gar·çon man·ge u·ne pom·me.',
  "Nous al·lons à l'é·co·le cha·que jour.",
  'Mon vé·lo est rou·ge.',
  'Le che·val ga·lo·pe dans le champ.',
  'La gre·nouil·le sau·te dans la ma·re.',
  'Mes a·mis sont très drô·les.',
  "La va·che man·ge de l'her·be ver·te.",
  'Le train ar·ri·ve à la ga·re.',
  'Le bal·lon re·bon·dit très haut.',
  'Mon frè·re joue du pia·no.',
  'Il pleut beau·coup ce ma·tin.',
  "L'é·lé·phant est très gros.",
  'La tor·tue mar·che len·te·ment.',
  'Les en·fants jouent dans le parc.',
  'La fleur sent très bon.',
  "Au·jour·d'hui j'ai ap·pris u·ne chan·son.",
  'La four·mi por·te u·ne feuil·le.',
  'Nous man·geons du pain et du fro·ma·ge.',
  'Bon·ne nuit, à de·main\u00a0!',
]

const CA = [
  'El gat dorm al so·fà.',
  'La ne·na ju·ga a la sor·ra.',
  'El gos cor·re pel car·rer.',
  'La ma·re fa un pas·tís.',
  'El pa·re lle·geix un con·te.',
  'Els o·cells vo·len molt alt.',
  'La llu·na bri·lla a la nit.',
  'El peix ne·da a l\'ai·gua.',
  'M\'a·gra·da molt la xo·co·la·ta.',
  'El sol es·cal·fa la plat·ja.',
  'La pa·pa·llo·na té a·les gro·gues.',
  'El nen men·ja u·na po·ma.',
  'A·nem a l\'es·co·la ca·da di·a.',
  'La bi·ci·cle·ta és ver·me·lla.',
  'El ca·vall ga·lo·pa pel camp.',
  'La gra·no·ta sal·ta a l\'es·tany.',
  'Els meus a·mics són di·ver·tits.',
  'La va·ca men·ja her·ba ver·da.',
  'El tren ar·ri·ba a l\'es·ta·ci·ó.',
  'La pi·lo·ta bo·ta molt a·munt.',
  'El meu ger·mà to·ca el pi·a·no.',
  'Plou molt fort a·quest ma·tí.',
  'L\'e·le·fant és molt gran.',
  'La tor·tu·ga ca·mi·na a poc a poc.',
  'Els nens ju·guen al parc.',
  'La flor fa u·na o·lor dol·ça.',
  'El pa·re con·du·eix el cot·xe.',
  'A·vui he a·près u·na can·çó.',
  'La for·mi·ga por·ta u·na fu·lla.',
  'El lli·bre ex·pli·ca u·na his·tò·ri·a.',
  'Fem un cas·tell de sor·ra.',
  'La me·va ger·ma·na riu molt.',
  'El do·fí ne·da molt de pres·sa.',
  'Men·jo pa amb to·mà·quet.',
  'El cel és blau i clar.',
  'La brui·xa vo·la amb l\'es·com·bra.',
  'El meu gos té mol·ta ga·na.',
  'A·nem a dor·mir a·vi·at.',
  'La pan·xa del pin·güí és blan·ca.',
  'Bo·na nit, fins de·mà!',
]

const ES = [
  'El ga·to duer·me en el so·fá.',
  'La ni·ña jue·ga en la a·re·na.',
  'El pe·rro co·rre por la ca·lle.',
  'Ma·má ha·ce un pas·tel.',
  'Pa·pá le·e un cuen·to.',
  'Los pá·ja·ros vue·lan muy al·to.',
  'La lu·na bri·lla en la no·che.',
  'El pez na·da en el a·gua.',
  'Me gus·ta mu·cho el cho·co·la·te.',
  'El sol ca·lien·ta la pla·ya.',
  'La ma·ri·po·sa tie·ne a·las a·ma·ri·llas.',
  'El ni·ño co·me u·na man·za·na.',
  'Va·mos a la es·cue·la ca·da dí·a.',
  'La bi·ci·cle·ta es ro·ja.',
  'El ca·ba·llo co·rre por el cam·po.',
  'La ra·na sal·ta en el es·tan·que.',
  'Mis a·mi·gos son di·ver·ti·dos.',
  'La va·ca co·me hier·ba ver·de.',
  'El tren lle·ga a la es·ta·ción.',
  'La pe·lo·ta bo·ta muy al·to.',
  'Mi her·ma·no to·ca el pia·no.',
  'Llue·ve mu·cho es·ta ma·ña·na.',
  'El e·le·fan·te es muy gran·de.',
  'La tor·tu·ga ca·mi·na des·pa·cio.',
  'Los ni·ños jue·gan en el par·que.',
  'La flor hue·le muy bien.',
  'Hoy a·pren·dí u·na can·ción.',
  'La hor·mi·ga lle·va u·na ho·ja.',
  'Co·me·mos pan con to·ma·te.',
  'Bue·nas no·ches, has·ta ma·ña·na.',
]

const EN = [
  'The cat sleeps on the so·fa.',
  'The girl plays in the sand.',
  'The dog runs down the street.',
  'Mum bakes a big cake.',
  'Dad reads a fun·ny sto·ry.',
  'The birds fly ve·ry high.',
  'The moon shines in the night.',
  'The fish swims in the wa·ter.',
  'I real·ly like choc·o·late.',
  'The sun warms the sand·y beach.',
  'The but·ter·fly has yel·low wings.',
  'The boy eats a red ap·ple.',
  'We go to school eve·ry day.',
  'My bi·cy·cle is bright red.',
  'The horse runs through the field.',
  'The frog jumps in·to the pond.',
  'My friends are ve·ry fun·ny.',
  'The cow eats green grass.',
  'The train stops at the sta·tion.',
  'The ball boun·ces ve·ry high.',
  'My broth·er plays the pi·an·o.',
  'It rains a lot to·day.',
  'The el·e·phant is ve·ry big.',
  'The tur·tle walks ve·ry slow·ly.',
  'The chil·dren play in the park.',
  'The flow·er smells so sweet.',
  'To·day I learned a new song.',
  'The ant car·ries a green leaf.',
  'We eat bread with to·ma·to.',
  'Good night, see you to·mor·row.',
]

export const DECKS = { ca: CA, es: ES, en: EN, fr: FR }
