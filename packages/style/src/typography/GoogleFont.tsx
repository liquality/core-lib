import React from 'react'
import styled from 'styled-components'
import { Helmet } from 'react-helmet'
import { fontFamily } from './fontStyle'

const Font = styled.div({
  ...fontFamily
})

const GoogleFont: React.FC = ({ children }) => {
  return (
    <>
      <Helmet>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </Helmet>
      <Font>{children}</Font>
    </>
  )
}

export { GoogleFont }
export default GoogleFont
