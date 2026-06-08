/**
 * TDCombat — pure damage resolver for the TD minigame simulation.
 * No DOM, no session state.
 */
import { TD_PIECES } from '../data/tdPieces.js'
import { getRadiusCells } from './TDPathfinder.js'

/**
 * Returns the total damage dealt when the hero steps onto (row, col),
 * from all placed pieces whose attack radius covers that cell.
 * @param {number} row
 * @param {number} col
 * @param {{pieceType:string,row:number,col:number}[]} placedPieces
 * @param {number} rows
 * @param {number} cols
 * @returns {number}
 */
export function resolveDamageAtCell(row, col, placedPieces, rows, cols) {
  let total = 0
  for (const piece of placedPieces) {
    const def = TD_PIECES[piece.pieceType]
    if (!def || def.dmg === 0) continue
    const radius = getRadiusCells(def.radiusType, piece.row, piece.col, rows, cols)
    if (radius.some(c => c.row === row && c.col === col)) {
      total += def.dmg
    }
  }
  return total
}
