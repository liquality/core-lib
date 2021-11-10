import { loadSchemaSync } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'

export default loadSchemaSync(`${__dirname}/../src/**/*.graphql`, {
  loaders: [new GraphQLFileLoader()]
})
