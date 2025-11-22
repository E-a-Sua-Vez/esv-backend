import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('local', 'test', 'prod').default('local').required(),
  PORT: Joi.number().default(3000),

  // Firebase
  PROJECT_ID: Joi.string().required(),
  PRIVATE_KEY: Joi.string().required(),
  CLIENT_EMAIL: Joi.string().email().required(),

  // Authentication
  VALIDATE_AUTH: Joi.string().valid('0', '1').default('0'),

  // Application URLs
  BACKEND_URL: Joi.string().uri().required(),

  // Email
  EMAIL_SOURCE: Joi.string().email(),

  // Request limits
  MAX_REQUEST_SIZE: Joi.string().default('5mb'),
});
