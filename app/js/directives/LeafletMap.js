angular.module('lakeViewApp').directive('leafletMap', function(CanvasLayer, ShowCoordinates, $timeout) {
    // Definition of available swisstopo tiles (bounding box) and resolutions
    // Source: https://api3.geo.admin.ch/services/sdiservices.html#parameters
    var TOP_LEFT = L.point(420000, 350000);
    var BOTTOM_RIGHT = L.point(900000, 30000);
    var RESOLUTIONS = [4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000,
                      1750, 1500, 1250, 1000, 750, 650, 500, 250, 100, 50, 20, 10, 5, 2.5];

    // Definition for projected coordinate system CH1903 / LV03
    // Source: https://epsg.io/21781.js
    var CRS = new L.Proj.CRS('EPSG:21781',
        '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=600000 +y_0=200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs',
        {
            resolutions: RESOLUTIONS,
            origin: [TOP_LEFT.x, TOP_LEFT.y]
        });

    var BOUNDS = L.latLngBounds(unproject(TOP_LEFT), unproject(BOTTOM_RIGHT));

    function project(point) {
        return CRS.projection.project(point);
    }

    function unproject(point) {
        return CRS.projection.unproject(point);
    }

    function formatCoordinates(latlng) {
        if (BOUNDS.contains(latlng)) {
            var p = project(latlng);
            return Math.round(p.x) + ', ' + Math.round(p.y);
        }
        return '';
    }

    function initMapbox(container) {
        var mbAttr = 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, ' +
                     '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
                     'Imagery © <a href="https://mapbox.com">Mapbox</a>';
        var mbUrl = 'https://{s}.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={access_token}';

        var map = L.map(container);

        L.tileLayer(mbUrl, {
            subdomains: 'abcd',
            maxZoom: 18,
            attribution: mbAttr,
            id: 'mapbox.streets',
            access_token: 'pk.eyJ1IjoiYXBoeXMiLCJhIjoiY2ltM2g1MzUwMDBwOXZtbTVzdnQ1ZHZpYiJ9.Cm1TVUsbCQLOhUbblOrHfw'
            // lake-view token for user aphys obtained from mapbox.com
        }).addTo(map);

        return map;
    }

    return {
        restrict: 'E',
        scope: {
            active: '=',
            setHandler: '&',
            onClick: '&',
            marker: '=',
            data: '=',
            draw: '='
        },
        link: function(scope, element, attrs) {
            element.addClass('lv-map');
            var container = element[0];

            var bounds;
            var map = initMapbox(container);
            var canvasLayer = L.canvasLayer({ dataSource: 'surface' });
            var markerLayer;

            canvasLayer.addTo(map);
            L.control.showcoordinates({ format: formatCoordinates }).addTo(map);

            scope.setHandler({ handler: function() {
                canvasLayer.redraw();
            } });

            map.on('click', function(e) {
                scope.onClick({ point: project(e.latlng) });
                scope.$apply();
            });

            canvasLayer.setDrawFunction(scope.draw);

            scope.$watch('active', function() {
                if (scope.active) {
                    $timeout(function() {
                        map.invalidateSize(false);
                        fitBounds();
                    });
                }
            });

            scope.$watch('marker', function(marker) {
                if (scope.active && marker) {
                    // Update marker
                    var latlng = unproject(marker);
                    if (markerLayer) {
                        markerLayer.setLatLng(latlng);
                    } else {
                        markerLayer = L.marker(latlng).addTo(map);
                    }
                } else if (markerLayer) {
                    // Remove marker
                    map.removeLayer(markerLayer);
                    markerLayer = null;
                }
            });

            scope.$watch('data.ready', function() {
                var data = scope.data;

                if (data && data.ready) {
                    var minBounds = unproject(L.point(data.xExtent[0], data.yExtent[0]));
                    var maxBounds = unproject(L.point(data.xExtent[1], data.yExtent[1]));
                    updateBounds(L.latLngBounds(minBounds, maxBounds));

                    var projectedData = data.map(function(d) {
                        var latlng = unproject(L.point(d.x, d.y));
                        return {
                            lat: latlng.lat,
                            lng: latlng.lng,
                            values: d.values
                        };
                    });
                    canvasLayer.setData(projectedData);
                }
            });

            function updateBounds(newBounds) {
                if (!newBounds.equals(bounds)) {
                    bounds = newBounds;
                    fitBounds();
                }
            }

            function fitBounds() {
                if (bounds) {
                    // zoom map such that at least 90% of the area given by bounds is visible
                    map.fitBounds(bounds.pad(-0.05));
                }
            }
        }
    };
});
