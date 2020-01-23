const authenticated = require('./authenticated.js')
const cp = require('./cp.js')
const feeds = require('./feeds/index.js')  
const guilds = require('./guilds/index.js')
const users = require('./users/index.js')

module.exports = {
  guilds,
  feeds,
  users,
  authenticated,
  cp
}
