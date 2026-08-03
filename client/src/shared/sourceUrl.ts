/**
 * Where this running instance's source code lives.
 *
 * AGPL-3.0 §13 requires that anyone interacting with a modified Dockstash over
 * a network be offered the source of *that* modified version. If you deploy a
 * fork, set `VITE_SOURCE_URL` to your repository at image build time — the
 * default below points at upstream, which is only correct for an unmodified
 * install.
 */
const UPSTREAM = 'https://github.com/SelmiAbderrahim/dockstash.com';

export const SOURCE_URL: string = import.meta.env.VITE_SOURCE_URL || UPSTREAM;
