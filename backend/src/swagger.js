import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
const options = {
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
            }
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
export const setupSwagger = (app) => {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log('Swagger UI available at /api-docs');
};
