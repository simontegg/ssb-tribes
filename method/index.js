const Init = require('./group/init')
const AddMember = require('./group/add-member')
const CreateLink = require('./link/create')
const FindByGroupByFeedId = require('./link/find-group-by-feedid')

module.exports = function Method (ssb, keystore, state) {
  return {
    group: {
      init: patient(Init(ssb, keystore, state)),
      addMember: patient(AddMember(ssb, keystore, state))
    },
    link: {
      create: patient(CreateLink(ssb)),
      findGroupByFeedId: FindByGroupByFeedId(ssb)
    }
  }

  function patient (fn) {
    // this can be improved later
    return function (...args) {
      if (!state.isReady) return setTimeout(() => fn.apply(null, args), 500)

      fn.apply(null, args)
    }
  }
}
