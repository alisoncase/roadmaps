/* Map of country roadmap data */

// Initialize the map
var map = L.map('map', {
}).setView([20, 0], 2);

// Add base tilelayer
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
    minZoom: 2,
    continuousWorld: false,
    worldCopyJump: false,
    ext: 'png',
    noWrap: true 
}).addTo(map);

// Set the maximum bounds to the world bounds
var bounds = [[-90, -180], [90, 180]];
map.setMaxBounds(bounds);

// Force the map to fit within the bounds on load
map.fitBounds(bounds);

var geojsonLayer;
var proportionalSymbolsLayer;
var bivariateLayer;
var colorScale = d3.scaleQuantize().range(d3.schemeBlues[5]);
var currentIndicator = 'Capacity'; // Default metric on map load
var proportionalLegend; // Legend for proportional symbols
var openPopup; // Variable to store the currently open popup

// Load the CSV data
d3.csv("data/roadmap_data_fy25.csv").then(function(data) {
    console.log("CSV data loaded:", data);

    // Load the metric data
    d3.csv("data/metric_data.csv").then(function(metricData) {
        console.log("Metric data loaded:", metricData);

        // Create containers for button groups
        var buttonContainer = document.getElementById('indicator-buttons');
        var container0 = document.createElement('div');
        var container1 = document.createElement('div');
        var container2 = document.createElement('div');
        var container3 = document.createElement('div');

        container0.className = 'btn-group m-2';
        container1.className = 'btn-group m-2';
        container2.className = 'btn-group m-2';
        container3.className = 'btn-group m-2';

        buttonContainer.appendChild(container0);
        buttonContainer.appendChild(container1);
        buttonContainer.appendChild(container2);
        buttonContainer.appendChild(container3);

        // Function to show popup with metric information
        function showMetricPopup(event, indicator) {
            var metricInfo = metricData.find(d => d.metric === indicator);
            if (metricInfo) {
                var popupContent = `
                    <b>Metric:</b> ${metricInfo.metric}<br>
                    <b>Dimension:</b> ${metricInfo.Dimension}<br>
                    <b>Sub-dimension:</b> ${metricInfo['Sub-dimension']}<br>
                    <b>Definition:</b> ${metricInfo.Definition}<br>
                    <b>Citation:</b> ${metricInfo.Citation}
                `;
                var popup = document.createElement('div');
                popup.className = 'metric-popup';
                popup.innerHTML = popupContent;
                popup.style.position = 'absolute';
                popup.style.left = `${event.clientX}px`;
                popup.style.top = `${event.clientY}px`;
                document.body.appendChild(popup);
            }
        }

        // Function to hide popup
        function hideMetricPopup() {
            var popups = document.getElementsByClassName('metric-popup');
            while (popups.length > 0) {
                popups[0].parentNode.removeChild(popups[0]);
            }
        }

        // Define indicators for each container
        var container0Indicators = ['capacity_commitment'];
        var container1Indicators = [
            'Commitment', 'Liberal Democracy', 'Absence of Corruption', 'Open Government', 
            'Social Group Equality', 'Economic Gender Gap', 'Business & Investment Environment', 
            'Trade Freedom', 'Environmental Policy'
        ];
        var container2Indicators = [
            'Capacity', 'Government Effectiveness', 'Tax System Effectiveness', 
            'Safety & Security', 'Civil Society & Media Effectiveness', 'Poverty Rate ($6.85/Day)', 
            'Education Quality', 'Child Health', 'GDP Per Capita (PPP)', 'Mobile Connectivity', 
            'Export Sophistication'
        ];
        var container3Indicators = ['Risk of External Debt Distress', 'Fragility'];

        // Dynamically generate buttons for each metric in the defined containers
        container0Indicators.forEach(indicator => {
            var button = document.createElement('button');
            button.className = 'btn btn-primary m-1';
            button.style.backgroundColor = 'rgb(15, 72, 114)';
            button.style.borderColor = 'rgb(15, 72, 114)';
            button.innerText = 'Capacity and Commitment';
            button.onclick = function() {
                toggleBivariateMap();
            };
            button.onmouseover = function(event) {
                showMetricPopup(event, 'Capacity and Commitment');
            };
            button.onmouseout = hideMetricPopup;
            container0.appendChild(button);
        });

        container1Indicators.forEach(indicator => {
            var button = document.createElement('button');
            button.className = 'btn btn-primary m-1';
            button.style.backgroundColor = 'rgb(15, 72, 114)';
            button.style.borderColor = 'rgb(15, 72, 114)';
            button.innerText = indicator.replace(/_/g, ' ').charAt(0).toUpperCase() + indicator.replace(/_/g, ' ').slice(1);
            button.onclick = function() {
                updateMap(indicator);
            };
            button.onmouseover = function(event) {
                showMetricPopup(event, indicator);
            };
            button.onmouseout = hideMetricPopup;
            container1.appendChild(button);
        });

        container2Indicators.forEach(indicator => {
            var button = document.createElement('button');
            button.className = 'btn btn-primary m-1';
            button.style.backgroundColor = 'rgb(15, 72, 114)';
            button.style.borderColor = 'rgb(15, 72, 114)';
            button.innerText = indicator.replace(/_/g, ' ').charAt(0).toUpperCase() + indicator.replace(/_/g, ' ').slice(1);
            button.onclick = function() {
                updateMap(indicator);
            };
            button.onmouseover = function(event) {
                showMetricPopup(event, indicator);
            };
            button.onmouseout = hideMetricPopup;
            container2.appendChild(button);
        });

        container3Indicators.forEach(indicator => {
            var button = document.createElement('button');
            button.className = `btn btn-primary m-1 btn-${indicator}`;
            button.style.backgroundColor = 'rgb(128, 0, 0)';
            button.style.borderColor = 'rgb(128, 0, 0)';
            button.innerText = indicator.replace(/_/g, ' ').charAt(0).toUpperCase() + indicator.replace(/_/g, ' ').slice(1);
            button.onclick = function() {
                toggleProportionalSymbols(indicator);
            };
            button.onmouseover = function(event) {
                showMetricPopup(event, indicator);
            };
            button.onmouseout = hideMetricPopup;
            container3.appendChild(button);
        });

        // Load the TopoJSON data
        d3.json("data/map.topojson").then(function(topoData) {
            console.log("TopoJSON data loaded:", topoData);

            // Convert TopoJSON to GeoJSON
            var geojson = topojson.feature(topoData, topoData.objects.collection);

            // Create a function to style each feature
            function style(feature) {
                var countryData = data.find(d => d.country === feature.properties.WP_Name);
                var value = countryData ? countryData[currentIndicator] : null;
                return {
                    fillColor: value !== null ? colorScale(value) : 'none',
                    weight: 1,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: value !== null ? 0.7 : 0
                };
            }

            // Create a function to handle mouseover events
            function onEachFeature(feature, layer) {
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight
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

                var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                var value = countryData ? countryData[currentIndicator] : 'N/A';
                var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>${currentIndicator.charAt(0).toUpperCase() + currentIndicator.slice(1)}: ${value}`;
                layer.bindPopup(popupContent).openPopup();
                openPopup = layer.getPopup(); // Store the currently open popup

                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
            }

            // Reset highlight on mouseout
            function resetHighlight(e) {
                geojsonLayer.resetStyle(e.target);
                if (openPopup) {
                    openPopup._source.closePopup();
                    openPopup = null;
                }
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

                // Add legend title
                labels.push('<strong>' + currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1) + '</strong>');

                // Add "Worst Outcome" label
                labels.push('<i style="background:' + colorScale(grades[0]) + '"></i> Best Outcome');

                // Add color squares for intermediate values without labels
                for (var i = 1; i < grades.length - 1; i++) {
                    var from = grades[i];
                    labels.push('<i style="background:' + colorScale(from) + '"></i>');
                }

                // Add "Best Outcome" label
                labels.push('<i style="background:' + colorScale(grades[grades.length - 1]) + '"></i> Worst Outcome');

                // Add a label for "N/A" with no fill
                labels.push('<i style="background:none; border:1px solid #ccc;"></i> N/A');

                div.innerHTML = labels.join('<br>');
                return div;
            };

            legend.addTo(map);

            // Function to update the map based on the selected indicator
            window.updateMap = function(indicator) {
                currentIndicator = indicator;

                // Remove bivariate layer if it exists
                if (bivariateLayer) {
                    map.removeLayer(bivariateLayer);
                    bivariateLayer = null;
                }

                colorScale.domain([0, d3.max(data, d => +d[indicator])]);

                geojsonLayer.eachLayer(function(layer) {
                    var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                    var value = countryData ? countryData[indicator] : null;
                    layer.setStyle({
                        fillColor: value !== null ? colorScale(value) : 'none',
                        fillOpacity: value !== null ? 0.7 : 0
                    });
                });

                // Update the popup content if a popup is open
                if (openPopup) {
                    var layer = openPopup._source;
                    var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                    var value = countryData ? countryData[currentIndicator] : 'N/A';
                    var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>${currentIndicator.charAt(0).toUpperCase() + currentIndicator.slice(1)}: ${value}`;
                    openPopup.setContent(popupContent).update();
                }

                // Add dynamic legend
                legend.onAdd = function (map) {
                    var div = L.DomUtil.create('div', 'info legend'),
                        grades = colorScale.range().map(d => colorScale.invertExtent(d)[0]).reverse(),
                        labels = [];

                    // Add legend title
                    labels.push('<strong>' + currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1) + '</strong>');

                    // Add "Worst Outcome" label
                    labels.push('<i style="background:' + colorScale(grades[0]) + '"></i> Best Outcome');

                    // Add color squares for intermediate values without labels
                    for (var i = 1; i < grades.length - 1; i++) {
                        var from = grades[i];
                        labels.push('<i style="background:' + colorScale(from) + '"></i>');
                    }

                    // Add "Best Outcome" label
                    labels.push('<i style="background:' + colorScale(grades[grades.length - 1]) + '"></i> Worst Outcome');

                    // Add a label for "N/A" with no fill
                    labels.push('<i style="background:none; border:1px solid #ccc;"></i> N/A');

                    div.innerHTML = labels.join('<br>');
                    return div;
                };

                legend.addTo(map);
            };

            // Function to toggle the bivariate map
            window.toggleBivariateMap = function() {
                currentIndicator = 'capacity_commitment';

                if (bivariateLayer) {
                    map.removeLayer(bivariateLayer);
                    bivariateLayer = null;
                    return;
                }

                var numQuintiles = 5;
                var numColors = 3;
                var capacityValues = [];
                var commitmentValues = [];
                for (let i = 0; i < data.length; i++) {
                    var dataPoint = data[i];
                    capacityValues.push(parseFloat(dataPoint['Capacity']));
                    commitmentValues.push(parseFloat(dataPoint['Commitment']));
                }
                capacityValues.sort(d3.ascending);
                commitmentValues.sort(d3.ascending);
                var capacityQuintiles = d3.scaleQuantile()
                    .domain(capacityValues)
                    .range(d3.range(numQuintiles));
                var commitmentQuintiles = d3.scaleQuantile()
                    .domain(commitmentValues)
                    .range(d3.range(numQuintiles));
                var mapToThree = (value) => Math.floor(value / (numQuintiles / numColors));
                var bivariateColorScale = d3.scaleOrdinal()
                    .domain([
                        "0,0", "0,1", "0,2",
                        "1,0", "1,1", "1,2",
                        "2,0", "2,1", "2,2"
                    ])
                    .range([
                        "#e8e8e8", "#ace4e4", "#5ac8c8",
                        "#dfb0d6", "#a5add3", "#5698b9",
                        "#be64ac", "#8c62aa", "#3b4994"
                    ]);

                function bivariateStyle(feature) {
                    var countryData = data.find(d => d.country === feature.properties.WP_Name);
                    var capacity = countryData ? countryData['Capacity'] : null;
                    var commitment = countryData ? countryData['Commitment'] : null;
                    var capacityQuintile = capacity !== null ? capacityQuintiles(capacity) : null;
                    var commitmentQuintile = commitment !== null ? commitmentQuintiles(commitment) : null;
                    var mappedCapacityQuintile = capacityQuintile !== null ? mapToThree(capacityQuintile) : null;
                    var mappedCommitmentQuintile = commitmentQuintile !== null ? mapToThree(commitmentQuintile) : null;
                    var quintilePair = (mappedCapacityQuintile !== null && mappedCommitmentQuintile !== null) ? [mappedCapacityQuintile, mappedCommitmentQuintile] : null;
                    return {
                        fillColor: quintilePair !== null ? bivariateColorScale(quintilePair.join(",")) : 'none',
                        weight: 1,
                        opacity: 1,
                        color: 'white',
                        fillOpacity: quintilePair !== null ? 0.7 : 0
                    };
                }

                bivariateLayer = L.geoJson(geojson, {
                    style: bivariateStyle,
                    onEachFeature: function(feature, layer) {
                        layer.on({
                            mouseover: function(e) {
                                var layer = e.target;
                                layer.setStyle({
                                    weight: 3,
                                    color: '#666',
                                    fillOpacity: layer.options.fillOpacity 
                                });

                                var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                                var capacity = countryData ? countryData['Capacity'] : 'N/A';
                                var commitment = countryData ? countryData['Commitment'] : 'N/A';
                                var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>Capacity: ${capacity}<br>Commitment: ${commitment}`;
                                layer.bindPopup(popupContent).openPopup();
                                openPopup = layer.getPopup(); 

                                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                                    layer.bringToFront();
                                }
                            },
                            mouseout: function(e) {
                                var layer = e.target;
                                layer.setStyle(bivariateStyle(layer.feature)); 
                                if (openPopup) {
                                    openPopup._source.closePopup();
                                    openPopup = null;
                                }
                            }
                        });
                    }
                }).addTo(map);

                // Add static legend for bivariate map
                legend.onAdd = function (map) {
                    var div = L.DomUtil.create('div', 'info legend'),
                        labels = [];

                    // Add legend title
                    labels.push('<strong>Capacity and Commitment</strong>');

                    // Add bivariate legend image
                    labels.push('<img src="img/bivariate_legend.png" alt="Bivariate Legend" style="width: 60%; display: block; margin: 0 auto;">');

                    div.innerHTML = labels.join('<br>');
                    return div;
                };

                legend.addTo(map);
            };

            // Function to toggle the proportional symbols layer
            window.toggleProportionalSymbols = function(indicator) {
                if (currentIndicator === indicator && proportionalSymbolsLayer) {
                    // If the same indicator is clicked, toggle off the layer
                    map.removeLayer(proportionalSymbolsLayer);
                    proportionalSymbolsLayer = null;
                    if (proportionalLegend) {
                        map.removeControl(proportionalLegend);
                        proportionalLegend = null;
                    }
                    currentIndicator = null; // Reset the current indicator
                    return;
                }

                // Remove the existing proportional layer if it exists
                if (proportionalSymbolsLayer) {
                    map.removeLayer(proportionalSymbolsLayer);
                    proportionalSymbolsLayer = null;
                }
                if (proportionalLegend) {
                    map.removeControl(proportionalLegend);
                    proportionalLegend = null;
                }

                currentIndicator = indicator; // Set the new indicator
                proportionalSymbolsLayer = L.layerGroup();

                geojson.features.forEach(function(feature) {
                    var countryData = data.find(d => d.country === feature.properties.WP_Name);
                    var value = countryData ? countryData[indicator] : null;
                    var radius = 0;
                    var color = "#ff7800";
                    var label = value;

                    if (value === null) {
                        return; // Skip countries with null values
                    }

                    if (indicator === 'Fragility') {
                        if (value <= 30) {
                            radius = 5;
                            color = "#fee5d9";
                            label = 'Sustainable';
                        } else if (value <= 60) {
                            radius = 10;
                            color = "#fcae91";
                            label = 'Stable';
                        } else if (value <= 90) {
                            radius = 15;
                            color = "#fb6a4a"; 
                            label = 'Warning';
                        } else {
                            radius = 20;
                            color = "#cb181d"; 
                            label = 'Alert';
                        }
                    } else if (indicator === 'Risk of External Debt Distress') {
                        if (value == 1) {
                            radius = 5;
                            color = "#fee5d9"; 
                            label = 'Low';
                        } else if (value == 2) {
                            radius = 10;
                            color = "#fcae91"; 
                            label = 'Moderate';
                        } else if (value == 3) {
                            radius = 15;
                            color = "#fb6a4a"; 
                            label = 'High';
                        } else if (value == 4) {
                            radius = 20;
                            color = "#cb181d"; 
                            label = 'In debt distress';
                        }
                    }

                    if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0) {
                        var coordinates = turf.centroid(feature).geometry.coordinates;
                        var latlng = L.latLng(coordinates[1], coordinates[0]);

                        var marker = L.circleMarker(latlng, {
                            radius: radius,
                            fillColor: color,
                            color: "#000",
                            weight: 1,
                            opacity: 1,
                            fillOpacity: 0.8
                        });

                        marker.on('mouseover', function() {
                            var popupContent = `<b>${feature.properties.WP_Name}</b><br>${indicator.charAt(0).toUpperCase() + indicator.slice(1)}: ${label}`;
                            marker.bindPopup(popupContent).openPopup();
                        });

                        marker.on('mouseout', function() {
                            marker.closePopup();
                        });

                        proportionalSymbolsLayer.addLayer(marker);
                    }
                });

                proportionalSymbolsLayer.eachLayer(function(layer) {
                    if (layer.options.radius === 0) {
                        proportionalSymbolsLayer.removeLayer(layer); // Remove markers with radius 0
                    }
                });

                proportionalSymbolsLayer.addTo(map);

                // Update legend for proportional symbols
                proportionalLegend = L.control({ position: 'bottomright' });

                proportionalLegend.onAdd = function (map) {
                    var div = L.DomUtil.create('div', 'info legend'),
                        labels = [];

                    // Add legend title
                    labels.push('<strong>' + currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1) + '</strong>');

                    // Update colored square labels based on the selected indicator
                    if (indicator === 'Fragility') {
                        labels.push(
                            '<i style="background:#cb181d"></i> Alert',
                            '<i style="background:#fb6a4a"></i> Warning',
                            '<i style="background:#fcae91"></i> Stable',
                            '<i style="background:#fee5d9"></i> Sustainable'
                        );
                    } else if (indicator === 'Risk of External Debt Distress') {
                        labels.push(
                            '<i style="background:#cb181d"></i> In debt distress',
                            '<i style="background:#fb6a4a"></i> High',
                            '<i style="background:#fcae91"></i> Moderate',
                            '<i style="background:#fee5d9"></i> Low'
                        );
                    }

                    // Add a label for "N/A" with no fill
                    labels.push('<i style="background:none; border:1px solid #ccc;"></i> N/A');

                    div.innerHTML = labels.join('<br>');
                    return div;
                };

                proportionalLegend.addTo(map);
            };
        }).catch(function(error) {
            console.error("Error loading TopoJSON data:", error);
        });
    }).catch(function(error) {
        console.error("Error loading metric data:", error);
    });
}).catch(function(error) {
    console.error("Error loading CSV data:", error);
});