/** @type {import('@changesets/types').CommitFunctions} */
module.exports = {
  getVersionMessage: ({ releases }) => Promise.resolve(`🔖 v${releases[0]?.newVersion}`),
};
