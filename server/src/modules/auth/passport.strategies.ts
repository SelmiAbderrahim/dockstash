import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { env } from '../../config/env.js';
import { findUserById, User } from '../users/index.js';
import { verifyPassword } from './auth.service.js';

let registered = false;

export function registerStrategies(): void {
  if (registered) return;
  registered = true;

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      User.findOne({ email: email.toLowerCase() })
        .then(async (user) => {
          if (!user) {
            return done(null, false, { message: 'Invalid email or password.' });
          }
          const ok = await verifyPassword(password, user.password);
          if (!ok) {
            return done(null, false, { message: 'Invalid email or password.' });
          }
          return done(null, {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
          });
        })
        .catch(done);
    }),
  );

  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt'),
        secretOrKey: env.JWT_SECRET,
        // Pin the accepted algorithm to the one we sign with (HS256). Belt-and-
        // suspenders against alg-confusion / `alg:none` acceptance.
        algorithms: ['HS256'],
      },
      (payload: { _id?: string; id?: string; email?: string; role?: string }, done) => {
        const id = payload.id ?? payload._id;
        if (!id) {
          done(null, false);
          return;
        }
        findUserById(id)
          .then((user) => {
            if (!user) {
              done(null, false);
              return;
            }
            done(null, {
              id: user._id.toString(),
              email: user.email,
              role: user.role,
            });
          })
          .catch(done);
      },
    ),
  );
}
