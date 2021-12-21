import React from 'react'
import styled from 'styled-components'
import { GoogleFont } from '.'
import { fontStyle } from './fontStyle'

const styleKeys = Object.keys(fontStyle)

const List = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
`

const Item = styled.li`
  > div {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border: 1px dashed;
    border-color: var(--theme-ui-colors-border);
    padding: 0 5px;
  }
  margin: 1rem 0 2rem;
`

const FontDemo: React.FC = () => {
  return (
    <GoogleFont>
      <List>
        {styleKeys.map((key) => (
          <Item key={key}>
            <code>{key}</code>
            <div style={fontStyle[key]}>Lorem ipsum dolor sit amet consectetur adipisicing elit. 0123456789!</div>
          </Item>
        ))}
      </List>
    </GoogleFont>
  )
}

export default FontDemo
