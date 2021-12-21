import { Properties } from 'csstype'

enum Color {
  WHITE = '#fff',
  LIGHTGRAY1 = '#f0f7f9',
  LIGHTGRAY2 = '#f8faff',
  LIGHTGRAY3 = '#d9dfe5',
  LIGHTGRAY4 = '#a8aeb7',
  MIDGRAY1 = '#9a99a2',
  MIDGRAY2 = '#646f85',
  DARKGRAY1 = '#3d4767',
  DARKGRAY2 = '#1d1e21',
  DARKGRAY3 = '#000d35',
  BLACK = '#000',
  PURPLE = '#9d4dfa',
  GREEN = '#2cd2cf',
  LIGHTGREEN = '#38fffb',
  RED = '#f12274',
  DARKPINK = '#d421eb',
  ORANGE = '#fe7f6b'
}

const colorStyle: Record<string, Properties> = {
  gradient: {
    backgroundImage: 'linear-gradient(0deg, #1ce4c3 0%, #302e78 100%)'
  }
}

export { Color, colorStyle }
export default Color
