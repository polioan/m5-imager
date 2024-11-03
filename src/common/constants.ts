export const screenWidth = 135
export const screenHeight = 240

export const unknownError = 'Unknown error, check logs'

export const boards = [
  { value: 'm5stack:esp32:m5stack_cardputer', name: 'Cardputer' },
  { value: 'm5stack:esp32:m5stack_stickc_plus2', name: 'Stickc plus2' },
  { value: 'm5stack:esp32:m5stack_stickc_plus', name: 'Stickc plus' },
] as const satisfies {
  value: string
  name: string
}[]
