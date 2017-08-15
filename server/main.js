import {Meteor} from 'meteor/meteor';
import {Mongo} from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var COOR = 'KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU';
var txs = new Mongo.Collection('txs');
var stats = new Mongo.Collection('stats');
var histographstats = new Mongo.Collection('histstats');
var d3 = require('d3');
//var files = new Mongo.Collection('files');
let currentTime = new ReactiveVar(new Date().valueOf());


//txs.remove({});
//stats.remove({});


Meteor.startup(() => {

  function deleteFilesInFolder(path) {
    //var deleteBy = ((new Date()).valueOf() - 4*60*60*1000)*1000;
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

  //deleteFilesInFolder('/home/lsquires/iri/target/export/');
  console.log("server");
  console.log("loaded tx db of size: "+txs.find().count());
  console.log("loaded stats db of size: "+stats.find().count());
  Meteor.setInterval(function () {
    currentTime.set(new Date().valueOf());
  }, 1000);
  Meteor.publish('histstats', function() {
    return histographstats.find({});
  });
  Meteor.publish('stats', function() {
    return stats.find({});
  });
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
            fields: { tip: 0, confirmed: 0, milestone: 0}//, ctime: 0, ctimestamp: 0}
          });
      } else {
        return txs.find(
          {
            "time": {$gte: currentTime.get() - (minsago * 60000)}
          },
          {
            fields: { tip: 0, confirmed: 0, milestone: 0}//, ctime: 0, ctimestamp: 0}
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
      var startTime = (new Date()).valueOf();
      //Cleaning DB
      var doMetrics = false;
      var periodMinutes = 24 * 60;
      console.log("doing job, db size: "+txs.find().count());
      var now = startTime - periodMinutes * 60000;
      txs.find().forEach(function (item) {
        if (item.time < now) {
          console.log("removing:" + item._id);
          //fs.unlinkSync(item.path);
          txs.remove({_id: item._id});
          //files.remove({txid: item.txid});
          doMetrics = true;
        }
      });

      //Record metrics
      if(doMetrics || true) {
        console.log("doing metrics");

        var totalTX = txs.find({"time": {$gte: now}}).count();
        var totalConfirmedTX = txs.find({$and: [
          {"time": {$gte: now}},
          {"confirmed": {$eq: true}}]
        }).count();
        var totalTipTX = txs.find({$and: [
          {"time": {$gte: now}},
          {"tip": {$eq: true}}]
        }).count();
        var totalUnconfirmedNonTippedTX = totalTX - totalConfirmedTX - totalTipTX;

        var rawtimes = txs.find({$and: [
            {"time": {$gte: now}},
            {"confirmed": {$eq: true}},
            {"milestone": {$ne: true}}]
          }).fetch();

        var ctimes = rawtimes.map(function(element) {
          return (element.ctime - element.time) / 1000;
        });
        var ctimestamps = rawtimes.map(function(element) {
          return element.ctimestamp - element.timestamp;
        });

        function average(array) {
          var sum = 0;
          for (var i = 0; i < array.length; i++) {
            sum += array[i];
          }
          return sum / array.length;
        }

        var averagectime = average(ctimes);
        var averagectimestamp = average(ctimestamps);

        var outofrange = 0;
        var totalvalid = 0;
        for(let i = 0; i < ctimes.length; i++) {
          if(ctimes[i] > 500) {
            outofrange++;
          }
          if(ctimes[i] >= 0) {
            totalvalid++;
          }
        }
        var histGenerator = d3.histogram()
          .domain([0,500])
          .thresholds(49);
        var ctimesbins = histGenerator(ctimes).map(function(e, index){return {range: (index*10), count: (e.length / totalvalid)*100};});

        var TXs =  txs.find({"time": {$gte: startTime - (30 * 60000)}}).count() / (30 * 60);
        var cTXs = txs.find(
          {
            $and:
              [
              {"confirmed": {$eq: true}},
              {"ctime": {$gte: startTime - (30 * 60000)}}
              ]
        }).count() / (30 * 60);

        var toInsert = {date: startTime,
          totalTX: totalTX,
          totalConfirmedTX: totalConfirmedTX,
          totalTipTX: totalTipTX,
          totalUnconfirmedNonTippedTX: totalUnconfirmedNonTippedTX,
          averagectime: averagectime,
          averagectimestamp: averagectimestamp,
          cTXs: cTXs,
          TXs: TXs};

        var doc = {set: true, ctimes: ctimesbins, outofrange: outofrange};
        histographstats.upsert({set: true}, doc);
        stats.insert(toInsert);

        console.log("NEW v3 Metrics:");
        //console.log(toInsert);
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

function setChildrenConfirmed(tx, ctime, ctimestamp) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});
  if (tx1 && !tx1.confirmed) {
    txs.update({_id: tx1._id}, {$set: {'confirmed': true, 'ctime': ctime, 'ctimestamp': ctimestamp}});
    setChildrenConfirmed(tx1, ctime, ctimestamp);
  }
  if (tx2 && !tx2.confirmed) {
    txs.update({_id: tx2._id}, {$set: {'confirmed': true, 'ctime': ctime, 'ctimestamp': ctimestamp}});
    setChildrenConfirmed(tx2, ctime, ctimestamp);
  }
}

function setChildren(tx, ctime, ctimestamp) {
  let tx1 = txs.findOne({hash: tx.branchTransaction});
  let tx2 = txs.findOne({hash: tx.trunkTransaction});

  if (tx1) {
    txs.update({_id: tx1._id}, {$set: {'tip': false}});
  }
  if (tx2) {
    txs.update({_id: tx2._id}, {$set: {'tip': false}});
  }

  if (tx.confirmed) {
    if (tx1 && !tx1.confirmed) {
      if(tx.milestone && tx.bundle === tx1.bundle) {
        txs.update({_id: tx1._id}, {$set: {'milestone': true}});
      }
      txs.update({_id: tx1._id}, {$set: {'confirmed': true, 'ctime': ctime, 'ctimestamp': ctimestamp}});
      setChildrenConfirmed(tx1, ctime, ctimestamp);
    }
    if (tx2 && !tx2.confirmed) {
      if(tx.milestone && tx.bundle === tx2.bundle) {
        txs.update({_id: tx2._id}, {$set: {'milestone': true}});
      }
      txs.update({_id: tx2._id}, {$set: {'confirmed': true, 'ctime': ctime, 'ctimestamp': ctimestamp}});
      setChildrenConfirmed(tx2, ctime, ctimestamp);
    }
  }
}

function checkParents(tx) {
  let parents = txs.find({ $or : [
    {branchTransaction: tx.hash},
    {trunkTransaction: tx.hash}
    ]});

  let first = true;
  parents.forEach((parent) => {
    tx.tip = false;
    if(parent.confirmed) {
      tx.confirmed = true;
      if(first) {
        first = false;
        tx.ctime = parent.ctime;
        tx.ctimestamp = parent.ctimestamp;
      } else {
        tx.ctime = Math.min(tx.ctime, parent.ctime);
        tx.ctimestamp = Math.min(tx.ctimestamp, parent.ctimestamp);
      }
    }
    if(parent.milestone && parent.bundle === tx.bundle) {
      tx.milestone = true;
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
    tx.ctime = tx.time;
    tx.ctimestamp = tx.timestamp;
    tx.milestone = true;
    console.log("new coor message!!!!")
  }
  var doc = txs.upsert({hash: tx.hash}, tx);
  //files.insert({txid: doc.insertedId, path: path, time: new Date().valueOf()});

  setChildren(tx, tx.ctime, tx.ctimestamp);
  fs.unlinkSync(path);
}

