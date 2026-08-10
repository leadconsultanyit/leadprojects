// Credentials live in two places: the manually-maintained `profile.credentials`
// (written by the profile editor) and the CV-parsed top-level `credentials`.
// Prefer the profile list, falling back to the top-level one so employees who
// never edited their profile still show their CV credentials.
export const userCredentials = (u) =>
  (u?.profile?.credentials?.length ? u.profile.credentials : (u?.credentials || []));
