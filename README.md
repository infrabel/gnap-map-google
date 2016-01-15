# Google map view for GNaP Map plugin

Allows the [Google Maps API](https://developers.google.com/maps/documentation/javascript/) to be used as the map view engine for the [GNaP Map plugin](https://github.com/infrabel/gnap-map). Also enables a search box.

## Getting started

#### Installation

- Install this package using `npm install gnap-map-google` in your web project folder.
- Reference dist/gnap-map-google.js or dist/gnap-map-google.min.js in your index.html file, after the gnap-map reference.
- For this Google technology, you must also additionally reference the Google Maps Javascript API (latest tested version: 3.22), with the additional visualization, drawing and places libraries. You should reference this library before all other scripts, before of the the 'vendor/js/vendor.js' section:  
```
<script src="//maps.google.com/maps/api/js?v=3.22&libraries=visualization,drawing,places"></script>
```
- Reference the `gnapMapGoogle` module in your application's module definition (in the GNaP template this is the `app.module.js` file by default).

#### Configuration

##### Defaults

During config time, as with any Map technology, you can set its defaults through the `mapTechGoogleProvider.setDefaults` function. This function takes an object, which can contain the following properties:

- `zoomLevel`: The starting zoom level, in the scale of the map technology. *TODO: we should instead use a start - and end zoomlevel in the scale of the map technology, which the application's 1-10 zoom level scale translates to. Next, we can set the default zoom level in the 1-10 scale on the general mapTechProvider.*
- `center`: The center, as an object, in the map technology's coordinate system and required structure. *TODO: we should probably instead set this as lat/lng on the general mapTechProvider, and use the setCenterWgs84 method of each map tech implementation.*
- `defaultStyleFunction`: Set the default styling function. This is a function which gets passed the following parameters, which it *can* use:
    + `feature` *(object)*: The GeoJson feature object.
    + `iconUrl` *(string)*: The layer's `iconUrl` property; generally a url to an icon.
    + `layerProperties` *(object)*: The entire configuration object for this layer, should you require any other property (including your customly added properties which aren't pre-defined).
    + `zoomLevel` *(int)*: The current zoom level on a scale of 1-10.  

The `defaultStyleFunction` function must return a Google Maps [Style Object](https://developers.google.com/maps/documentation/javascript/reference#Data.StyleOptions) as defined by the Google Maps Javascript API.

##### Styles

The Google Maps technology has an additional configuration method, `mapTechGoogleProvider.setStyles`, which allows you to add custom [Google map styles](https://developers.google.com/maps/documentation/javascript/styling). The function accepts an array of objects with the following properties:

- `id` *(string)*: A technical name for the style layer. Use camelCasing.
- `name` *(string)*: The display name for the layer. Note that it cannot be translated. *TODO: add support for translation?*
- `style` *(object)*: The style configuration object, which you can create using [this tool](http://googlemaps.github.io/js-samples/styledmaps/wizard/index.html). 

The first style in the array will be the default, but when the user changes the style, his choice is stored and re-initialized upon his next visit.

## Dependencies

- The Angular version of [GNaP](http://gnap.io/)
- The [GNaP Map plugin](https://github.com/infrabel/gnap-map)
 
## License

themes-gnap is licensed under [BSD (3-Clause)](http://choosealicense.com/licenses/bsd-3-clause/ "Read more about the BSD (3-Clause) License"). Refer to [LICENSE](https://github.com/infrabel/themes-gnap/blob/master/LICENSE) for more information.

The GNaP theme uses ```Ace - Responsive Admin Template``` as its base theme, which is licensed under [Extended License](https://github.com/infrabel/themes-gnap/blob/master/custom/ace/LICENSE-Ace), our license covers redistribution and usage by you. However, if you would like to show your support to the original author, you can [buy a Single application license here](https://wrapbootstrap.com/theme/ace-responsive-admin-template-WB0B30DGR?ref=cc), it's quite cheap after all.