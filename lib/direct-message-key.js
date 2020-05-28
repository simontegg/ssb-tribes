const na = require('sodium-native')
const hkdf = require('futoin-hkdf')
const constants = require('private-group-spec/direct-messages/constants.json')

const hash = 'SHA256'
const hashLen = 32
const salt = Buffer.from(constants.SALT, 'utf8')

module.exports = function directMessageKey (mySecretKey) {
  var sk = Buffer.alloc(na.crypto_scalarmult_SCALARBYTES)
  na.crypto_sign_ed25519_sk_to_curve25519(sk, mySecretKey)

  return function DirectMessageKey (publicKey) {
    var pk = Buffer.alloc(na.crypto_scalarmult_SCALARBYTES)
    na.crypto_sign_ed25519_pk_to_curve25519(pk, publicKey)

    var inputKeyingMaterial = Buffer.alloc(na.crypto_scalarmult_BYTES)
    na.crypto_scalarmult(inputKeyingMaterial, sk, pk)

    return hkdf.extract(hash, hashLen, salt, inputKeyingMaterial)
  }
}