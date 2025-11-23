/**
 * Script to generate Postman collection from OpenAPI/Swagger JSON
 * Run this after starting the server with GENERATE_SWAGGER_JSON=true
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const openApiPath = path.join(__dirname, '../docs/openapi.json');
const postmanPath = path.join(__dirname, '../docs/postman-collection.json');

// Function to convert OpenAPI to Postman Collection
function convertOpenApiToPostman(openApiSpec) {
  const collection = {
    info: {
      name: openApiSpec.info.title || 'ESV Backend API',
      description: openApiSpec.info.description || '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: openApiSpec.info.version || '1.0.0',
    },
    auth: {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{jwt_token}}',
          type: 'string',
        },
      ],
    },
    variable: [
      {
        key: 'base_url',
        value: openApiSpec.servers?.[0]?.url || 'http://localhost:3000',
        type: 'string',
      },
      {
        key: 'jwt_token',
        value: '',
        type: 'string',
      },
    ],
    item: [],
  };

  // Group endpoints by tags
  const paths = openApiSpec.paths || {};
  const tagMap = {};

  Object.keys(paths).forEach((path) => {
    const pathItem = paths[path];
    Object.keys(pathItem).forEach((method) => {
      const operation = pathItem[method];
      if (!operation.tags || operation.tags.length === 0) {
        return;
      }

      const tag = operation.tags[0];
      if (!tagMap[tag]) {
        tagMap[tag] = {
          name: tag,
          item: [],
        };
      }

      const item = {
        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [],
          url: {
            raw: `{{base_url}}${path}`,
            host: ['{{base_url}}'],
            path: path.split('/').filter((p) => p),
          },
          description: operation.description || '',
        },
        response: [],
      };

      // Add authentication if required
      if (operation.security && operation.security.length > 0) {
        item.request.auth = {
          type: 'bearer',
          bearer: [
            {
              key: 'token',
              value: '{{jwt_token}}',
              type: 'string',
            },
          ],
        };
      }

      // Add parameters
      if (operation.parameters) {
        operation.parameters.forEach((param) => {
          if (param.in === 'path') {
            // Replace path parameters in URL
            item.request.url.path = item.request.url.path.map((p) =>
              p === `{${param.name}}` ? `:${param.name}` : p
            );
          } else if (param.in === 'query') {
            if (!item.request.url.query) {
              item.request.url.query = [];
            }
            item.request.url.query.push({
              key: param.name,
              value: param.schema?.example || '',
              description: param.description,
            });
          } else if (param.in === 'header') {
            item.request.header.push({
              key: param.name,
              value: param.schema?.example || '',
              description: param.description,
            });
          }
        });
      }

      // Add request body
      if (operation.requestBody) {
        const content = operation.requestBody.content;
        if (content) {
          const contentType = Object.keys(content)[0];
          const schema = content[contentType].schema;

          item.request.header.push({
            key: 'Content-Type',
            value: contentType,
          });

          if (schema && schema.properties) {
            const example = {};
            Object.keys(schema.properties).forEach((key) => {
              const prop = schema.properties[key];
              example[key] = prop.example !== undefined ? prop.example : getDefaultValue(prop.type);
            });
            item.request.body = {
              mode: 'raw',
              raw: JSON.stringify(example, null, 2),
              options: {
                raw: {
                  language: 'json',
                },
              },
            };
          }
        }
      }

      // Add example responses
      if (operation.responses) {
        Object.keys(operation.responses).forEach((statusCode) => {
          const response = operation.responses[statusCode];
          item.response.push({
            name: `${statusCode} ${response.description || ''}`,
            originalRequest: item.request,
            status: statusCode,
            code: parseInt(statusCode),
            _postman_previewlanguage: 'json',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: JSON.stringify({ example: 'response data' }, null, 2),
          });
        });
      }

      tagMap[tag].item.push(item);
    });
  });

  // Convert tagMap to array
  collection.item = Object.values(tagMap);

  return collection;
}

function getDefaultValue(type) {
  switch (type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

// Main execution
if (fs.existsSync(openApiPath)) {
  const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
  const postmanCollection = convertOpenApiToPostman(openApiSpec);

  // Ensure docs directory exists
  fs.mkdirSync(path.dirname(postmanPath), { recursive: true });
  fs.writeFileSync(postmanPath, JSON.stringify(postmanCollection, null, 2));

  console.log(`✅ Postman collection generated: ${postmanPath}`);
  console.log(`   Total endpoints: ${postmanCollection.item.reduce((sum, tag) => sum + tag.item.length, 0)}`);
  console.log(`   Total tags: ${postmanCollection.item.length}`);
} else {
  console.error(`❌ OpenAPI spec not found at: ${openApiPath}`);
  console.error('   Please start the server with GENERATE_SWAGGER_JSON=true first');
  process.exit(1);
}

