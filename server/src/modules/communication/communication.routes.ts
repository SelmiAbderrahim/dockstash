import { Router } from 'express';
import { sendContactForm } from './communication.controller.js';

export const communicationRouter: Router = Router();

communicationRouter.post('/contact', sendContactForm);
