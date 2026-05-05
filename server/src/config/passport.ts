import passport from 'passport';
import { registerStrategies } from '../modules/auth/passport.strategies.js';

registerStrategies();

export { passport };
