import { Properties } from 'csstype'

const fontFamily: Properties = {
  fontFamily: `Montserrat, sans-serif`,
  fontWeight: 400 // regular
}

type StyleKey =
  | 'largeNumber'
  | 'headline'
  | 'headline2'
  | 'headline3'
  | 'input'
  | 'mediumInput'
  | 'largeInput'
  | 'body'
  | 'bodySmall'
  | 'button'

const fontStyle: Record<StyleKey, Properties> = {
  largeNumber: {
    ...fontFamily,
    fontWeight: 300,
    fontSize: '50px'
  },
  headline: {
    ...fontFamily,
    fontSize: '28px'
  },
  headline2: {
    ...fontFamily,
    fontWeight: 600,
    fontSize: '24px'
  },
  headline3: {
    ...fontFamily,
    fontWeight: 600,
    fontSize: '18px'
  },
  largeInput: {
    ...fontFamily,
    fontWeight: 300,
    fontSize: '18px'
  },
  mediumInput: {
    ...fontFamily,
    fontSize: '16px'
  },
  input: {
    ...fontFamily,
    fontWeight: 700,
    fontSize: '12px'
  },
  button: {
    ...fontFamily,
    fontWeight: 600,
    fontSize: '13px'
  },
  body: {
    ...fontFamily,
    fontSize: '12px'
  },
  bodySmall: {
    ...fontFamily,
    fontWeight: 300,
    fontSize: '11px'
  }
}

export { fontStyle, fontFamily }
export default fontStyle
