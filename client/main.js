import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import { Mongo } from 'meteor/mongo';
import './main.html';
txs = new Mongo.Collection('txs');

var cola = require("webcola");
var d3 = require('d3-3');

Template.hello.onCreated(function helloOnCreated() {
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
  var width = 1000,
    height = 9000,
    centerx = width/2,
    centery = height/2;

  var fill = d3.scale.category20();

  var force = cola.d3adaptor(d3)
    .size([width, height])
    .nodes([{}])
    .symmetricDiffLinkLengths(5)
    .avoidOverlaps(true)
    .flowLayout("y", 20)
    .on("tick", tick);

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

  var cursor = svg.append("circle")
    .attr("r", 30)
    .attr("transform", "translate(-100,-100)")
    .attr("class", "cursor");



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

  function tick() {
    link.attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });

    node.attr("cx", function(d) { return d.x; })
      .attr("cy", function(d) { return d.y; });
  }
  let initializing = true;
  Meteor.subscribe("txs");
  const handle =  txs.find().observeChanges({
          added: function(id, fields) {
          var node = {x: centerx, y: centery, name: fields.hash, id: id};
          nodes.push(node);
            nodes.forEach(function(target){
            if(target.name == fields.branchTransaction || target.name == fields.trunkTransaction) {
              links.push({source: node, target: target});
              }
            });
            if(!initializing) {
              restart();
            }
        },
          changed: function(id, fields) {

          },
          removed: function(id) {
            for(var i = nodes.length - 1; i >= 0; i--) {
              if(nodes[i].id === id) {
                nodes.splice(i, 1);
                //Delete links
                for(var i2 = links.length - 1; i2 >= 0; i2--) {
                  if(links[i2].source === i || links[i2].target === i) {
                    links.splice(i2, 1);
                  }
                }
              }
            }
            restart();
          }
        });
  initializing = false;
  restart();
  function restart() {
    link = link.data(links);

    link.enter().insert("line", ".node")
      .attr("class", "link");

    node = node.data(nodes);

    node.enter().insert("circle", ".cursor")
      .attr("class", "node")
      .attr("r", 5)
      .call(force.drag);

    force.start();
  }


}
