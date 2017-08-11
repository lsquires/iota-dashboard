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

  function deleteFilesInFolder(path) {
    var deleteBy = ((new Date()).valueOf() - 120*60*1000)*1000;
    if( fs.existsSync(path) ) {
      fs.readdirSync(path).forEach(function(file,index){
        var curPath = path + "/" + file;
        //console.log("comparing "+parseInt(file.split('.')[0])+","+deleteBy);
        //if(parseInt(file.split('.')[0]) < deleteBy) {
          fs.unlinkSync(curPath);
        //}


      });
    }
  }

  deleteFilesInFolder('/home/lsquires/iri/target/export/');
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
        return txs.find(
          {
          $and: [
            {"time": {$gte: currentTime.get() - (minsago * 60000)}},
            {"confirmed": {$eq: true}}]
          },
          {
            fields: { tip: 0, confirmed: 0}
          });
      } else {
        return txs.find(
          {
            "time": {$gte: currentTime.get() - (minsago * 60000)}
          },
          {
            fields: { tip: 0, confirmed: 0}
          });
      }

    });
  });


  SyncedCron.add({
    name: 'Clean export of bad files and graph data',
    schedule: function (parser) {
      return parser.recur().every(10).minute();
    },
    job: function () {

      //Cleaning DB
      var doMetrics = false;
      console.log("doing job");
      var now = (new Date()).valueOf() - 120 * 60000;
      files.find().forEach(function (item) {
        if (item.time < now) {
          console.log("removing:" + item.txid);
          fs.unlinkSync(item.path);
          txs.remove({_id: item.txid});
          files.remove({txid: item.txid});
          doMetrics = true;
        }
      });

      //Record metrics
      if(doMetrics) {

      }
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

function setChildrenConfirmed(tx) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});
  if (tx1 && !tx1.confirmed) {
    txs.update({_id: tx1._id}, {$set: {'confirmed': true}});
    setChildrenConfirmed(tx1);
  }
  if (tx2 && !tx2.confirmed) {
    txs.update({_id: tx2._id}, {$set: {'confirmed': true}});
    setChildrenConfirmed(tx2);
  }
}

function setChildren(tx) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});

  if (tx1) {
    txs.update({_id: tx1._id}, {$set: {'tip': false}});
  }
  if (tx2) {
    txs.update({_id: tx2._id}, {$set: {'tip': false}});
  }

  if(tx.confirmed) {
    if (tx1 && !tx1.confirmed) {
      txs.update({_id: tx1._id}, {$set: {'confirmed': true}});
      setChildrenConfirmed(tx1);
    }
    if (tx2 && !tx2.confirmed) {
      txs.update({_id: tx2._id}, {$set: {'confirmed': true}});
      setChildrenConfirmed(tx2);
    }
  }
}

function checkParents(tx) {
  let parents = txs.find({ $or : [
    {branchTransaction: tx.hash},
    {trunkTransaction: tx.hash}
    ]});
  parents.forEach((parent) => {
    tx.tip = false;
    if(parent.confirmed) {
      tx.confirmed = true;
    }
  })
}

function addTX(tx, path) {
  tx.time = new Date().valueOf();
  console.log("adding tx: " + tx.time);
  tx.confirmed = false;
  tx.tip = true;

  checkParents(tx);

  if (tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
    tx.confirmed = true;
    console.log("new coor message!!!!")
  }
  var doc = txs.upsert({hash: tx.hash}, tx);
  files.insert({txid: doc.insertedId, path: path, time: new Date().valueOf()});

  setChildren(tx);
}

