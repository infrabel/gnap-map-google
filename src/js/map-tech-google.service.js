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