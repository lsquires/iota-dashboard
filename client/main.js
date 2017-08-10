import { Template } from 'meteor/templating';
import { Mongo } from 'meteor/mongo';
import './main.html';
txs = new Mongo.Collection('txs');
var cola = require("webcola");
var d3 = require('d3-3');
txshandler = {};
dbwatcher = {};
minsAgo = 1;
filterConfirmed = false;
nextClean = new Date();
toRestart = true;

Router.route('/', {name:"Home"},function () {
  this.render('Home');
});
Router.route('/About');
Router.route('/Stats');
Router.route('/Contact');

Template.registerHelper('navClassName', function (page) {
  if (Router.current()) {
    return Router.current().route.getName() === page ? "active" : "";
  }
});

Template.Home.events({
  "change #timePeriod": function(event, template){
    let selectValue = parseInt(template.$("#timePeriod").val(),10);
    console.log(selectValue);
    txshandler.setData('minsago', selectValue);
  },
  "change #filter": function(event, template){
    let selectValue = template.$("#filter").val();

    if(selectValue == "all") {
      if(filterConfirmed) {
        filterConfirmed = false;
        txshandler.setData('confirmedonly', false);
      }
    } else if(selectValue == "confirmed"){
      if(!filterConfirmed) {
        filterConfirmed = true;
        txshandler.setData('confirmedonly', true);
      }
    }

    console.log(selectValue);
  }
});

Template.transactioninfo.onCreated(function () {
  txhash = new ReactiveVar("");
  txtimestamp = new ReactiveVar("");
  txtag = new ReactiveVar("");
  txaddress = new ReactiveVar("");
  txvalue = new ReactiveVar(0);
  txbundle = new ReactiveVar("");
  txmessage = new ReactiveVar("");
  txconfirmed = new ReactiveVar("");
  txbranch = new ReactiveVar("");
  txtrunk = new ReactiveVar("");
});

Template.transactioninfo.helpers({
  txhash: function () {
    return txhash.get();
  },
  txtimestamp: function () {
    return txtimestamp.get();
  },
  txtag: function () {
    return txtag.get();
  },
  txaddress: function () {
    return txaddress.get();
  },
  txvalue: function () {
    return txvalue.get();
  },
  txbundle: function () {
    return txbundle.get();
  },
  txmessage: function () {
    return txmessage.get();
  },
  txconfirmed: function () {
    return txconfirmed.get();
  },
  txtrunk: function () {
    return txtrunk.get();
  },
  txbranch: function () {
    return txbranch.get();
  }
});

function cleanTXS() {
  /*if(new Date() > nextClean) {
    nextClean = new Date((new Date()).getTime() + 10000)
    console.log("doing job cs "+minsAgo);
    var now = new Date((new Date()).getTime() - minsAgo * 60000);
    txs.find().forEach(function (item) {
      if (item.time < now) {
        txs._collection.remove(item._id);
      }
    })
  }*/
}

function forceCleanTXS() {
    /*nextClean = new Date((new Date()).getTime() + 10000)
    console.log("doing job cs "+minsAgo);
    var now = new Date((new Date()).getTime() - minsAgo * 60000);
    txs.find().forEach(function (item) {
      if (item.time < now) {
        txs._collection.remove(item._id);
      }
    })*/

}

Template.vis.rendered = function () {
  var focused;
  var selected;
  startSim(document.getElementById('nodebox').clientWidth);
  function startSim(w) {
    var isFocused = false;
    var width = w,
      height = 300,
      centerx = width / 2,
      centery = height / 2,
      nodeRadius = 8;

    var fill = d3.scale.category20();

    var force = cola.d3adaptor(d3)
      .size([width, height])
      .nodes([])
      .symmetricDiffLinkLengths(8)
      .avoidOverlaps(true)
      .flowLayout("x", 30)
      .on("tick", tick);

    var hover = d3.select("#graph_hover");
    var svg = d3.select("#nodebox").append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("id", "canvas")
      .call(d3.behavior.zoom().scaleExtent([0.1, 8]).on("zoom", zoom))
      .append("g")
      .call(d3.behavior.zoom().scaleExtent([0.1, 8]).on("zoom", zoom))
      .append("g");

    svg.style("cursor","move");

    var rect = svg.append("rect")
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

    $(window).resize(function() {
      console.log("resized");
      width = document.getElementById('nodebox').clientWidth;
      centerx = width / 2,
      force.size([width, height]);
      svg.attr("width", width)
        .attr("height", height);
      rect.attr("width", width)
        .attr("height", height);
    });

    function tick() {
      link.attr('d', function (d) {
        var deltaX = d.source.x - d.target.x,
          deltaY = d.source.y - d.target.y,
          dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
          normX = deltaX / dist,
          normY = deltaY / dist,
          sourcePadding = nodeRadius,
          targetPadding = nodeRadius + 2,
          sourceX = d.target.x + (sourcePadding * normX),
          sourceY = d.target.y + (sourcePadding * normY),
          targetX = d.source.x - (targetPadding * normX),
          targetY = d.source.y - (targetPadding * normY);
        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
      });

      node.attr("cx", function (d) {
        return d.x;
      })
        .attr("cy", function (d) {
          return d.y;
        });
    }

    let initializing = true;
    txshandler = Meteor.subscribe("txs");

    dbwatcher = txs.find().observeChanges({
      added: function (id, fields) {
          var node = {x: centerx, y: centery, tx: fields, id: id, colour: getColour(fields)};
          nodes.push(node);
          nodes.forEach(function (target) {
            if (target.tx.hash == fields.branchTransaction || target.tx.hash == fields.trunkTransaction) {
              links.push({source: target, target: node});
            } else if(fields.hash == target.tx.branchTransaction || fields.hash == target.tx.trunkTransaction) {
              links.push({source: node, target: target});
            }
          });
         schedulerestart();

      },
      changed: function (id, fields) {
        for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].id === id) {
            nodes[i].tx.confirmed = true;
            nodes[i].colour = getColour(nodes[i].tx);
            schedulerestart();
            break;
          }
        }
      },
      removed: function (id) {
        console.log("removed id");
        for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].id === id) {
            //Delete links
            for (var i2 = links.length - 1; i2 >= 0; i2--) {
              if (links[i2].source.id === id || links[i2].target.id === id) {
                links.splice(i2, 1);
              }
            }
            nodes.splice(i, 1);
            schedulerestart();
            break;
          }
        }
      }
    });
    console.log(dbwatcher);
    toRestart = true;
    restart();


    function getColour(tx) {
      if (tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
        return "red";
      } else if (tx.confirmed) {
        return "orange";
      } else {
        return "blue";
      }
    }

    function zoom() {
      var zoom = d3.event;
      svg.attr("transform", "translate(" + zoom.translate + ")scale(" + zoom.scale + ")");
    }
    function isConnected(a, b) {
      return a.tx.hash == b.tx.branchTransaction ||
        a.tx.hash == b.tx.trunkTransaction ||
        b.tx.hash == a.tx.branchTransaction ||
        b.tx.hash == a.tx.trunkTransaction ||
        a.id == b.id;
    }

    function schedulerestart() {
      restart();
    }

    function restart() {

      node = node.data(nodes, function(d) { return d.id;});
      link = link.data(links, function(d) { return d.source.id + "-" + d.target.id;} );


        node.enter().insert("circle", ".cursor")
          .attr("class", "node")
          .attr("r", nodeRadius)
          .attr("id", function(d) { return "a"+d.id; })
          .call(force.drag)
          .on("mouseover", function (d) {
            svg.style("cursor","pointer");
            focused = d;
            isFocused = true;
            node.style("opacity", function(o) {
              return isFocused ? (isConnected(focused, o) ? 1 : 0.2) : 1;
            }).on("mouseleave", function(d) {
              svg.style("cursor","move");
              isFocused = false;
              svg.style("cursor","move");
              link.style("opacity", 0.4);
              node.style("opacity", 1);
            });
            link.style("opacity", function(o) {
              return isFocused ? (o.source.id == focused.id || o.target.id == focused.id ? 0.8 : 0.12) : 0.4;
            });
          }).on("mousedown", function(d) {
          d3.event.stopPropagation()
          if(selected && !d3.select("#a"+selected).empty()) {
            d3.select("#a"+selected).transition().duration(200).attr("r", nodeRadius);
          }
          d3.select(this).transition().duration(200).attr("r", nodeRadius*1.5);
          selected = d.id;

          txhash.set(d.tx.hash);
          txtimestamp.set((new Date(d.tx.timestamp*1000)).toLocaleString());
          txtag.set(d.tx.tag);
          txaddress.set(d.tx.address);
          txvalue.set(d.tx.value);
          txbundle.set(d.tx.bundle)
          txmessage.set(d.tx.signatureMessageFragment);
          txconfirmed.set(d.tx.confirmed ? "true" : "false");
          txbranch.set(d.tx.branchTransaction)
          txtrunk.set(d.tx.trunkTransaction)
        });

      node.style("opacity", function(o) {
        return isFocused ? (isConnected(focused, o) ? 1 : 0.2) : 1;
      });

      node.style("fill", function (d) {
        return getColour(d.tx);
      });

      /*d3.select(window).on("mouseup",
        function() {
          isFocused = false;
          svg.style("cursor","move");
          link.style("opacity", 0.4);
          node.style("opacity", 1);
        });*/


        node.exit()
          .remove();



        link.enter().append('svg:path')
          .attr("class", "link");
        link.style("opacity", function(o) {
          return isFocused ? (o.source.id == focused.id  || o.target.id == focused.id  ? 0.8 : 0.12) : 0.4;
        });

        link.exit()
          .remove();


      force.start();

    }
  }


}
