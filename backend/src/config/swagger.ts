import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SI-TCHA AI API',
      version: '1.0.0',
      description:
        "Documentation de l'API REST pour le backend de l'application SI-TCHA AI. " +
        "Elle permet de gérer les utilisateurs (Admins, Leaders GIC, Agriculteurs, Acheteurs) et les entités métiers comme les GICs.",
      contact: {
        name: 'Support SI-TCHA AI',
        email: 'work@sitcha.ai',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000/api',
        description: 'Serveur de développement local',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Entrez le token JWT avec le préfixe "Bearer ". Exemple: "Bearer {token}"',
        },
      },
    },
  },
  apis: ['./src/api/routes/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;