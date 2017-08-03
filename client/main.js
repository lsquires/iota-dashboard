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
  var width = 900,
    height = 500,
    centerx = width/2,
    centery = height/2,
    nodeRadius = 5;

  var fill = d3.scale.category20();

  var force = cola.d3adaptor(d3)
    .size([width, height])
    .nodes([])
    .symmetricDiffLinkLengths(7)
    .avoidOverlaps(true)
    .flowLayout("y", 25)
    .on("tick", tick);

  var svg = d3.select("#nodebox").append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("id","canvas")
    .call(d3.behavior.zoom().scaleExtent([1, 8]).on("zoom", zoom))
    .append("g")
    .call(d3.behavior.zoom().scaleExtent([1, 8]).on("zoom", zoom))
    .append("g");

  svg.append("rect")
    .attr("width", width)
    .attr("height", height);

  var nodes = force.nodes(),
    links = force.links(),
    node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

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



  function tick() {
    link.attr('d', function (d) {
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
  let initializing = true;
  Meteor.subscribe("txs");
  const handle =  txs.find().observeChanges({
          added: function(id, fields) {
          var node = {x: centerx, y: centery, tx: fields, id: id, colour: getColour(fields)};
          nodes.push(node);
            nodes.forEach(function(target){
            if(target.tx.hash == fields.branchTransaction || target.tx.hash == fields.trunkTransaction) {
              links.push({source: node, target: target});
              }
            });
            if(!initializing) {
              restart();
            }
        },
          changed: function(id, fields) {
            console.log("changed");
            nodes.forEach(function(target) {
              if(nodes.tx.hash = fields.hash) {
                nodes.colour = getColour(fields);
              }
            });
            restart();
          },
          removed: function(id) {
            for(var i = nodes.length - 1; i >= 0; i--) {
              if(nodes[i].id === id) {
                //Delete links
                for(var i2 = links.length - 1; i2 >= 0; i2--) {
                  if(links[i2].source.id === id || links[i2].target.id === id) {
                    links.splice(i2, 1);
                  }
                }
                nodes.splice(i, 1);
                break;
              }
            }
            //d3.event.stopPropagation();
            restart();
          }
        });
  initializing = false;
  restart();

  function getColour(tx) {
    if(tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
      return "red";
    }
    return "blue";
  }

  function zoom() {
    var zoom = d3.event;
    svg.attr("transform", "translate(" + zoom.translate + ")scale(" + zoom.scale + ")");
  }

  function restart() {

    node = node.data(nodes);
    node.enter().insert("circle", ".cursor")
      .attr("class", "node")
      .attr("r", nodeRadius)
      .call(force.drag);
    node.style("fill", function (d) { return d.colour; });
    node.exit()
      .remove();

    link = link.data(links);
    link.enter().append('svg:path')
      .attr("class", "link");
    link.exit()
      .remove();

    force.start();
  }


}
