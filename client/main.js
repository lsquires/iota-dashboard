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
  var width = 960,
      height = 500,
      nodeRadius = 5;

  var color  = d3.scale.category20();

  var force = cola.d3adaptor()
      .size([width, height])
      .nodes([{}])
      .avoidOverlaps(true)
      .on("tick", tick)
      .flowLayout("y", 30)
      .symmetricDiffLinkLengths(6);

  var svg = d3.select("#nodebox").append("svg")
      .attr("width", width)
      .attr("height", height)
      .on("mousemove", mousemove)
      .on("mousedown", mousedown);

  svg.append("rect")
      .attr("width", width)
      .attr("height", height);

  var nodes = force.nodes(),
      links = force.links();

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
          var node = {x: 10, y: 10, name: fields.hash, id: id};
          nodes.push(node);
          nodes.forEach(function(target){
            if(target.name == fields.branchTransaction || target.name == fields.trunkTransaction) {
              links.push({source: node, target: target});
              }
            });
          restart();
        },
          changed: function(id, fields) {

          },
          removed: function(id) {
            for(var i = array.length - 1; i >= 0; i--) {
              if(array[i].id === id) {
                array.splice(i, 1);
              }
            }
            restart();
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
                    sourcePadding = nodeRadius,
                    targetPadding = nodeRadius + 2,
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
    /*link = link.data(links);

    link.enter().insert("line", ".node")
        .attr("class", "link");

    node = node.data(nodes);

    node.enter().insert("circle", ".cursor")
        .attr("class", "node")
        .attr("r", 5)
        .call(force.drag);*/


    // define arrow markers for graph links
    svg.append('svg:defs').append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 6)
      .attr('markerWidth', 3)
      .attr('markerHeight', 3)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#000');

    var path = svg.selectAll(".link")
      .data(links)
      .enter().append('svg:path')
      .attr('class', 'link');

    var node = svg.selectAll(".node")
      .data(nodes)
      .enter().append("circle")
      .attr("class", "node")
      .attr("r", nodeRadius)
      .style("fill", function (d) { return color(d.group); })
      .call(force.drag);

    node.append("title")
      .text(function (d) { return d.name; });


    force.start(10,20,20);
    }
}
