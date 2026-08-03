/**
 * Normalize a pasted SSH private key so OpenSSH/libcrypto can load it.
 *
 * Keys pasted through a browser textarea frequently arrive with CRLF line
 * endings or without the trailing newline that the PEM/OpenSSH framing
 * requires. Either defect makes `ssh` reject the file with
 * `Load key "...": error in libcrypto`. We strip carriage returns, trim
 * surrounding blank lines, and guarantee exactly one trailing newline.
 */
export function normalizePrivateKey(privateKey: string): string {
  const body = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return `${body}\n`;
}
