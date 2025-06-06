/**
* Author : Gerald Fenoy
*
* Copyright (c) 2015 GeoLabs SARL
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*
* This work was supported by a grant from the European Union's 7th Framework Programme (2007-2013)
* provided for the project PublicaMundi (GA no. 609608).
*/

require(['bootstrap', 'notify']);

define([
    'module', 'jquery', 'zoo', 'xml2json','ol'
], function(module, $, Zoo, X2JS,ol) {
    
    var zoo = new Zoo({
        url: module.config().url,
        delay: module.config().delay,
    });
    
    var mymodal = $('#myModal');
    var mynotify = $('.top-right');
    

    function notify(text, type) {
        mynotify.notify({
            message: { text: text },
            type: type,
        }).show();
    }

    var wm;
    var layer;
    var basic_counter = 0,
        table_counter = 0,
        form_counter = 0,
        parent_counter = 0,
        child_counter = 0;
    
    var initialize = function() {

	wm = new WindowManager({
            container: "#windowPane",
            windowTemplate: $('#basic_window_template').html()
	});
	window.wm = wm;

      $(function(){

        $('.sidebar-left .slide-submenu').on('click',function() {
          var thisEl = $(this);
          thisEl.closest('.sidebar-body').fadeOut('slide',function(){
            $('.mini-submenu-left').fadeIn();
            applyMargins();
          });
        });

        $('.mini-submenu-left').on('click',function() {
          var thisEl = $(this);
          $('.sidebar-left .sidebar-body').toggle('slide');
          thisEl.hide();
          applyMargins();
        });

	map = new ol.Map({
	    layers: new ol.Collection(),
	    target: 'map',
	    view: new ol.View({
		center: [260047.557702813,6051682.54296228],
		//extent: [240047.557702813,6234682.54296228,281304.353234602,6267347.78149257],
		zoom: 6
	    })
	});

        layerLS=new ol.layer.Tile({
	    source: new ol.source.OSM()
	});
	map.addLayer(layerLS);
	
	var main_url="http://old-www.zoo-project.org/cgi-bin/mapserv?map=/var/www/demo.zoo-project.org/htdocs/mapserver/mntfr.map";
	var wmsSource=new ol.source.TileWMS({
	    url: main_url,
	    ratio: 1,
	    params: {'LAYERS': 'zoowpsmnt',"VERSION":"1.1.1"},
	    serverType: 'mapserver'
	});
	var layer0=new ol.layer.Tile({
	    source: wmsSource
	});
	map.addLayer(layer0);

	var vector = new ol.layer.Vector({
	    source: source,
	    style: new ol.style.Style({
		fill: new ol.style.Fill({
		    color: 'rgba(255, 255, 255, 0.2)'
		}),
		stroke: new ol.style.Stroke({
		    color: '#ffcc33',
		    width: 2
		}),
		image: new ol.style.Circle({
		    radius: 7,
		    fill: new ol.style.Fill({
			color: '#ffcc33'
		    })
		})
	    })
	});
	map.addLayer(vector);
	
	layer = new ol.layer.Vector({
	    map: map,
	    source: new ol.source.Vector({
		features: new ol.Collection(),
		useSpatialIndex: false // optional, might improve performance
	    }),
	    //style: style1,
	    updateWhileAnimating: true, // optional, for instant visual feedback
	    updateWhileInteracting: true // optional, for instant visual feedback
	});
	map.addLayer(layer);
 
        $(window).on("resize", applyMargins);

        applyInitialUIState();
        applyMargins();

      });
 
    }

    var draw;
    var source = new ol.source.Vector({wrapX: false});

    function addInteraction() {
	var geometryFunction, maxPoints;
	draw = new ol.interaction.Draw({
	    source: source,
	    type: /** @type {ol.geom.GeometryType} */ "LineString",
	    geometryFunction: geometryFunction,
	    maxPoints: maxPoints
	});
	draw.on("drawstart",function(e){
	    clearAll();
	});
	draw.on("drawend",function(e){
	});
	source.on("addfeature",function(e){
	    var format=new ol.format.GeoJSON();
	    var fobj=format.writeFeaturesObject([source.getFeatures()[0]],
						{dataProjection: 'EPSG:4326',
						 featureProjection: 'EPSG:3857'});
	    simpleProcessing(JSON.stringify(fobj.features[0].geometry));
	});
	map.addInteraction(draw);
    }

    function clearAll(){
	if(win){
	    win.close();
	    win=null;
	}
	clearAllFeatures();
    }

    function clearAllFeatures(){
	if(layer.getSource().getFeatures().length>0)
	    layer.getSource().removeFeature(layer.getSource().getFeatures()[0]);
	source.clear();
    }

    function deactivateDrawTool(){
	clearAll();
	map.removeInteraction(draw);
    }

    function activateDrawTool(){
	deactivateDrawTool();
	addInteraction();
    };

	function processUploadTool(event){
		const input = event.target;
		const reader = new FileReader();
		reader.onload = function () {
			try {
				const geoJsonData = reader.result;
				simpleProcessing(geoJsonData);
			} catch (e) {
				alert(e.toString());
			}
		};

		if (input.files[0])
			reader.readAsBinaryString(input.files[0]);
	}

    var win;

    function simpleProcessing(geomString) {
	switch ($('input[name="service"]:checked').val()) {
		case 'C':
			serviceName = 'GdalExtractProfile';
			break;
		case 'node':
			serviceName = 'linestringDem';
			break;
	}
	notify('Running ' + serviceName + ' service','info');
	zoo.execute({
	    identifier: serviceName,
            dataInputs: [{"identifier":"Geometry","value":geomString,"mimeType":"application/json"},
			 {"identifier":"RasterFile","value":"topofr.tif","dataType":"string"}],
            dataOutputs: [{"identifier":"Profile","type":"raw"}],
            type: 'POST',
            storeExecuteResponse: false,
            success: function(data) {
                notify(serviceName + ' service run successfully','success');
		//var  reg=new  RegExp("[;]", "g");
		//var tmp=data.split(reg);
		var tmp0=JSON.parse(data);
		var tmp=tmp0.coordinates;
		var idxs=new Array();
		var values= new Array();
		points=new Array();
		for(var i=0;i<tmp.length;i++){
	            //var  reg1=new  RegExp("[,]", "g");
		    //var tmpString=tmp[i]+"";
		    var tmp1=tmp[i];//tmpString.split(reg1);
		    if(tmp1[0] && tmp1[1] && tmp1[2]){
			idxs[i]=i;
			values[i]=parseInt(tmp1[2]);
			points[i]=[parseFloat(tmp1[0]),parseFloat(tmp1[1])];
		    }
		}
		var titl = '<i class="fa fa-area-chart"></i> Elevation profile';
		if(wm.windows.length==0)
		win=wm.createWindow({
		    title: titl,
		    bodyContent: "<p>Loading diagram ...</p>",
		    footerContent: ''
		});
		else
		    win.show();
		win.$el.on("close",function(e){
		    clearAllFeatures();
		});
		printDiagram(idxs,values,points);
            },
            error: function(data) {
		notify('Execute failed:' +data.ExceptionReport.Exception.ExceptionText, 'danger');
            }
        });
    }

    function printDiagram(idxs,
values,points){
	
	var chart = new Highcharts.Chart({
	    chart: {
		renderTo: 'chart_container',
		zoomType: 'x'
	    },
	    title: {
		text: ''
	    },
	    xAxis: {
		title: { text: 'Points' },
		maxZoom: 10
	    },
	    yAxis: {
		title: { text: null },
		startOnTick: false,
		showFirstLabel: false
	    },
	    legend: {
		enabled: false
	    },
	    plotOptions: {
		area: {
		    cursor: 'pointer',
		    point: {
			events: {
			    mouseOver: function() {
				if(layer.getSource().getFeatures().length>0)
				    layer.getSource().removeFeature(layer.getSource().getFeatures()[0]);
				var tmp=ol.proj.transform([points[this.x][0],points[this.x][1]],'EPSG:4326','EPSG:3857')
				var tmpPoint=new ol.geom.Point([tmp[0],tmp[1]]);
				layer.getSource().addFeatures([new ol.Feature({geometry: tmpPoint,name: "point"})]);
			    }
			}
		    },
		    fillColor: {
			linearGradient: [0, 0, 0, 300],
			stops: [
			    [0, '#FD8F01'],
			    [1, 'rgba(255,255,255,0)']
			]
		    },
		    lineWidth: 1,
		    lineColor: '#FD8F01',
		    marker: {
			enabled: false,
			states: {
			    hover: {
				enabled: true,
				radius: 3
			    }
			}
		    },
		    shadow: false,
		    states: {
			hover: {
			    lineWidth: 1
			}
		    }
		}
	    },
	    tooltip: {
		formatter: function() {
		    return '<b>Altitude</b><br />Value : '+Highcharts.numberFormat(this.y, 0)+'m';
		}
	    },
	    series: [{
		name: 'Altitude',
		type: 'area',
		data: values
	    }]
	});
    }
    
    function applyMargins() {
        var leftToggler = $(".mini-submenu-left");
        if (leftToggler.is(":visible")) {
            $("#map .ol-zoom")
		.css("margin-left", "0")
		.removeClass("zoom-top-opened-sidebar")
		.addClass("zoom-top-collapsed");
        } else {
            $("#map .ol-zoom")
		.css("margin-left", $('.sidebar-left').width())
		.addClass("zoom-top-opened-sidebar")
		.removeClass("zoom-top-collapsed");
        }
    }
    

      function isConstrained() {
        return $(".sidebar").width() == $(window).width();
      }

      function applyInitialUIState() {
        if (isConstrained()) {
          $(".sidebar-left .sidebar-body").fadeOut('slide');
          $('.mini-submenu-left').fadeIn();
        }
      }


    // Returns public methods
    return {
        initialize: initialize,
        activateDrawTool: activateDrawTool,
        deactivateDrawTool: deactivateDrawTool,
		processUploadTool: processUploadTool
    };







});

