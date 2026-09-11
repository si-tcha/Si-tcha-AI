import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { logger } from './middlewares/logger.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SI-TCHA AI Mobile API',
      version: '1.0.0',
      description: 'API documentation for the SI-TCHA AI mobile backend',
    },
    servers: [
      {
        url: 'https://si-tcha-ai-mobile.onrender.com',
        description: 'Production Server',
      },
      {
        url: 'http://localhost:4000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/controllers/*.ts', './src/api/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Application, enabled: boolean = true) => {
  if (!enabled) {
    return;
  }
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  logger.info('Documentation Swagger UI initialisée sur /api-docs');
};
