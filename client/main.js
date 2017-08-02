import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Mongo } from 'meteor/mongo';
import './main.html';
//import './d3.v3.js';
txs = new Mongo.Collection('txs');

var cola = require("webcola");
var d3 = require('d3-3');

//Meteor.subscribe('txs');

Template.hello.onCreated(function helloOnCreated() {
  // counter starts at 0
  this.counter = new ReactiveVar(0);
});

Template.hello.helpers({
  counter() {
    return Template.instance().counter.get();
  },
});

Template.hello.events({
  'click button'(event, instance) {
    // increment the counter when button is clicked
    instance.counter.set(instance.counter.get() + 1);
  },
});
Template.vis.rendered = function () {
var width = 960,
    height = 500;

var color  = d3.scale.category20();

var force = cola.d3adaptor()
    //d3.layout.force()
    .size([width, height])
    .nodes([{}]) // initialize with a single node
    //.linkDistance(20)
    //.constraints([{"axis":"y", "left":0, "right":1, "gap":25}])
    .avoidOverlaps(true)
    //.symmetricDiffLinkLengths(5)    
//.charge(-60)
    .on("tick", tick)
     .flowLayout("y", 30)
            .symmetricDiffLinkLengths(6)
            //.start(20,20,20);

var svg = d3.select("#nodebox").append("svg")
    .attr("width", width)
    .attr("height", height)
    .on("mousemove", mousemove)
    .on("mousedown", mousedown);

svg.append("rect")
    .attr("width", width)
    .attr("height", height);

var nodes = force.nodes(),
    links = force.links(),
    node = svg.selectAll(".node"),
    link = svg.selectAll(".link");
	node.style("fill", function (d) { return color(d.group); })

var cursor = svg.append("circle")
    .attr("r", 30)
    .attr("transform", "translate(-100,-100)")
    .attr("class", "cursor");

restart();

function mousemove() {
  cursor.attr("transform", "translate(" + d3.mouse(this) + ")");
}

function mousedown() {
  var point = d3.mouse(this),
      node = {x: point[0], y: point[1]},
      n = nodes.push(node);

  // add links to any nearby nodes
  nodes.forEach(function(target) {
    var x = target.x - node.x,
        y = target.y - node.y;
    if (Math.sqrt(x * x + y * y) < 30) {
      links.push({source: node, target: target});
    }
  });

  restart();
}

txs.find().observeChanges({
        added: function(id, fields) {
          //console.log('doc inserted');
	var node = {x: 10, y: 10, name: fields.hash};
	nodes.push(node);
	nodes.forEach(function(target){
	if(target.name == fields.branchTransaction || target.name == fields.trunkTransaction) {
	links.push({source: node, target: target});
	}
	});
	restart();        
},
        changed: function(id, fields) {
          //console.log('doc updated');
        },
        removed: function() {
          //console.log('doc removed');
        }
      });
Meteor.subscribe("txs");

function tick() {
  link.attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; })
      .attr('d', function (d) {
                var deltaX = d.target.x - d.source.x,
                    deltaY = d.target.y - d.source.y,
                    dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                    normX = deltaX / dist,
                    normY = deltaY / dist,
                    sourcePadding = 2,
                    targetPadding = 4,
                    sourceX = d.source.x + (sourcePadding * normX),
                    sourceY = d.source.y + (sourcePadding * normY),
                    targetX = d.target.x - (targetPadding * normX),
                    targetY = d.target.y - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
            });
  node.attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
}

function restart() {
  link = link.data(links);

  link.enter().insert("line", ".node")
      .attr("class", "link");

  node = node.data(nodes);

  node.enter().insert("circle", ".cursor")
      .attr("class", "node")
      .attr("r", 5)
      .call(force.drag);

  force.start(5,10,15);
}
}
