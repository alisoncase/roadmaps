/* Map of country roadmap data */

// Initialize the map
var map = L.map('map').setView([20, 0], 2);

// Add base tilelayer
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
    ext: 'png'
}).addTo(map);

var geojsonLayer;
var proportionalSymbolsLayer;
var colorScale = d3.scaleQuantize().range(d3.schemeBlues[5]);
var currentIndicator = 'capacity'; // Default metric on map load

// Load the CSV data
d3.csv("data/roadmap_data_fy25.csv").then(function(data) {
    console.log("CSV data loaded:", data);

    // Dynamically generate buttons for each metric in capacity and commitment dimensions
    var indicators = Object.keys(data[0]).filter(key => key !== 'country' && key !== 'fragility' && key !== 'debt_risk');
    var buttonContainer = document.getElementById('indicator-buttons');
    indicators.forEach(indicator => {
        var button = document.createElement('button');
        button.className = 'btn btn-primary m-1';
        button.innerText = indicator.charAt(0).toUpperCase() + indicator.slice(1);
        button.onclick = function() {
            updateMap(indicator);
        };
        buttonContainer.appendChild(button);
    });

    // Add buttons for "fragility" and "debt_risk" metrics
    ['fragility', 'debt_risk'].forEach(indicator => {
        var button = document.createElement('button');
        button.className = `btn btn-primary m-1 btn-${indicator}`;
        button.innerText = indicator.charAt(0).toUpperCase() + indicator.slice(1);
        button.onclick = function() {
            updateProportionalSymbols(indicator);
        };
        buttonContainer.appendChild(button);
    });

    // Load the TopoJSON data
    d3.json("data/map.topojson").then(function(topoData) {
        console.log("TopoJSON data loaded:", topoData);

        // Convert TopoJSON to GeoJSON
        var geojson = topojson.feature(topoData, topoData.objects.collection);

        // Create a function to style each feature
        function style(feature) {
            var countryData = data.find(d => d.country === feature.properties.WP_Name);
            return {
                fillColor: countryData ? colorScale(countryData[currentIndicator]) : '#ccc',
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.7
            };
        }

        // Create a function to handle mouseover events
        function onEachFeature(feature, layer) {
            layer.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: showPopup
            });
        }

        // Highlight feature on mouseover
        function highlightFeature(e) {
            var layer = e.target;

            layer.setStyle({
                weight: 3,
                color: '#666',
                fillOpacity: 0.9
            });

            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        }

        // Reset highlight on mouseout
        function resetHighlight(e) {
            geojsonLayer.resetStyle(e.target);
        }

        // Show popup on click
        function showPopup(e) {
            var layer = e.target;
            var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
            var value = countryData ? countryData[currentIndicator] : 'N/A';
            var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>${currentIndicator.charAt(0).toUpperCase() + currentIndicator.slice(1)}: ${value}`;
            layer.bindPopup(popupContent).openPopup();
        }

        // Add the GeoJSON layer to the map
        geojsonLayer = L.geoJson(geojson, {
            style: style,
            onEachFeature: onEachFeature
        }).addTo(map);

        // Add a legend to the map
        var legend = L.control({ position: 'bottomright' });

        legend.onAdd = function (map) {
            var div = L.DomUtil.create('div', 'info legend'),
                grades = colorScale.range().map(d => colorScale.invertExtent(d)[0]).reverse(),
                labels = [];

            // Create a legend label with a different color for each quantile interval of the indicator
            for (var i = 0; i < grades.length; i++) {
                var from = grades[i];
                var to = grades[i + 1];

                labels.push(
                    '<i style="background:' + colorScale(from) + '"></i> ' +
                    from.toFixed(2) + (to ? '&ndash;' + to.toFixed(2) : '+')
                );
            }

            div.innerHTML = labels.join('<br>');
            return div;
        };

        legend.addTo(map);

        // Function to update the map based on the selected indicator
        window.updateMap = function(indicator) {
            currentIndicator = indicator;

            if (proportionalSymbolsLayer) {
                map.removeLayer(proportionalSymbolsLayer);
            }

            colorScale.domain([0, d3.max(data, d => +d[indicator])]);

            geojsonLayer.eachLayer(function(layer) {
                var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                layer.setStyle({
                    fillColor: countryData ? colorScale(countryData[indicator]) : '#ccc'
                });
            });

            // Add dynamic legend
            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'info legend'),
                    grades = colorScale.range().map(d => colorScale.invertExtent(d)[0]).reverse(),
                    labels = [];

                // Update colored square labels based on the selected indicator
                for (var i = 0; i < grades.length; i++) {
                    var from = grades[i];
                    var to = grades[i + 1];

                    labels.push(
                        '<i style="background:' + colorScale(from) + '"></i> ' +
                        from.toFixed(2) + (to ? '&ndash;' + to.toFixed(2) : '+')
                    );
                }

                div.innerHTML = labels.join('<br>');
                return div;
            };

            legend.addTo(map);
        };

        // Function to update the map with proportional symbols
        window.updateProportionalSymbols = function(indicator) {
            currentIndicator = indicator;

            if (geojsonLayer) {
                map.removeLayer(geojsonLayer);
            }
            if (proportionalSymbolsLayer) {
                map.removeLayer(proportionalSymbolsLayer);
            }

            proportionalSymbolsLayer = L.layerGroup();

            geojson.features.forEach(function(feature) {
                var countryData = data.find(d => d.country === feature.properties.WP_Name);
                var value = countryData ? countryData[indicator] : 0;
                var radius = 0;
                var color = "#ff7800";

                if (indicator === 'fragility') {
                    if (value <= 30) {
                        radius = 5;
                        color = "#fee5d9";
                    } else if (value <= 60) {
                        radius = 10;
                        color = "#fcae91";
                    } else if (value <= 90) {
                        radius = 15;
                        color = "#fb6a4a"; 
                    } else {
                        radius = 20;
                        color = "#cb181d"; 
                    }
                } else if (indicator === 'debt_risk') {
                    if (value == 1) {
                        radius = 5;
                        color = "#fee5d9"; 
                    } else if (value == 2) {
                        radius = 10;
                        color = "#fcae91"; 
                    } else if (value == 3) {
                        radius = 15;
                        color = "#fb6a4a"; 
                    } else if (value == 4) {
                        radius = 20;
                        color = "#cb181d"; 
                    }
                }

                var marker = L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
                    radius: radius,
                    fillColor: color,
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`<b>${feature.properties.WP_Name}</b><br>${indicator.charAt(0).toUpperCase() + indicator.slice(1)}: ${value}`);

                proportionalSymbolsLayer.addLayer(marker);
            });

            proportionalSymbolsLayer.addTo(map);
        };
    }).catch(function(error) {
        console.error("Error loading TopoJSON data:", error);
    });
}).catch(function(error) {
    console.error("Error loading CSV data:", error);
});