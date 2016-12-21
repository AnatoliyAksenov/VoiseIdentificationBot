var Waterline = require('waterline');
var diskAdapter = require('sails-disk');

var orm = new Waterline();

var config = {
  adapters: {
    'default': diskAdapter,
    disk: diskAdapter
  },

  connections: {
    localDisk: {
      adapter: 'disk'
    }
  },
  defaults: {
    migrate: 'safe'
  }
};

var Profile = Waterline.Collection.extend({

  identity: 'profile',
  connection: 'localDisk',

  attributes: {
    profileId: 'string',
    profileName: 'string'
  }
});

orm.loadCollection(Profile);

var db = {};
orm.initialize(config, function(err, models) {
  if(err) throw err;

  db.models = models.collections;
  db.connections = models.connections;

});

module.exports = db;