import {Meteor} from 'meteor/meteor';
import {Mongo} from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var COOR = 'KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU';
var txs = new Mongo.Collection('txs');
var files = new Mongo.Collection('files');
let currentTime = new ReactiveVar(new Date().valueOf());


txs.remove({});
files.remove({});


Meteor.startup(() => {
  console.log("server");

  Meteor.setInterval(function () {
    currentTime.set(new Date().valueOf());
  }, 1000);

  Meteor.publish('txs', function () {
    var self = this;
    self.autorun(function () {
      var minsago = self.data('minsago') || 1;
      check(minsago, Number);

      var confirmedonly = self.data('confirmedonly') || false;
      check(confirmedonly, Boolean);

      if (confirmedonly) {
        return txs.find({
          $and: [
            {"time": {$gte: currentTime.get() - (minsago * 60000)}},
            {"confirmed": {$eq: true}}]
        });
      } else {
        return txs.find({"time": {$gte: currentTime.get() - (minsago * 60000)}});
      }

    });
  });


  SyncedCron.add({
    name: 'Clean export of bad files and graph data',
    schedule: function (parser) {
      return parser.text('every 10 minutes');
    },
    job: function () {

      //Cleaning DB
      console.log("doing job");
      var now = new Date((new Date()).getTime() - 120 * 60000);
      files.find().forEach(function (item) {
        if (item.time < now) {
          console.log("removing:" + item.txid);
          fs.unlinkSync(item.path);
          txs.remove({_id: item.txid});
          files.remove({txid: item.txid});
        }
      });

      //Record metrics

    }
  });


  var iota = new IOTA({
    'host': 'http://localhost',
    'port': 14265
  });

  iota.api.getNodeInfo(function (error, success) {
    if (error) {
      console.log(error)
    } else {
      console.log(success)
    }
  });

  console.log('/home/lsquires/iri/target/export/');
  var watcher = chokidar.watch('/home/lsquires/iri/target/export/', {
    ignored: /[\/\\]\./, persistent: true
  });

  watcher.on('add', Meteor.bindEnvironment(function (path) {
    //console.log(path);
    newFile = fs.readFileSync(path, 'utf8');
    let split = newFile.split(/\r?\n/);
    let tx = iota.utils.transactionObject(split[1]);
    addTX(tx, path);
  }));

  SyncedCron.start();

});

function setDescendantsConfirmed(tx) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});
  if (tx1 && !tx1.confirmed) {
    txs.update({_id: tx1._id}, {$set: {'confirmed': true}});
    setDescendantsConfirmed(tx1);
  }
  if (tx2 && !tx2.confirmed) {
    txs.update({_id: tx2._id}, {$set: {'confirmed': true}});
    setDescendantsConfirmed(tx2);
  }
}

function addTX(tx, path) {
  tx.time = new Date().valueOf();
  console.log("adding tx: " + tx.time);
  tx.confirmed = false;

  var coor = false;
  if (tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
    coor = true;
    tx.confirmed = true;
  }
  var doc = txs.upsert({hash: tx.hash}, tx);
  files.insert({txid: doc.insertedId, path: path, time: new Date().valueOf()});

  if (coor) {
    console.log("new coor message!!!!")
    setDescendantsConfirmed(tx);
  }
}

