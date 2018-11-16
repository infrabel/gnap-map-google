/**
 * @desc Factory which returns the layer configuration object for the selected mapTech.
 */
(function () {
    'use strict';

    angular.module('gnapMapGoogle', ['gnapMap'])
		.provider('mapTechGoogle', mapTechGoogleProvider);

    mapTechGoogleProvider.$inject = ['mapTechProvider'];

    function mapTechGoogleProvider(mapTechProvider) {

        var _styles = []

        var _mapTech = {
            key: 'google',
            displayName: 'Google',
            coordinateSystem: 'wgs84',
            defaults: {
                zoomLevel: 8,
                center: { lat: 50.762437, lng: 4.245922 },
                defaultStyleFunction: defaultStyleFunction
            }
        };

        function defaultStyleFunction(feature, iconUri, layerProperties, zoomLevel) {
            return {
                icon: iconUri,
                zIndex: layerProperties.zIndex || layerProperties.minZoomLevel,
                title: feature.getProperty('label')
            };
        }

        // Register Google map tech with the mapTechProvider
        mapTechProvider.registerMapTech(_mapTech);

        /* jshint validthis:true */
        this.setDefaults = function (options) { angular.extend(_mapTech.defaults, options); };
        this.setStyles = function (styles) { if (angular.isArray(styles)) { _styles = styles; } else { _styles.push(styles); } };
        this.$get = mapTechGoogleFactory;

        function mapTechGoogleFactory() {
            return {
                getStyles: function () { return _styles; }
            };
        }
    }
})();
/**
 * @desc Contains all logic to actually draw things on the Google Map, or other map-specific functions.
 * In theory, when switching a map drawing engine (e.g. to Bing), only a new version of this file should be created.
 */
(function () {
    'use strict';

    /* globals google */

    angular
        .module('gnapMapGoogle')
        .directive('mapViewGoogle', mapViewGoogle);

    mapViewGoogle.$inject = ['$q', '$timeout', 'mapManager', 'mapTech', 'mapTechGoogle', 'localStorageService'];

    function mapViewGoogle($q, $timeout, mapManager, mapTech, mapTechGoogle, localStorageService) {

        ////////// Private variables

        var map, infoWindow, drawingManager;
        var customFusionTables = {};
        var finishedDrawingCallback = null;
        var defaults = mapTech.getSelectedMapTech().defaults;

        // Initialize the view port
        var viewPort = {
            zoom: defaults.zoomLevel, // 8
            center: defaults.center, // { lat: 50.762437, lng: 4.245922 }
            bounds: null
        };

        ////////// Directive declaration

        return {
            restrict: 'AE',
            template:
                '<div id="map-canvas" style="width: 100%; height: 100%"></div>',
            link: link,
            scope: {
                activateDrawingMode: '='
            }
        };

        function link(scope, element, attrs) {
            // Override the (manager's) scope with the actual implementations of these functions
            mapManager.mapView._addGeoJsonData = addGeoJsonData;
            mapManager.mapView._removeGeoJsonData = removeGeoJsonData;
            mapManager.mapView._centerOnFeature = centerOnFeature;

            mapManager.mapView.addCustomKml = addFusionTable;
            mapManager.mapView.removeCustomKml = removeFusionTable;
            mapManager.mapView.showInfoWindow = showInfoWindow;
            mapManager.mapView.closeInfoWindow = closeInfoWindow;
            mapManager.mapView.resizeMap = resizeMap;
            mapManager.mapView.activateDrawingMode = activateDrawingMode;
            mapManager.mapView.getGeoJson = getGeoJson;

            mapManager.mapView.viewPort.getZoomLevel = getZoomLevel;
            mapManager.mapView.viewPort.setZoomLevel = setZoomLevel;
            mapManager.mapView.viewPort.getCenter = getCenter;
            mapManager.mapView.viewPort.getCenterWgs84 = getCenter;
            mapManager.mapView.viewPort.setCenter = setCenter;
            mapManager.mapView.viewPort.setCenterWgs84 = setCenter;
            mapManager.mapView.viewPort.getBounds = getBounds;
            mapManager.mapView.viewPort.getBoundsWgs84 = getBounds;
            mapManager.mapView.viewPort.setBounds = setBounds;
            mapManager.mapView.viewPort.setBoundsWgs84 = setBounds;
            mapManager.mapView.viewPort.isInBounds = isInBounds;
            mapManager.mapView.viewPort.containsBounds = containsBounds;
            mapManager.mapView.viewPort.containsCoordinate = containsCoordinate;

            activate();

            ////////// Activation function

            function activate() {

                ////////// Initialization
                map = mapManager.getMap();
                if (map === undefined || !(map instanceof google.maps.Map)) {

                    var mapCanvas = document.getElementById('map-canvas');

                    var mapTypes = [
                        google.maps.MapTypeId.ROADMAP,
                        google.maps.MapTypeId.SATELLITE,
                        google.maps.MapTypeId.HYBRID,
                        google.maps.MapTypeId.TERRAIN];

                    var customMapStyles = mapTechGoogle.getStyles();

                    angular.forEach(customMapStyles, function (customMapStyle) {
                        mapTypes.push(customMapStyle.id);
                    });

                    map = new google.maps.Map(mapCanvas, {
                        center: viewPort.center,
                        zoom: viewPort.zoom,
                        scaleControl: true,
                        panControl: false,
                        zoomControl: true,
                        zoomControlOptions: { position: google.maps.ControlPosition.LEFT_BOTTOM },
                        mapTypeControlOptions: {
                            position: google.maps.ControlPosition.RIGHT_TOP,
                            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                            mapTypeIds: mapTypes
                        },
                        overviewMapControl: true,
                        overviewMapControlOptions: { opened: true },
                        gestureHandling: 'greedy'
                    });

                    mapManager.setMap(map);

                    infoWindow = new google.maps.InfoWindow();

                    // TODO: pass in the activation or de-activation of these features through scope parameters
                    if (scope.activateDrawingMode) {
                        drawingManager = new google.maps.drawing.DrawingManager({
                            drawingMode: null,
                            drawingControl: true,
                            drawingControlOptions: {
                                position: google.maps.ControlPosition.TOP_CENTER,
                                drawingModes: [google.maps.drawing.OverlayType.POLYGON]
                            }
                        });
                        drawingManager.setMap(map);

                        google.maps.event.addListener(drawingManager, 'polygoncomplete', drawingComplete);
                    }

                    angular.forEach(customMapStyles, function (customMapStyle) {
                        map.mapTypes.set(customMapStyle.id,
                            new google.maps.StyledMapType(customMapStyle.style, { name: customMapStyle.name }));
                    });

                    var selectedMapTypeId = localStorageService.get('mapTypeId');
                    if (selectedMapTypeId) {
                        map.setMapTypeId(selectedMapTypeId);
                    }

                    ////////// Assign map-specific events

                    google.maps.event.addListener(map, 'idle', idle);
                    google.maps.event.addListener(map, 'maptypeid_changed', mapTypeIdChanged);
                    google.maps.event.addListener(infoWindow, 'closeclick', mapManager.events.onInfoWindowClosed);

                    map.data.setStyle(setStyle);
                    map.data.addListener('click', dataItemClicked);
                    map.data.addListener('mouseover', mouseOverDataItem);
                    map.data.addListener('mouseout', mouseOutOfDataItem);
                } else {
                    $('#map-canvas').replaceWith(map.getDiv());

                    google.maps.event.trigger(map, 'resize');
                }
            }
        }

        function idle() {
            $timeout(function () {
                viewPort.zoom = map.getZoom();
                viewPort.bounds = googleLatLngBoundsToBounds(map.getBounds());
                viewPort.center = googleLatLngToLatLng(map.getCenter());
            }).then(function () {
                mapManager.fetchAllDataInBounds();
            });
        }

        function mapTypeIdChanged() {
            localStorageService.set('mapTypeId', map.getMapTypeId());
        }

        function drawingComplete(polygon) {
            $timeout(function () {
                var wkt = googlePointArrayToWkt(polygon.getPath());

                var removeFunction = function () { polygon.setMap(null); };

                if (finishedDrawingCallback) {
                    finishedDrawingCallback(wkt, removeFunction);
                    finishedDrawingCallback = null;
                } else {
                    mapManager.events.onCustomShapeCreated(wkt, removeFunction);
                }

                drawingManager.setDrawingMode(null);
            });
        }

        function setStyle(feature) {
            // Performance here must be optimal
            var type = feature.getProperty('type');

            if (feature.getProperty('isLabel')) {
                // Special label layer
                var baseLayer = mapManager.dataLayers[type.replace('Label', '')];

                return baseLayer.getLabelStyleFunction(feature, baseLayer.iconUrl, null, getZoomLevel());
            } else {
                var layerProperties = mapManager.dataLayers[type];
                var getStyleFunction = layerProperties.getStyleFunction || defaults.defaultStyleFunction;
                var iconUrl = layerProperties.iconUrl;

                return getStyleFunction(feature, iconUrl, layerProperties, getZoomLevel());
            }
        }

        function dataItemClicked(event) {
            var type = event.feature.getProperty('type');
            var id = event.feature.getId();
            mapManager.events.onDataItemClicked(type, id);
        }

        function mouseOverDataItem(mouseEvent) {
            var infoText = mouseEvent.feature.getProperty('info');

            if (infoText) {
                map.getDiv().setAttribute('title', infoText);
            }
        }

        function mouseOutOfDataItem(mouseEvent) {
            map.getDiv().removeAttribute('title');
        }

        function showInfoWindow(position, content) {
            infoWindow.close();
            infoWindow.setPosition(position);
            infoWindow.setContent(content || $('#info-window').get(0));
            infoWindow.open(map);

            // If we're zoomed out too much (i.e. when accessing this from the url instead of a click), zoom in
            var type = mapManager.selection.type;
            if (type) {
                var minZoomLevel = mapManager.dataLayers[type].minZoomLevel;
                if (minZoomLevel) {
                    if (getZoomLevel() < minZoomLevel) {
                        map.setCenter(position);
                        setZoomLevel(minZoomLevel);
                    }
                }
            }
        }

        function closeInfoWindow() {
            infoWindow.close();
        }

        function addGeoJsonData(geoJsonData, featureType, redraw) {
            if (!geoJsonData || geoJsonData.features.length === 0) {
                return;
            }

            var datalayer = mapManager.dataLayers[featureType];

            var copyForLabels = null;
            if (datalayer.getLabelStyleFunction) {
                copyForLabels = angular.copy(geoJsonData);
            }
            
            if (!redraw && !datalayer.moving) {
                // Remove duplicates
                for (var i = geoJsonData.features.length - 1; i >= 0; i--) {
                    var featureToAdd = geoJsonData.features[i];
                    var existingFeature = map.data.getFeatureById(featureToAdd.id);
                    if (existingFeature && existingFeature.getProperty('type') === featureType) {
                        geoJsonData.features.splice(i, 1);
                    }
                }
            }

            if (geoJsonData.features.length !== 0) {
                // Check if anything is still remaining
                map.data.addGeoJson(geoJsonData);
            }

            // Next, in case we also need to add labels for this layer, add those too.
            // We always redraw labels, because their size depends on the zoom level.
            if (copyForLabels) {
                addLabelGeoJsonData(copyForLabels);
            }
        }

        function addLabelGeoJsonData(labelData) {
            angular.forEach(labelData.features, function (label) {
                label.properties.type += 'Label';
                label.properties.isLabel = true;
                // We expect any non-point to have a 'center' property
                if (label.geometry.type !== 'Point' && label.properties.center) {
                    label.geometry = {
                        type: 'Point',
                        coordinates: [label.properties.center.lng, label.properties.center.lat]
                    };
                }
                // Unique id, as to not override the actual feature
                label.id = label.id + '_label';
            });

            map.data.addGeoJson(labelData);
        }

        function removeGeoJsonData(type) {
            var hasLabel = mapManager.dataLayers[type].getLabelStyleFunction ? true : false;
            if (hasLabel) {
                // For performance optimization, we only check both in case we have to
                map.data.forEach(function (feature) {
                    if (feature.getProperty('type') === type || feature.getProperty('type') === type + 'Label') {
                        map.data.remove(feature);
                    }
                });
            } else {
                // Normally, we only need to check for the actual type
                map.data.forEach(function (feature) {
                    if (feature.getProperty('type') === type) {
                        map.data.remove(feature);
                    }
                });
            }
        }

        function centerOnFeature(feature)
        {
	        setCenter(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
        }

        function addFusionTable(layer) {
            var newLayer = new google.maps.FusionTablesLayer({
                query: {
                    from: layer.tableId
                },
                suppressInfoWindows: false,
                clickable: (layer.clickable === false ? false : true),
                zIndex: 0
            });

            if (layer.styles) {
                newLayer.setOptions({ styles: layer.styles });
            }

            newLayer.setMap(map);

            customFusionTables[layer.tableId] = newLayer;
        }

        function removeFusionTable(layer) {
            customFusionTables[layer.tableId].setMap(null);
            delete customFusionTables[layer.tableId];
        }

        function resizeMap() {
            google.maps.event.trigger(map, 'resize');
        }

        function setCenter(lat, lng) {
            var latConverted = Number(lat);
            var lngConverted = Number(lng);

            if (!isNaN(latConverted) && !isNaN(lngConverted)) {
                map.setCenter({ lat: latConverted, lng: lngConverted });
            }
        }

        function getCenter() {
            var googleCenter = map.getCenter();
            return { lat: googleCenter.lat(), lng: googleCenter.lng() };
        }

        function setBounds(neLat, neLng, swLat, swLng) {
            map.fitBounds(new google.maps.LatLngBounds(
                new google.maps.LatLng(swLat, swLng),
                new google.maps.LatLng(neLat, neLng)));
        }

        function setZoomLevel(zoomLevel) {
            // Translate value of 1 (whole belgium) to 10 (completely zoomed in) 
            // to the Google equivalents of 8 to 21
            map.setZoom(7 + Math.ceil(zoomLevel / 10 * 14));
        }

        function getZoomLevel() {
            // Translate Google zoom levels of 8 to 21 to 
            // a value of 1 (whole belgium) to 10 (completely zoomed in)
            return parseInt((map.getZoom() - 7) * 10 / 14);
        }

        function getBounds(marginBufferPercentage) {
            if (marginBufferPercentage) {
                var xDiff = (viewPort.bounds.neLng - viewPort.bounds.swLng) * marginBufferPercentage;
                var yDiff = (viewPort.bounds.neLat - viewPort.bounds.swLat) * marginBufferPercentage;

                return {
                    swLng: viewPort.bounds.swLng - xDiff,
                    neLng: viewPort.bounds.neLng + xDiff,
                    swLat: viewPort.bounds.swLat - yDiff,
                    neLat: viewPort.bounds.neLat + yDiff
                };
            }

            return viewPort.bounds;
        }

        function isInBounds(outer, overrideBounds) {
            var actualBounds = overrideBounds || viewPort.bounds;

            return outer.neLat >= actualBounds.neLat && outer.neLng >= actualBounds.neLng &&
                   outer.swLat <= actualBounds.swLat && outer.swLng <= actualBounds.swLng;
        }

        function containsBounds(inner, overrideBounds) {
            var actualBounds = overrideBounds || viewPort.bounds;

            return inner.neLat <= actualBounds.neLat && inner.neLng <= actualBounds.neLng &&
                   inner.swLat >= actualBounds.swLat && inner.swLng >= actualBounds.swLng;
        }

        function containsCoordinate(coordinate, overrideBounds) {
            var actualBounds = overrideBounds || viewPort.bounds;
            var lng = coordinate[0];
            var lat = coordinate[1];

            return lat <= actualBounds.neLat && lng <= actualBounds.neLng &&
                   lat >= actualBounds.swLat && lng >= actualBounds.swLng;
        }

        function activateDrawingMode(callback) {
            drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
            finishedDrawingCallback = callback;
        }

        function getGeoJson() {
            var deferred = $q.defer();

            map.data.toGeoJson(function (geoJson) {
                deferred.resolve(geoJson);
            });

            return deferred.promise;
        }
    }

    ////////// Helper functions

    function googleLatLngToLatLng(googleLatLng) {
        return {
            lat: googleLatLng.lat(),
            lng: googleLatLng.lng()
        };
    }

    function googleLatLngBoundsToBounds(googleLatLngBounds) {
        var ne = googleLatLngBounds.getNorthEast();
        var sw = googleLatLngBounds.getSouthWest();
        return {
            neLat: ne.lat(),
            neLng: ne.lng(),
            swLat: sw.lat(),
            swLng: sw.lng()
        };
    }

    function googlePointArrayToWkt(googlePointArray) {
        var wkt = 'POLYGON ((';
        angular.forEach(googlePointArray, function (point) { // Attention: order should be lng ('x-axis'), lat ('y-axis')
            wkt += point.lng() + ' ' + point.lat() + ', ';
        });
        wkt += googlePointArray.getArray()[0].lng() + ' ' + googlePointArray.getArray()[0].lat(); // End with the first one again
        return wkt + '))';
    }
})();
/**
 * @desc Search google places, optionally add custom search functionality. Includes the search box and results.
 * Can be used to display over your map view, or can be used stand-alone. Only depends on mapManager; can be used with any mapView.
 * Depends on ui-select !
 */
(function () {
    'use strict';

    /* globals google */

    angular
        .module('gnapMapGoogle')
        .directive('googleSearchbox', googleSearchbox);

    googleSearchbox.$inject = ['$timeout', '$log', 'mapManager'];

    function googleSearchbox($timeout, $log, mapManager) {

        ////////// Constants

        var GOOGLE_RESULT_TYPE = 'Google result';

        ////////// Private variables

        var belgium = new google.maps.LatLng(50.762437, 4.245922);

        ////////// Directive declaration

        return {
            restrict: 'AE',
            template: '' +
                '<div ui-select ng-model="searchBoxSelectedValue" id="customSearchBox" theme="select2" style="min-width: 300px;" ng-change="searchBoxSelectedValueChanged(searchBoxSelectedValue, selectionCallback)">' +
                '   <div ui-select-match placeholder="Search box">{{$select.selected.title || $select.selected}}</div>' +
                '   <div data-refresh="searchBoxDropdownChanged($select.search)" ui-select-choices repeat="dropdownItem in searchBoxData">' +
                '       <div ng-bind-html="dropdownItem.title"></div>' +
                '       <small>Type: {{dropdownItem.type}}</small>' +
                '   </div>' +
                '</div>',
            link: link,
            scope: {
                customQuery: '&',
                selectionCallback: '=?'
            }
        };

        function link(scope, element, attrs, mapMgrCtr) {

            ////////// Scope variables and functions

            scope.searchBoxData = [];
            scope.searchBoxSelectedValue = null;
            scope.searchBoxDropdownChanged = searchBoxDropdownChanged;
            scope.searchBoxSelectedValueChanged = searchBoxSelectedValueChanged;

            ////////// Activation function

            activate();

            function activate() {

            }

            ////////// Scope function implementation

            function searchBoxDropdownChanged(input) {
                if (typeof input !== 'undefined' && input.length > 1) {
                    scope.searchBoxData = [];

                    getSearchBoxData(input, scope.searchBoxData);
                }
            }

            function getSearchBoxData(searchString) {
                var promise = scope.customQuery({ searchString: searchString });
                
                if (promise && typeof(promise.then) === 'function') {
                    promise.then(function (result) {
                        scope.searchBoxData = result.data.concat(scope.searchBoxData);
                    });
                }

                var request = {
                    location: belgium,
                    radius: '250',
                    query: searchString
                };

                var service = new google.maps.places.PlacesService(document.createElement('div'));
                service.textSearch(request, googleSearchCallback);
            }

            function googleSearchCallback(results, status) {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    $timeout(function () {
                        for (var i = 0; i < results.length; i++) {
                            var place = results[i];

                            var location;

                            if (place.location) {
                                location = place.location;
                            } else if (place.geometry.location) {
                                location = place.geometry.location;
                            } else if (place.geometry.viewport) {
                                location = place.geometry.viewport;
                            } else if (place.geometry.location) {
                                location = place.geometry.location;
                            }

                            scope.searchBoxData.push({
                                location: location,
                                title: place.name,
                                type: GOOGLE_RESULT_TYPE
                            });
                        }
                    });
                }
            }
        }

        //////// Private functions

        function searchBoxSelectedValueChanged(newValue, selectionCallback) {
            if (newValue) {
                if (newValue.type === GOOGLE_RESULT_TYPE && newValue.location) {
                    // A Google result, has a location
                    mapManager.mapView.viewPort.setCenter(newValue.location.lat(), newValue.location.lng());
                    mapManager.mapView.viewPort.setZoomLevel(6);
                } else if (newValue.bounds) {
                    // Comes from our API and has bounds instead of a position
                    var neLat = newValue.bounds.neLat,
                        neLng = newValue.bounds.neLng,
                        swLat = newValue.bounds.swLat,
                        swLng = newValue.bounds.swLng;

                    if (mapManager.mapFunctionIsSupported(mapManager.mapView.viewPort.setBounds)) {
                        mapManager.mapView.viewPort.setBounds(neLat, neLng, swLat, swLng);
                    } else {
                        mapManager.mapView.viewPort.setCenter((neLat + swLat) / 2, (neLng + swLng) / 2);
                        mapManager.mapView.viewPort.setZoomLevel(5);
                    }
                } else if (newValue.type && newValue.id) {
                    // Comes from our API and has a type & id, we can select it
                    mapManager.events.onDataItemClicked(newValue.type, newValue.id);
                } else if (newValue.position) {
                    // Comes from our API and has a position, but no type & id, so we can navigate to it but not select it
                    mapManager.mapView.viewPort.setCenter(newValue.position.lat, newValue.position.lng);
                    mapManager.mapView.viewPort.setZoomLevel(8);
                } else {
                    // TODO: perhaps display a properly translated 'unfortunately this action is not supported in this map view' notification ?
                    $log.log('Unknown position in selected search result: ' + JSON.stringify(newValue));
                }

                if (selectionCallback) {
                    selectionCallback(newValue);
                }
            }
        }
    }
})();