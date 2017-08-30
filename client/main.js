import {Template} from 'meteor/templating';
import {Mongo} from 'meteor/mongo';
import './main.html';
txs = new Mongo.Collection('txs');
histographstats = new Mongo.Collection('histstats');
graphstats = new Mongo.Collection('stats');
var cola = require("webcola");
var d3 = require('d3');
var MG = require('metrics-graphics');


txshandler = {};
statshandler = {};
dbwatcher = {};
minsAgo = 1;
xclosure = 70;
xclosuresmall = 30;
linklength = 12;
filterConfirmed = false;
nextClean = new Date();
toRestart = true;
smallNodeRadius = 6;
nodeRadius = 10;
disableremove = false;
fastmode = false;
restartDB = {};
started = false;
nodes = [];
links = [];

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
    //console.log(selectValue);
    txshandler.setData('minsago', selectValue);
  },
  "change #disableremove": function (event, template) {
    disableremove = template.$("#disableremove").is(":checked");
    restartDBWatcher();
    //startSim(document.getElementById('nodebox').clientWidth);
  },
  "change #fastmode": function (event, template) {
    fastmode = template.$("#fastmode").is(":checked");
    txshandler.setData('fastmode', fastmode);
    restartDBWatcher();
    //startSim(document.getElementById('nodebox').clientWidth);
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
  },
  "click #start": function (event, template) {
   if(started) {
     restartDBWatcher();
   } else {
     started = true;
     startSim(document.getElementById('nodebox').clientWidth);
   }
  }
});


Template.vis.rendered = function () {
  //startSim(document.getElementById('nodebox').clientWidth);
  txshandler = Meteor.subscribe("txs");
};

function startSim(w) {
  var focused;
  var selected;
  var isFocused = false;
  var width = w,
    height = 400,
    centerx = width / 2,
    centery = height / 2;

  var fill = d3.scaleOrdinal(d3.schemeCategory20);

  var force = cola.d3adaptor(d3)
    .size([width, height])
    .nodes([])
    .symmetricDiffLinkLengths(linklength)
    .avoidOverlaps(false)
    .flowLayout("x", function (l) {
      return l.bundle ? xclosuresmall : xclosure;
    })
    .on("tick", tick);

  var basesvg = d3.select("#nodebox").append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("id", "canvas")
    .call(d3.zoom().scaleExtent([0.1, 8]).on("zoom", zoomed));

  var svg = basesvg.append("g");


  basesvg.style("cursor", "move");
  svg.style("cursor", "move");

  var rect = svg.append("rect")
    .attr("width", width)
    .attr("height", height);

  nodes = force.nodes();
  links = force.links();
  var node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

  svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -10 20 20')
    .attr('refX', 10)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,-10L20,0L0,10')
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
        sourcePadding = ((selected === d.target.id) ? d.target.r + 2 : d.target.r ),
        targetPadding = ((selected === d.source.id) ? d.source.r + 4 : d.source.r + 2),
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




  restartDB = {
    added: function (id, fields) {

      var node = {tx: fields, id: id, tip: true, confirmed: false};
      node.r = (0 === fields.currentIndex) ? nodeRadius : smallNodeRadius;
      if (fields.address == "KPWCHICGJZXKE9GSUDXZYUAPLHAKAHYHDXNPHENTERYMMBQOPSQIDENXKLKCEYCPVTZQLEEJVYJZV9BWU") {
        node.confirmed = true;
        node.milestone = true;
      }


      //Check parents and add parents link
      nodes.forEach(function (target) {
        if (fields.hash == target.tx.branchTransaction || fields.hash == target.tx.trunkTransaction) {
          node.tip = false;
          if (target.confirmed) {
            node.confirmed = true;
          }
          if (target.milestone && target.tx.bundle === fields.bundle) {
            node.milestone = true;
          }

          if (target.tx.bundle == fields.bundle) {
            links.push({source: node, target: target, bundle: true});
          } else {
            links.push({source: node, target: target});
          }
        }
      });

      //Correct children
      nodes.forEach(function (target) {
        if (target.tx.hash == fields.branchTransaction || target.tx.hash == fields.trunkTransaction) {
          if (target.tx.bundle == fields.bundle) {
            links.push({source: target, target: node, bundle: true});
          } else {
            links.push({source: target, target: node});
          }

          if (node.milestone && target.tx.bundle == fields.bundle) {
            target.milestone = true;
          }

          if (node.confirmed && !target.confirmed) {
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
      if (!initializing) {
        restart();
      }
    },
    changed: function (id, fields) {
    },
    removed: function (id) {
      if(!disableremove) {
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
            if (!initializing) {
              restart();
            }
            break;
          }
        }
      }
    }
  };
  dbwatcher = txs.find().observeChanges(restartDB);
  initializing = false;
  restart();

  function setColour(node) {
    if (node.milestone) {
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
    svg.attr("transform", d3.event.transform);
  }

  function isConnected(a, b) {
    return a.tx.hash == b.tx.branchTransaction ||
      a.tx.hash == b.tx.trunkTransaction ||
      b.tx.hash == a.tx.branchTransaction ||
      b.tx.hash == a.tx.trunkTransaction ||
      a.id == b.id;
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
      .attr("r", function (d) {
        return d.r;
      })
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
        d3.event.stopPropagation();
        if (selected && !d3.select("#a" + selected).empty()) {
          d3.select("#a" + selected).transition().duration(200).style("stroke-width", 1.5);
          d3.select("#a" + selected).style("stroke", "#fff");
        }
        d3.select(this).transition().duration(200).style("stroke-width", 4);
        d3.select(this).style("stroke", "#000");
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
      .on("click", function (d) {
        d3.event.stopPropagation();
        if (selected && !d3.select("#a" + selected).empty()) {
          d3.select("#a" + selected).transition().duration(200).style("stroke-width", 1.5);
          d3.select("#a" + selected).style("stroke", "#fff");
        }
        d3.select(this).transition().duration(200).style("stroke-width", 4);
        d3.select(this).style("stroke", "#000");
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
      .call(force.drag)
      .merge(node);

    nodeenter.style("opacity", function (o) {
      return isFocused ? (isConnected(focused, o) ? 1 : 0.2) : 1;
    });
    nodeenter.style("fill", function (d) {
      return d.colour;
    });
    node = nodeenter.merge(node);

    basesvg.on("click", function (d) {
      isFocused = false;
      link.style("opacity", 0.4);
      node.style("opacity", 1);
      if (selected && !d3.select("#a" + selected).empty()) {
        d3.select("#a" + selected).transition().duration(200).style("stroke-width", 1.5);
        d3.select("#a" + selected).style("stroke", "#fff");
      }
      selected = null;
    });


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

function restartDBWatcher() {
  if(dbwatcher) {
    dbwatcher.stop();
  }
  nodes = [];
  links = [];
  dbwatcher = txs.find().observeChanges(restartDB);
}
Template.vis.destroyed = function () {
  dbwatcher.stop();
  txshandler.stop();
};


Date.prototype.toDateInputValue = (function () {
  var local = new Date(this);
  local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
  return local.toJSON().slice(0, 10);
});

function changePeriod(template, days) {
  let to = (new Date()).valueOf();
  let from = to - (days * 24 * 60 * 60000);

  template.$("#statsfrom").val(new Date(from).toDateInputValue());
  template.$("#statsto").val(new Date(to).toDateInputValue());
  statshandler.setData('statsfrom', from);
  statshandler.setData('statsto', to);
}

Template.Stats.events({
  "click #stats-day": function (event, template) {
    changePeriod(template, 1);
  },
  "click #stats-week": function (event, template) {
    changePeriod(template, 7);
  },
  "click #stats-month": function (event, template) {
    changePeriod(template, 31);
  },
  "click #stats-year": function (event, template) {
    changePeriod(template, 365);
  },
  "click #stats-all": function (event, template) {
    let to = (new Date()).valueOf();
    let from = 0;

    template.$("#statsfrom").val(new Date(from).toDateInputValue());
    template.$("#statsto").val(new Date(to).toDateInputValue());
    statshandler.setData('statsfrom', from);
    statshandler.setData('statsto', to);
  },
  "change #statsto": function (event, template) {
    statshandler.setData('statsto', (new Date(template.$("#statsto").val())).valueOf())
  },
  "change #statsfrom": function (event, template) {
    statshandler.setData('statsfrom', (new Date(template.$("#statsfrom").val())).valueOf())
  }
});

Template.Stats.rendered = function () {
  statshandler = Meteor.subscribe("stats");
  Meteor.subscribe("histstats");
  let to = (new Date()).valueOf();
  let from = 0;

  $("#statsfrom").val(new Date(from).toDateInputValue());
  $("#statsto").val(new Date(to).toDateInputValue());
  statshandler.setData('statsfrom', from);
  statshandler.setData('statsto', to);
}

Template.graphs.onCreated(function () {
  peaktx = new ReactiveVar(0);
  peakctx = new ReactiveVar(0);
  peakvol = new ReactiveVar(0);
  peakpercent = new ReactiveVar(0);
  peaktime = new ReactiveVar(0);
});


Template.graphs.helpers({
  peaktx: function () {
    return d3.format(".4f")(peaktx.get()) + " TX/s";
  },
  peakctx: function () {
    return d3.format(".4f")(peakctx.get()) + " CTX/s";
  },
  peakvol: function () {
    return peakvol.get() + " TXs";
  },
  peakpercent: function () {
    return d3.format(".2%")(peakpercent.get());
  },
  peaktime: function () {
    return d3.format(".2f")(peaktime.get()) + "s";
  },
});

Template.graphs.rendered = function () {
  updateGraphBounced = debounce(updateGraph, 1000);
  this.autorun(() => {
    let data = graphstats.find({}).fetch();
    updateGraphBounced(data);
  });

  $(window).resize(function () {
    console.log("resize graphs");
    updateGraphBounced(graphstats.find({}).fetch());
  });
};

function debounce(func, interval) {
  var lastCall = -1;
  return function (...args) {
    clearTimeout(lastCall);
    var self = this;
    lastCall = setTimeout(function () {
      func.apply(self, args);
    }, interval);
  };
}

function updateGraph(data) {
  let histdata = histographstats.find({}).fetch();
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      data[i].date = new Date(data[i].date);
      data[i].percent = data[i].totalConfirmedTX / data[i].totalTX;
      data[i].totalUnconfirmedNonTippedTX = data[i].totalTX - data[i].totalConfirmedTX - data[i].totalTipTX;
    }

    MG.data_graphic({
      title: "Transaction Volume",
      description: "Shows the number of tx's (measured over a 24 hour period)",
      data: data,
      target: document.getElementById('chart1'),
      x_accessor: 'date',
      y_accessor: ['totalTX', 'totalConfirmedTX', 'totalUnconfirmedNonTippedTX', 'totalTipTX'],
      legend: ['Total TXs', 'Confirmed TXs', 'Unconfirmed Non-Tip TXs', 'Tip TXs'],
      legend_target: document.getElementById('legend1'),
      width: document.getElementById('chart1div').clientWidth - document.getElementById('chart1div').offsetLeft * 2,
      height: 400,
      animate_on_load: true,
      aggregate_rollover: true,
    });

    MG.data_graphic({
      title: "Transaction Rate",
      description: "Shows the rate of tx's (measured over a 30 minute window)",
      data: data,
      target: document.getElementById('chart2'),
      x_accessor: 'date',
      y_accessor: ['TXs', 'cTXs'],
      legend: ['All', 'Confirmed'],
      legend_target: document.getElementById('legend2'),
      width: document.getElementById('chart2div').clientWidth - document.getElementById('chart2div').offsetLeft * 2,
      height: 400,
      animate_on_load: true,
      y_label: 'TX/s',
      aggregate_rollover: true,
    });

    MG.data_graphic({
      title: "Average Confirmation Time",
      description: "Shows the average time before confirmation in seconds (measured over a 24 hour period), filtered is included since a few transaction are outliers.",
      data: data,
      target: document.getElementById('chart3'),
      x_accessor: 'date',
      y_accessor: ['averagectimefiltered', 'averagectime'],
      legend: ['Filtered (txs with <1 hour confirmation times', 'All txs'],
      legend_target: document.getElementById('legend3'),
      width: document.getElementById('chart3div').clientWidth - document.getElementById('chart3div').offsetLeft * 2,
      height: 400,
      animate_on_load: true,
      yax_format: function (s) {
        return s + "s"
      },
      y_label: 'Confirmation Time',
    });

    MG.data_graphic({
      title: "Percent of Transactions Confirmed",
      description: "Shows the percentage of txs confirmed in the tangle (measured over a 24 hour period)",
      data: data,
      target: document.getElementById('chart4'),
      x_accessor: 'date',
      y_accessor: 'percent',
      width: document.getElementById('chart4div').clientWidth - document.getElementById('chart4div').offsetLeft * 2,
      height: 400,
      format: 'percentage',
      animate_on_load: true,
      y_label: 'Percent Confirmed',
    });
  }

  if (histdata.length > 0) {

    var markers = [{
      'range': 450,
      'label': histdata[0].outofrange + " out of range",
    }];

    peaktx.set(histdata[0].peakTXs);
    peakctx.set(histdata[0].peakCTXs);
    peakvol.set(histdata[0].peakVol);
    peakpercent.set(histdata[0].peakPercent);
    peaktime.set(histdata[0].peakTime);

    MG.data_graphic({
      title: "Current Confirmation Time Chances",
      description: "Shows the chance of confirmation at certain intervals (measured over a 24 hour period). " + d3.format("2p")(histdata[0].outofrange) + " of transactions are out of range (>500s)",
      data: histdata[0].ctimes,
      binned: true,
      chart_type: 'histogram',
      target: document.getElementById('chart5'),
      width: document.getElementById('chart5div').clientWidth - document.getElementById('chart5div').offsetLeft * 2,
      height: 400,
      animate_on_load: true,
      xax_format: function (s) {
        return s + "s"
      },
      x_accessor: 'range',
      y_accessor: 'count',
      x_label: 'Confirmation Time',
      y_label: 'Count',
      markers: markers,
      yax_format: d3.format('.2%'),
      /* mouseover: function(y, x) {
       // custom format the rollover text, show days
       var pf = d3.format('.2%');
       d3.select('#custom-rollover svg .mg-active-datapoint')
       .text(pf(y)+" confirmed in "+ (x)+"-"+(x+10)+" seconds");
       },*/
      //format: 'percentage',
    });
  }
}