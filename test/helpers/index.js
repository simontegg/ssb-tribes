const Server = require('scuttle-testbot')
const Secret = require('../../lib/secret-key')
const { FeedId, MsgId } = require('../../lib/cipherlinks')

const decodeLeaves = require('./decode-leaves')
const encodeLeaves = require('./encode-leaves')
const DHFeedKeys = require('./dh-feed-keys')
const print = require('./print')

module.exports = {
  GroupId: () => `%${new Secret().toString()}.cloaked`,
  GroupKey: () => new Secret().toBuffer(),
  FeedId: () => new FeedId().mock().toTFK(),
  PrevMsgId: () => new MsgId().mock().toTFK(),
  DHFeedKeys,

  decodeLeaves,
  encodeLeaves,
  print,
  Server: (opts) => {
    // opts = {
    //   name: String,
    //   startUnclean: Boolean,
    //   keys: SecretKeys
    // }

    const server = Server // eslint-disable-line
      .use(require('../..')) // ssb-tribes
      .use(require('ssb-backlinks'))
      .use(require('ssb-query'))
      .call(opts)

    return server
  }
}
