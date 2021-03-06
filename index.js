const { join } = require('path')
const pull = require('pull-stream')
const set = require('lodash.set')
const { isFeed, isCloakedMsg: isGroup } = require('ssb-ref')

const KeyStore = require('./key-store')
const Envelope = require('./envelope')
const listen = require('./listen')
const { FeedId } = require('./lib/cipherlinks')
const GroupId = require('./lib/group-id')
const GetGroupTangle = require('./lib/get-group-tangle')

const Method = require('./method')

module.exports = {
  name: 'tribes',
  version: require('./package.json').version,
  manifest: {
    register: 'async',
    registerAuthors: 'async',
    create: 'async',
    invite: 'async',
    link: {
      create: 'async'
    },
    findByFeedId: 'async'
  },
  init
}

function init (ssb, config) {
  var state = {
    feedId: new FeedId(ssb.id).toTFK(),
    previous: undefined,

    loading: {
      previous: true,
      keystore: true
    }
  }

  /* secret keys store / helper */
  const keystore = KeyStore(join(config.path, 'tribes/keystore'), ssb.keys, () => {
    state.loading.keystore = false
  })
  ssb.close.hook(function (fn, args) {
    keystore.close(() => fn.apply(this, args))
  })

  /* register the boxer / unboxer */
  const { boxer, unboxer } = Envelope(keystore, state)
  ssb.addBoxer({ init: isBoxerReady, value: boxer })
  ssb.addUnboxer({ init: isUnboxerReady, ...unboxer })

  function isBoxerReady (done) {
    if (state.loading.previous === false) return done()
    setTimeout(() => isBoxerReady(done), 500)
  }

  function isUnboxerReady (done) {
    if (state.loading.keystore === false) return done()
    setTimeout(() => isUnboxerReady(done), 500)
  }

  /* start listeners */
  listen.previous(ssb)(prev => {
    state.previous = prev
    if (state.loading.previous) state.loading.previous = false
  })
  listen.addMember(ssb)(m => {
    const { root, groupKey } = m.value.content
    ssb.get({ id: root, meta: true }, (err, groupInitMsg) => {
      if (err) throw err

      const groupId = GroupId({ groupInitMsg, groupKey })
      const authors = [
        m.value.author,
        ...m.value.content.recps.filter(isFeed)
      ]

      keystore.processAddMember({ groupId, groupKey, root, authors }, (err, newAuthors) => {
        if (err) throw err
        if (newAuthors.length) {
          console.log('rebuild!!!   (ﾉ´ヮ´)ﾉ*:･ﾟ✧')
          ssb.rebuild(() => console.log('rebuild finished'))
        }
      })
    })
  })

  /* We care about group/add-member messages others have posted which:
   * 1. add us to a new group
   * 2. add other people to a group we're already in
   *
   * In (2) we may be able to skip re-indexing if they haven't published
   * any brand new private messages since they were added.
   * This would require knowing their feed seq at time they were entrusted with key
   * (because they can't post messages to the group before then)
   */

  /* auto-add group tangle info to all private-group messages */
  const getGroupTangle = GetGroupTangle(ssb, keystore)
  ssb.publish.hook(function (fn, args) {
    const [content, cb] = args
    if (!content.recps) return fn.apply(this, args)
    if (!isGroup(content.recps[0])) return fn.apply(this, args)

    getGroupTangle(content.recps[0], (err, tangle) => {
      if (err) {
        console.warn(err)
        // NOTE there are two ways an err can occur in getGroupTangle, and we don't
        // want to cb(err) with either in this hook. Rather we pass it on to boxers to throw
        return fn.apply(this, args)
      }

      fn.apply(this, [set(content, 'tangles.group', tangle), cb])
    })
  })

  /* API */
  const scuttle = Method(ssb, keystore, state) // ssb db methods
  return {
    register: keystore.group.register,
    registerAuthors (groupId, authorIds, cb) {
      pull(
        pull.values(authorIds),
        pull.asyncMap((authorId, cb) => keystore.group.registerAuthor(groupId, authorId, cb)),
        pull.collect((err) => {
          if (err) cb(err)
          else cb(null, true)
        })
      )
    },
    create (opts, cb) {
      scuttle.group.init((err, data) => {
        if (err) return cb(err)

        keystore.group.register(data.groupId, { key: data.groupKey, root: data.groupInitMsg.key }, (err) => {
          if (err) return cb(err)

          keystore.group.registerAuthor(data.groupId, ssb.id, (err) => {
            if (err) return cb(err)
            cb(null, data)
          })
        })
      })
    },
    invite: scuttle.group.addMember,
    link: {
      create: scuttle.link.create
    },
    findByFeedId: scuttle.link.findGroupByFeedId
  }
}
