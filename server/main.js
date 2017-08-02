import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
var chokidar = require('chokidar');
var fs = Npm.require('fs');
var IOTA = require('iota.lib.js');
var COOR = 'KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU';
var txs = new Mongo.Collection('txs');
txs.remove({});

function deleteBeforeMilestone() {
} 

Meteor.startup(() => {
  console.log("server");
	
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
    let sender = split[0];
    let tx = iota.utils.transactionObject(split[1]);
	//Meteor.wrapAsync(txs.insert(tx));
	//tx._id = tx.hash;	
	addTX(tx);
	//txs.upsert({hash: tx.hash},tx);
	
    	/*if(tx.address === COOR) {
		console.log("MILESTONE");
		txs.insert(tx);
		} else {
	
		}*/
    //console.log(transacation);
  }));
// code to run on server at startup
});

function addTX(tx) {
  console.log("adding tx"); 
txs.upsert({hash: tx.hash}, tx);
console.log(txs.find().count());
}

