import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var COOR = 'KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU';
var txs = new Mongo.Collection('txs');
var files = new Mongo.Collection('files');
let currentTime = new ReactiveVar(new Date());


txs.remove({});
files.remove({});



Meteor.startup(() => {
  console.log("server");

  Meteor.setInterval(function() {
    console.log("updated time")
    currentTime.set(new Date());
  }, 1000);

  Meteor.publish('txs', function () {
    /*if(filterConfirmed) {
     return txs.find({$and: [
     {"time": {$gt: (new Date((new Date()).getTime() - minsAgo * 60000))}},
     {"confirmed": { $eq: true}}
     ]});
     } else {
     return txs.find({"time": {$gt: (new Date((new Date()).getTime() - minsAgo * 60000))}});
     }*/
    console.log("new sub")
    this.autorun(function() {
      console.log("updated sub: "+(currentTime.get() - (60*60*1000)));
      return txs.find({ "time": { $gte: currentTime.get() - (60*60*1000)} });
    });
  });



  SyncedCron.add({
    name: 'Clean export of bad files',
    schedule: function(parser) {
      // parser is a later.parse object
      return parser.text('every 10 minutes');
    },
    job: function() {
      console.log("doing job");
      var now = new Date((new Date()).getTime() - 60*60000);
      files.find().forEach(function (item) {
        if(item.time < now) {
          console.log("removing:"+item.txid);
          fs.unlinkSync(item.path);
          txs.remove({_id: item.txid});
          files.remove({txid: item.txid});
        }
      });
    }
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

  watcher.on('add',Meteor.bindEnvironment(function(path) {
    //console.log(path);
    newFile=fs.readFileSync(path,'utf8');
    let split = newFile.split(/\r?\n/);
    let tx = iota.utils.transactionObject(split[1]);

	  addTX(tx, path);

  }));

  SyncedCron.start();

});

function setDescendantsConfirmed(tx) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});
  if(tx1) {
    txs.update({_id: tx1._id}, { $set: {'confirmed': true}});
    setDescendantsConfirmed(tx1);
  }
  if(tx2) {
    txs.update({_id: tx2._id}, { $set: {'confirmed': true}});
    setDescendantsConfirmed(tx2);
  }
}

function addTX(tx, path) {
  tx.time = new Date();
  console.log("adding tx: "+tx.time);
  tx.confirmed = false;
  if (tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
    tx.confirmed = true;
    setDescendantsConfirmed(tx);
  }
  var doc = txs.upsert({hash: tx.hash}, tx);
  files.insert({txid: doc.insertedId, path: path, time: new Date()});
}

