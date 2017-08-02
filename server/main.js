import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var COOR = 'KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU';
var txs = new Mongo.Collection('txs');
var files = new Mongo.Collection('files');
txs.remove({});

function deleteBeforeMilestone() {
} 

Meteor.startup(() => {
  console.log("server");

  SyncedCron.add({
    name: 'Clean export of bad files',
    schedule: function(parser) {
      // parser is a later.parse object
      return parser.text('every 2 minutes');
    },
    job: function() {
      console.log("doing job");
      var now = new Date(oldDateObj.getTime() - 30*60000);
      files.find().forEach(function (item) {
        if(item.time < now) {
          console.log("removing:"+item.txid);
          txs.remove({_id: item.txid});
          files.remove({txid: item.txid});
        }
      });
    }
  });

	Meteor.publish('txs', function () {
		return txs.find();
	});
  var iota = new IOTA({
	'host': 'http://localhost',
	'port':14265
	});
  
  iota.api.getNodeInfo(function(error, success) {
	if(error) {
	  console.log(error)
	} else {
	  console.log(success)
  	}
  });
  
 console.log('/home/lsquires/iri/target/export/');
  var watcher = chokidar.watch('/home/lsquires/iri/target/export/', {
    ignored: /[\/\\]\./, persistent: true
  });

  watcher.on('add', Meteor.bindEnvironment(function(path) {
    console.log(path);
    newFile=fs.readFileSync(path,'utf8');
    let split = newFile.split(/\r?\n/);
    let tx = iota.utils.transactionObject(split[1]);

	  addTX(tx, path);

  }));

  SyncedCron.start();

});

function addTX(tx, path) {
  console.log("adding tx"); 
  var doc = txs.upsert({hash: tx.hash}, tx);
  files.insert({txid: doc.insertedId, path: path, time: new Date()});
}

