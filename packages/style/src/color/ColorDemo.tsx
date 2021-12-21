import React from 'react'
import { Color } from '.'

const ColorDemo: React.FC = () => {
  return <pre>{JSON.stringify(Color, null, 2)}</pre>
}

export default ColorDemo
