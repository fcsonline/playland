/**
 * Pixel Jump levels, drawn as ASCII. Row 0 is the sky, row 11 the bottom.
 *
 *   #  ground        =  brick           ?  question block (one coin inside)
 *   T  pipe top      I  pipe body       c  coin
 *   g  grump         s  shelly          S  spiky shelly (cannot be stomped)
 *   F  flag           k  checkpoint     ' ' air — a missing # on the floor is a hole
 *
 * Pipes are always two columns wide (TT over one or more II). The hero spawns
 * at column 1 on the ground.
 */

export const TILE = 16
export const ROWS = 12

const L1 = [
  '                                                                        ',
  '                                                                        ',
  '                                                                        ',
  '                                                                  F     ',
  '                                                                        ',
  '                 ?                        ccc                           ',
  '                                  ===?==                                ',
  '             c       c                              TT      ccc         ',
  '           =?=     ===        TT          ===       II    =====         ',
  '                g             II    g        k  s   II  g               ',
  '##########################  ###########  ###############################',
  '##########################  ###########  ###############################',
]

const L2 = [
  '                                                                                    ',
  '                                                                                    ',
  '                                                                              F     ',
  '                                                                                    ',
  '                                            ccc                   c                 ',
  '            ?               ?             =====?                c   c               ',
  '                                                  cc              ccc               ',
  '      TT        c     c         ==?==           ===== TT        ===== S             ',
  '      II      ====    ===               TT            II              ===           ',
  '      II    g             s    k        II    g  g    IIk           s     g         ',
  '##################   ###############   ##################   ##   ###################',
  '##################   ###############   ##################   ##   ###################',
]

const L3 = [
  '                                                                                          ',
  '                                                                                          ',
  '                                                                                    F     ',
  '                        ccc                         ?                                     ',
  '                      =====             c                                  ccccc          ',
  '        ?                           =?=?=                   cc            =======         ',
  '            TT      c      c                ccccc         S                   S           ',
  '            II    ===       ===   TT        =====        ==== c      c                    ',
  '            II      c             II    =           TT        ===    =                    ',
  '            II  g g k     s       II  g    g        II k    g               s  g          ',
  '##############    ############   #############    ##############    ##   #################',
  '##############    ############   #############    ##############    ##   #################',
]

export const LEVELS = [L1, L2, L3]

const SOLID = new Set(['#', '=', '?', 'T', 'I'])

/**
 * Turn an ASCII map into a level: a solid-tile grid for collisions, merged
 * runs of static tiles for drawing, and lists of live things. `lap` counts how
 * many times the child has been through all levels: later laps run the enemies
 * a little faster and add a second grump behind each one.
 */
export function parseLevel(rows, lap = 0) {
  const cols = rows[0].length
  if (import.meta.env?.DEV && rows.some((r) => r.length !== cols)) {
    throw new Error('Pixel Jump level rows must all be the same width')
  }
  const tiles = new Uint8Array(cols * ROWS)
  const at = (c, r) => (c < 0 || c >= cols || r < 0 || r >= ROWS ? ' ' : rows[r][c])
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < cols; c++) if (SOLID.has(rows[r][c])) tiles[r * cols + c] = 1
  }

  const statics = []
  const qblocks = []
  const coins = []
  const enemies = []
  const checkpoints = []
  let flag = null
  let id = 0
  const speedMul = 1 + 0.15 * lap

  const spawnEnemy = (kind, c, r) => {
    const base = kind === 'grump' ? 28 : 40
    enemies.push({
      id: ++id,
      kind,
      x: c * TILE,
      y: r * TILE,
      vx: 0,
      vy: 0,
      dir: -1,
      speed: base * speedMul,
      state: 'walk',
      t: 0,
      grounded: false,
    })
  }

  for (let r = 0; r < ROWS; r++) {
    let c = 0
    while (c < cols) {
      const ch = rows[r][c]
      if (ch === '#' || ch === '=') {
        const kind = ch === '=' ? 'brick' : at(c, r - 1) === '#' ? 'groundFill' : 'groundTop'
        let len = 1
        while (c + len < cols && rows[r][c + len] === ch && (ch === '=' || (at(c + len, r - 1) === '#') === (kind === 'groundFill'))) len++
        statics.push({ kind, col: c, row: r, len })
        c += len
        continue
      }
      if (ch === 'T') {
        let height = 1
        while (at(c, r + height) === 'I') height++
        statics.push({ kind: 'pipe', col: c, row: r, height })
        c += 2
        continue
      }
      switch (ch) {
        case '?':
          qblocks.push({ id: ++id, col: c, row: r, used: false, bump: 0 })
          break
        case 'c':
          coins.push({ id: ++id, x: c * TILE, y: r * TILE, got: false })
          break
        case 'g':
          spawnEnemy('grump', c, r)
          if (lap >= 1) spawnEnemy('grump', c + 2, r)
          break
        case 's':
          spawnEnemy('shelly', c, r)
          break
        case 'S':
          spawnEnemy('spiky', c, r)
          break
        case 'k':
          checkpoints.push({ x: c * TILE, y: r * TILE })
          break
        case 'F': {
          let groundRow = r + 1
          while (groundRow < ROWS && !SOLID.has(rows[groundRow][c])) groundRow++
          flag = { col: c, row: r, groundRow }
          break
        }
        default:
          break
      }
      c++
    }
  }

  // Background scenery, laid out from the column index so every visit to a
  // level looks the same.
  const decor = []
  for (let c = 2; c < cols; c += 14) decor.push({ kind: 'hill', x: c * TILE, w: 6 * TILE, h: 3 * TILE })
  for (let c = 7; c < cols; c += 9) decor.push({ kind: 'bush', x: c * TILE, w: 3 * TILE, h: 1.2 * TILE })
  for (let c = 4; c < cols; c += 11) decor.push({ kind: 'cloud', x: c * TILE, y: (1 + (c % 3)) * TILE, w: 3 * TILE, h: 1.4 * TILE })

  return {
    tile: TILE,
    rows: ROWS,
    cols,
    tiles,
    statics,
    qblocks,
    coins,
    enemies,
    checkpoints: checkpoints.sort((a, b) => a.x - b.x),
    flag,
    start: { x: TILE, y: 9 * TILE },
    coinsTotal: coins.length + qblocks.length,
    worldW: cols * TILE,
    decor,
  }
}
