import React from 'react'
import styled from 'styled-components'
import { Color } from '.'

const List = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
`

const Item = styled.li`
  > div {
    height: 100px;
    width: 200px;
    border: 1px solid;
    border-color: var(--theme-ui-colors-border);
  }
`

const ColorDemo: React.FC = () => {
  const keys = Object.keys(Color)
  return (
    <List>
      {keys.map((key) => (
        <Item key={key}>
          <code>{key}</code>
          <div style={{ backgroundColor: Color[key] }} />
        </Item>
      ))}
    </List>
  )
}

export default ColorDemo
