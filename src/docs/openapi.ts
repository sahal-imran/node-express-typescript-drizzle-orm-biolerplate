export const openapi = {
  openapi: '3.1.0',
  info: { title: 'Express TypeScript PostgreSQL Starter API', version: '1.0.0' },
  paths: {
    '/api/v1/users': {
      get: { summary: 'List users', responses: { '200': { description: 'Users' } } },
      post: {
        summary: 'Create user',
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Invalid' },
          '409': { description: 'Duplicate' },
        },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        summary: 'Get user',
        responses: { '200': { description: 'User' }, '404': { description: 'Not found' } },
      },
      patch: { summary: 'Update user', responses: { '200': { description: 'Updated' } } },
      delete: { summary: 'Soft delete user', responses: { '204': { description: 'Deleted' } } },
    },
  },
} as const;
