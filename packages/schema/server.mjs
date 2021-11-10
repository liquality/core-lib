/* eslint-env node */
import express from 'express'
import getPort from 'get-port'
import { graphqlHTTP } from 'express-graphql'
import { schema } from './dist/index.js'

const app = express()

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true
  })
)

const port = await getPort({ port: 3000 })

app.listen(port)

console.log(`Running a GraphQL API server at http://localhost:${port}/graphql`)
