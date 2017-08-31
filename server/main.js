import {Meteor} from 'meteor/meteor';
import {Mongo} from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var txs = new Mongo.Collection('txs');
var stats = new Mongo.Collection('stats');
var histographstats = new Mongo.Collection('histstats');
var d3 = require('d3');
let currentTime = new ReactiveVar(new Date().valueOf());


//txs.remove({});

//stats.remove({});
//histographstats.remove({});

/*histographstats.update({set: true}, { $set: {
 peakTXs: stats.find({},{limit: 1, sort: {TXs: -1}}).fetch()[0].TXs,
 peakCTXs: stats.find({},{limit: 1, sort: {cTXs: -1}}).fetch()[0].cTXs,
 peakVol: stats.find({},{limit: 1, sort: {totalTX: -1}}).fetch()[0].totalTX,
 peakPercent: 0.7947,
 peakTime: stats.find({},{limit: 1, sort: {averagectimefiltered: 1}}).fetch()[0].averagectimefiltered
 }
 });*/

Meteor.startup(() => {

  console.log("server");
  console.log("loaded tx db of size: " + txs.find().count());
  console.log("loaded stats db of size: " + stats.find().count());
  Meteor.setInterval(function () {
    currentTime.set(new Date().valueOf());
  }, 1000);

  Meteor.publish('histstats', function () {
    return histographstats.find({});
  });

  Meteor.publish('stats', function () {
    var self = this;
    self.autorun(function () {
      var from = self.data('statsfrom') || (currentTime.get() - (24 * 60 * 60000) );
      check(from, Number);
      var to = self.data('statsto') || currentTime.get();
      check(to, Number);

      let interval = to - from;
      //If range is more than 5 days, switch to daily stats
      let period = (interval > 5 * 24 * 60 * 60000) ? 24 * 60 : 30;

      return stats.find({
          $and: [
            {"date": {$gte: from}},
            {"date": {$lte: to}},
            {"period": {$eq: period}}]
        },
        {
          fields: {averagectimestamp: 0, totalUnconfirmedNonTippedTX: 0}
        });
    });
  });

  Meteor.publish('txs', function () {
    var self = this;
    self.autorun(function () {
      var secsago = self.data('secsago') || 60;
      check(secsago, Number);

      var confirmedonly = self.data('confirmedonly') || false;
      check(confirmedonly, Boolean);

      var fastmode = self.data('fastmode') || false;
      check(fastmode, Boolean);
      fields = {tip: 0, confirmed: 0, milestone: 0, ctime: 0, ctimestamp: 0};
      if(fastmode) {
        fields = {hash: 1, address: 1, trunkTransaction: 1, branchTransaction: 1, bundle: 1};
      }

      if (confirmedonly) {
        return txs.find(
          {
            $and: [
              {"time": {$gte: currentTime.get() - (secsago * 1000)}},
              {"confirmed": {$eq: true}}]
          },
          {
            "fields": fields
          });
      } else {
        return txs.find(
          {
            "time": {$gte: currentTime.get() - (secsago * 1000)}
          },
          {
            "fields": fields
          });
      }

    });
  });


  SyncedCron.add({
    name: '10 Minute stats',
    schedule: function (parser) {
      return parser.recur().every(10).minute();
    },
    job: function () {
      var startTime = (new Date()).valueOf();
      var periodMinutes = 24 * 60;
      console.log("doing job, db size: " + txs.find().count());
      var now = startTime - periodMinutes * 60000;

      //Record metrics
      console.log("doing 10min metrics");

      //No of txs in range
      var totalTX = txs.find({"time": {$gte: now}}).count();
      var totalConfirmedTX = txs.find({
        $and: [
          {"ctime": {$gte: now}},
          {"confirmed": {$eq: true}}]
      }).count();

      //No of transactions confirmed in range
      var totalConfirmedInRangeTX = txs.find({
        $and: [
          {"time": {$gte: now}},
          {"confirmed": {$eq: true}}]
      }).count();

      //No of transactions in range that are now confirmed
      var totalTipTX = txs.find({
        $and: [
          {"time": {$gte: now}},
          {"tip": {$eq: true}}]
      }).count();

      //No of transactions in range that are unconfirmed
      var totalUnconfirmedNonTippedTX = totalTX - totalConfirmedInRangeTX - totalTipTX;

      var rawtimes = txs.find({
        $and: [
          {"ctime": {$gte: now}},
          {"confirmed": {$eq: true}},
          {"milestone": {$ne: true}}]
      }).fetch();

      var ctimes = rawtimes.map(function (element) {
        return (element.ctime - element.time) / 1000;
      });
      var ctimestamps = rawtimes.map(function (element) {
        return element.ctimestamp - element.timestamp;
      });

      function average(array) {
        var sum = 0;
        for (var i = 0; i < array.length; i++) {
          sum += array[i];
        }
        return sum / array.length;
      }

      function averageFiltered(array) {
        var sum = 0;
        let total = 0;
        for (var i = 0; i < array.length; i++) {
          if (ctimes[i] <= 3600) {
            sum += array[i];
            total++;
          }
        }
        return sum / total;
      }

      var averagectime = average(ctimes);
      var averagectimefiltered = averageFiltered(ctimes);
      var averagectimestamp = average(ctimestamps);


      var TXs = txs.find({"time": {$gte: startTime - (30 * 60000)}}).count() / (30 * 60);
      var cTXs = txs.find(
          {
            $and: [
              {"confirmed": {$eq: true}},
              {"ctime": {$gte: startTime - (30 * 60000)}}
            ]
          }).count() / (30 * 60);

      var toInsert = {
        date: startTime,
        totalTX: totalTX,
        totalConfirmedTX: totalConfirmedTX,
        totalTipTX: totalTipTX,
        totalUnconfirmedNonTippedTX: totalUnconfirmedNonTippedTX,
        averagectime: averagectime,
        averagectimefiltered: averagectimefiltered,
        averagectimestamp: averagectimestamp,
        cTXs: cTXs,
        TXs: TXs,
        period: 30
      };

      stats.insert(toInsert);
      console.log("NEW 10m Metrics:");
    }

  });

  SyncedCron.add({
    name: 'half day stats and cleaning of data',
    schedule: function (parser) {
      return parser.recur().every(12).hour();
    },
    job: function () {
      var startTime = (new Date()).valueOf();
      var periodMinutes = 24 * 60;
      console.log("doing job, db size: " + txs.find().count());
      var now = startTime - periodMinutes * 60000;

      //Cleaning DB
      console.log("cleaning db");
      var weekOld = startTime - 7 * 24 * 60 * 60000;
      txs.remove({time: {$lte: weekOld}});
      stats.remove({
        $and: [
          {period: {$eq: 30}},
          {time: {$lte: weekOld}}
        ]
      });

      //Record metrics
      console.log("doing day metrics");

      //No of txs in range
      var totalTX = txs.find({"time": {$gte: now}}).count();
      var totalConfirmedTX = txs.find({
        $and: [
          {"ctime": {$gte: now}},
          {"confirmed": {$eq: true}}]
      }).count();

      //No of transactions confirmed in range
      var totalConfirmedInRangeTX = txs.find({
        $and: [
          {"time": {$gte: now}},
          {"confirmed": {$eq: true}}]
      }).count();

      //No of transactions in range that are now confirmed
      var totalTipTX = txs.find({
        $and: [
          {"time": {$gte: now}},
          {"tip": {$eq: true}}]
      }).count();

      //No of transactions in range that are unconfirmed
      var totalUnconfirmedNonTippedTX = totalTX - totalConfirmedInRangeTX - totalTipTX;

      var rawtimes = txs.find({
        $and: [
          {"ctime": {$gte: now}},
          {"confirmed": {$eq: true}},
          {"milestone": {$ne: true}}]
      }).fetch();

      var ctimes = rawtimes.map(function (element) {
        return (element.ctime - element.time) / 1000;
      });
      var ctimestamps = rawtimes.map(function (element) {
        return element.ctimestamp - element.timestamp;
      });

      function average(array) {
        var sum = 0;
        for (var i = 0; i < array.length; i++) {
          sum += array[i];
        }
        return sum / array.length;
      }

      function averageFiltered(array) {
        var sum = 0;
        let total = 0;
        for (var i = 0; i < array.length; i++) {
          if (ctimes[i] <= 3600) {
            sum += array[i];
            total++;
          }
        }
        return sum / total;
      }

      var averagectime = average(ctimes);
      var averagectimefiltered = averageFiltered(ctimes);
      var averagectimestamp = average(ctimestamps);

      var outofrange = 0;
      var totalvalid = 0;
      for (let i = 0; i < ctimes.length; i++) {
        if (ctimes[i] > 500) {
          outofrange++;
        }
        if (ctimes[i] >= 0) {
          totalvalid++;
        }
      }
      var histGenerator = d3.histogram()
        .domain([0, 500])
        .thresholds(49);
      var ctimesbins = histGenerator(ctimes).map(function (e, index) {
        return {range: (index * 10), count: (e.length / totalvalid)};
      });

      var TXs = txs.find({"time": {$gte: startTime - (periodMinutes * 60000)}}).count() / (periodMinutes * 60);
      var cTXs = txs.find(
          {
            $and: [
              {"confirmed": {$eq: true}},
              {"ctime": {$gte: startTime - (periodMinutes * 60000)}}
            ]
          }).count() / (periodMinutes * 60);

      var toInsert = {
        date: startTime,
        totalTX: totalTX,
        totalConfirmedTX: totalConfirmedTX,
        totalTipTX: totalTipTX,
        totalUnconfirmedNonTippedTX: totalUnconfirmedNonTippedTX,
        averagectime: averagectime,
        averagectimefiltered: averagectimefiltered,
        averagectimestamp: averagectimestamp,
        cTXs: cTXs,
        TXs: TXs,
        period: periodMinutes
      };

      var peakData = histographstats.find({set: true}).fetch();
      var peakTXs = TXs,
        peakCTXs = cTXs,
        peakPercent = totalConfirmedTX / totalTX,
        peakTime = averagectimefiltered,
        peakVol = totalTX;

      if (peakData && peakData.length > 0) {
        peakTXs = Math.max(peakTXs, peakData[0].peakTXs);
        peakCTXs = Math.max(peakCTXs, peakData[0].peakCTXs);
        peakVol = Math.max(peakVol, peakData[0].peakVol);
        peakPercent = Math.max(peakPercent, peakData[0].peakPercent);
        peakTime = Math.min(peakTime, peakData[0].peakTime);
      }

      var doc = {
        set: true, ctimes: ctimesbins, outofrange: (outofrange / totalvalid),
        peakTXs: peakTXs, peakCTXs: peakCTXs, peakVol: peakVol, peakPercent: peakPercent, peakTime: peakTime
      };
      histographstats.upsert({set: true}, doc);
      stats.insert(toInsert);
      console.log("NEW half day Metrics:");
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

  //Watch export path for txs
  watcher.on('add', Meteor.bindEnvironment(function (path) {
    let newFile = fs.readFileSync(path, 'utf8');
    let split = newFile.split(/\r?\n/);
    let tx = iota.utils.transactionObject(split[1]);
    addTX(tx, path);
  }));

  SyncedCron.start();

  //WIP Search func
  /*Router.route("q", function () {
   var name = this.params.name,
   query = this.request.query,
   hash = query.hash;

   //iota.api.findTransactionObjects({}, callback)
   iota.valid.isTrytes(hash, function (error, success) {
   console.log(success);
   });


   }, {where: "server"});


   Meteor.methods({
   search: function (query) {


   }
   });*/
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


  function updateChild(origTX, childTX, ctime, ctimestamp) {
    if (childTX) {
      txs.update({_id: childTX._id}, {$set: {'tip': false}});
    }
    if (origTX.confirmed && childTX && !childTX.confirmed) {
      if (origTX.milestone && origTX.bundle === childTX.bundle) {
        txs.update({_id: childTX._id}, {$set: {'milestone': true}});
      }
      txs.update({_id: childTX._id}, {$set: {'confirmed': true, 'ctime': ctime, 'ctimestamp': ctimestamp}});
      setChildrenConfirmed(childTX, ctime, ctimestamp);
    }
  }

  updateChild(tx, tx1, ctime, ctimestamp);
  updateChild(tx, tx2, ctime, ctimestamp);
}

function checkParents(tx) {
  let parents = txs.find({
    $or: [
      {branchTransaction: tx.hash},
      {trunkTransaction: tx.hash}
    ]
  });

  let first = true;
  parents.forEach((parent) => {
    tx.tip = false;
    if (parent.confirmed) {
      tx.confirmed = true;
      if (first) {
        first = false;
        tx.ctime = parent.ctime;
        tx.ctimestamp = parent.ctimestamp;
      } else {
        tx.ctime = Math.min(tx.ctime, parent.ctime);
        tx.ctimestamp = Math.min(tx.ctimestamp, parent.ctimestamp);
      }
    }
    if (parent.milestone && parent.bundle === tx.bundle) {
      tx.milestone = true;
    }
  })
}

function addTX(tx, path) {
  //Extract time from the filename
  tx.time = (path.replace(/^.*[\\\/]/, '').split(".")[0] / 1000);

  console.log("adding tx: " + tx.time);
  tx.confirmed = false;
  tx.tip = true;

  //Check parents to see if it is already confirmed
  checkParents(tx);

  //Check if it is a coordinator message
  if (tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
    tx.confirmed = true;
    tx.ctime = tx.time;
    tx.ctimestamp = tx.timestamp;
    tx.milestone = true;
    console.log("new coor message!")
  }

  //Insert into db, upsert stops conflicts if tx is rebroadcasted
  var doc = txs.upsert({hash: tx.hash}, tx);

  //Set children as non tips and confirmed if necessary
  setChildren(tx, tx.ctime, tx.ctimestamp);

  //Delete tx file
  fs.unlinkSync(path);
}

