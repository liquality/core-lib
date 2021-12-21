import React from 'react'
import { fontStyle } from '.'

const FontDemo: React.FC = () => {
  return <pre>{JSON.stringify(fontStyle, null, 2)}</pre>
}

export default FontDemo
