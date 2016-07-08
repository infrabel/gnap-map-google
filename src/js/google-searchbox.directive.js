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

                if(selectionCallback)
                {
                    selectionCallback(newValue);
                }
            }
        }
    }
})();