import {Template} from 'meteor/templating';
import {Mongo} from 'meteor/mongo';
import './main.html';
txs = new Mongo.Collection('txs');
var cola = require("webcola");
var d3 = require('d3');
var coorNumber = 0;
console.log(d3);
txshandler = {};
dbwatcher = {};
minsAgo = 1;
xclosure = 70;
xclosuresmall = 70
linklength = 12
filterConfirmed = false;
nextClean = new Date();
toRestart = true;

Router.route('/', {name: "Home"}, function () {
  this.render('Home');
});
Router.route('/About');
Router.route('/Stats');

Template.registerHelper('navClassName', function (page) {
  if (Router.current()) {
    return Router.current().route.getName() === page ? "active" : "";
  }
});

Template.transactioninfo.onCreated(function () {
  txhash = new ReactiveVar("");
  txtimestamp = new ReactiveVar("");
  txnodetimestamp = new ReactiveVar("");
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
  havetx: function () {
    return txhash.get() !== "";
  },
  txhash: function () {
    return txhash.get();
  },
  txtimestamp: function () {
    return txtimestamp.get();
  },
  txnodetimestamp: function () {
    return txnodetimestamp.get();
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

Template.vis.events({
  "change #timePeriod": function (event, template) {
    let selectValue = parseInt(template.$("#timePeriod").val(), 10);
    console.log(selectValue);
    txshandler.setData('minsago', selectValue);
  },
  "change #filter": function (event, template) {
    let selectValue = template.$("#filter").val();

    if (selectValue == "all") {
      if (filterConfirmed) {
        filterConfirmed = false;
        txshandler.setData('confirmedonly', false);
      }
    } else if (selectValue == "confirmed") {
      if (!filterConfirmed) {
        filterConfirmed = true;
        txshandler.setData('confirmedonly', true);
      }
    }

    console.log(selectValue);
  }
});

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
      nodeRadius = 10;

    var fill = d3.scaleOrdinal(d3.schemeCategory20);

    var force = cola.d3adaptor(d3)
      .size([width, height])
      .nodes([])
      .symmetricDiffLinkLengths(linklength)
      .avoidOverlaps(true)
      .flowLayout("x", function(l) {
        return l.bundle ? xclosuresmall : xclosure;
      })
      .on("tick", tick);

    var svg = d3.select("#nodebox").append("svg")
      .attr("width", "100%")
      .attr("height", height)
      .attr("id", "canvas")
      .call(d3.zoom().scaleExtent([0.1, 8]).on("zoom", zoomed))
      .append("g");


    svg.style("cursor", "move");

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

    $(window).resize(function () {
      console.log("resized");
      width = document.getElementById('nodebox').clientWidth;
      centerx = width / 2;
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
          sourcePadding = ((selected === d.target.id) ? nodeRadius + 4 : nodeRadius ),
          targetPadding = ((selected === d.source.id) ? nodeRadius + 6 : nodeRadius + 2),
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

        var node = {tx: fields, id: id, tip: true, confirmed: false};

        if (fields.address == "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
          node.confirmed = true;
          //node.fixed = true;
          /*node.fx = centerx + coorNumber* 2 * xclosure;
          node.x = node.fx;
          node.px = node.fx;

          node.fy = centery;
          node.y = node.fy;
          node.py = node.fy;

          coorNumber++;*/
        }


        //Check parents and add parents link
        nodes.forEach(function (target) {
          if (fields.hash == target.tx.branchTransaction || fields.hash == target.tx.trunkTransaction) {
            node.tip = false;
            if(target.confirmed) {
              node.confirmed = true;
            }

            if(target.tx.bundle == fields.bundle) {
              links.push({source: node, target: target, bundle: true});
            } else {
              links.push({source: node, target: target});
            }
          }
        });

        //Correct children
        nodes.forEach(function (target) {
          if (target.tx.hash == fields.branchTransaction || target.tx.hash == fields.trunkTransaction) {
            if(target.tx.bundle == fields.bundle) {
              links.push({source: target, target: node, bundle: true});
            } else {
              links.push({source: target, target: node});
            }

            if(node.confirmed && !target.confirmed) {
              target.confirmed = true;
              setColour(target);
              setChildren(target);
            }

            if (target.tip) {
              target.tip = false;
              setColour(target);
            }
          }
        });

        function setChildren(n) {
          nodes.forEach(function (target) {
            if (target.tx.hash == n.tx.branchTransaction || target.tx.hash == n.tx.trunkTransaction) {
              if (!target.confirmed) {
                target.confirmed = true;
                setColour(target);
                setChildren(target);
              }
            }
          });
        }




        setColour(node);
        nodes.push(node);


        schedulerestart();

      },
      changed: function (id, fields) {
       /* for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].id === id) {
            nodes[i].tx.confirmed = true;
            setColour(nodes[i]);
            schedulerestart();
            break;
          }
        }*/
       console.log("changed??")
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


    function setColour(node) {
      if (node.tx.address === "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
        node.colour = "#FF4500";
      } else if (node.confirmed) {
        node.colour = "#FFA500";
      } else if (node.tip) {
        node.colour = "#4AC0F2";
      } else {
        node.colour = "#6495ED";
      }
    }

    function zoomed() {
      svg.attr("transform",d3.event.transform);
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

      node = node.data(nodes, function (d) {
        return d.id;
      });
      link = link.data(links, function (d) {
        return d.source.id + "-" + d.target.id;
      });

      node.exit().remove();
      var nodeenter = node.enter().append("circle")
        .attr("class", "node")
        .attr("r", nodeRadius)
        .attr("id", function (d) {
          return "a" + d.id;
        })
        .on("mouseleave", function (d) {
          svg.style("cursor", "move");
        })
        .on("mouseover", function (d) {
          svg.style("cursor", "pointer");
        })
        .on("mousedown", function (d) {
          console.log("test");
        d3.event.stopPropagation();
        if (selected && !d3.select("#a" + selected).empty()) {
          d3.select("#a" + selected).transition().duration(200).style("stroke-width", 1.5);
          d3.select("#a" + selected).style("stroke", "#fff");
          //d3.select("#a" + selected).style(" stroke-width", "1.5px");
        }
        d3.select(this).transition().duration(200).style("stroke-width", 6);
        d3.select(this).style("stroke", "#000");
        //d3.select(this).style(" stroke-width", "3px");
       // d3.select(this).transition().duration(200).attr("r", nodeRadius * 1.2);
          //stroke: #fff;
          //stroke-width: 1.5px;
        selected = d.id;

        txhash.set(d.tx.hash);
        txtimestamp.set((new Date(d.tx.timestamp * 1000)).toLocaleString());
        txnodetimestamp.set((new Date(d.tx.time)).toLocaleString());
        txtag.set(d.tx.tag);
        txaddress.set(d.tx.address);
        txvalue.set(d.tx.value);
        txbundle.set(d.tx.bundle)
        txmessage.set(d.tx.signatureMessageFragment);
        txconfirmed.set(d.confirmed ? "true" : "false");
        txbranch.set(d.tx.branchTransaction)
        txtrunk.set(d.tx.trunkTransaction)

          focused = d;
          isFocused = true;
          node.style("opacity", function (o) {
            return isFocused ? (isConnected(focused, o) ? 1 : 0.2) : 1;
          });
          link.style("opacity", function (o) {
            return isFocused ? (o.source.id == focused.id || o.target.id == focused.id ? 0.8 : 0.12) : 0.4;
          });
      })
        .on("mouseup", function (d) {
          isFocused = false;
          link.style("opacity", 0.4);
          node.style("opacity", 1);
        })
        .call(force.drag)
        .merge(node);

      nodeenter.style("opacity", function (o) {
        return isFocused ? (isConnected(focused, o) ? 1 : 0.2) : 1;
      });
      nodeenter.style("fill", function (d) {
        return d.colour;
      });
      node = nodeenter.merge(node);







      link.exit().remove();
      var linkenter = link.enter().append('svg:path')
        .attr("class", "link");

      linkenter.style("opacity", function (o) {
        return isFocused ? (o.source.id == focused.id || o.target.id == focused.id ? 0.8 : 0.12) : 0.4;
      });
      link = linkenter.merge(link);



      //link = linkenter.merge(link);

      force.start();

    }
  }


}

Template.vis.destroyed = function () {
  dbwatcher.stop();
  txshandler.stop();
}
