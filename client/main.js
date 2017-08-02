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
    graph = {nodes: [],
             links: []};
  var color = d3.scale.category20();

  var d3cola = cola.d3adaptor(d3)
    .avoidOverlaps(true)
    .size([width, height]);

  var svg = d3.select("#nodebox").append("svg")
    .attr("width", width)
    .attr("height", height);


    var nodeRadius = 5;

    graph.nodes.forEach(function (v) { v.height = v.width = 2 * nodeRadius; });

    d3cola
      .nodes(graph.nodes)
      .links(graph.links)
      .flowLayout("y", 30)
      .symmetricDiffLinkLengths(6)

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
    .data(graph.links)
    .enter().append('svg:path')
    .attr('class', 'link');

  var node = svg.selectAll(".node")
    .data(graph.nodes)
    .enter().append("circle")
    .attr("class", "node")
    .attr("r", nodeRadius)
    .style("fill", function (d) { return color(d.group); })
    .call(d3cola.drag);

  node.append("title")
    .text(function (d) { return d.name; });

    d3cola.on("tick", function () {
      // draw directed edges with proper padding from node centers
      path.attr('d', function (d) {
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

      node.attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; });
    });

  restart();


  txs.find().observeChanges({
          added: function(id, fields) {
          var node = {x: 10, y: 10, name: fields.hash, id: id};
          graph.nodes.push(node);
            graph.nodes.forEach(function(target){
            if(target.name == fields.branchTransaction || target.name == fields.trunkTransaction) {
              graph.links.push({source: node, target: target});
              }
            });
          restart();
        },
          changed: function(id, fields) {

          },
          removed: function(id) {
            for(var i = graph.nodes.length - 1; i >= 0; i--) {
              if(graph.nodes[i].id === id) {
                graph.nodes.splice(i, 1);
                //Delete links
                for(var i2 = graph.links.length - 1; i2 >= 0; i2--) {
                  if(graph.links[i2].source === i || graph.links[i2].target === i) {
                    graph.links.splice(i2, 1);
                  }
                }
              }
            }
            restart();
          }
        });
  Meteor.subscribe("txs");

  function restart() {
    console.log(graph.nodes);
    console.log(graph.links);
    var path = svg.selectAll(".link")
      .data(graph.links)
      .enter().append('svg:path')
      .attr('class', 'link');

    var node = svg.selectAll(".node")
      .data(graph.nodes)
      .enter().append("circle")
      .attr("class", "node")
      .attr("r", nodeRadius)
      .style("fill", function (d) { return color(d.group); })
      .call(d3cola.drag);

    node.append("title")
      .text(function (d) { return d.name; });

    d3cola.start(10,20,20);
  }
}
