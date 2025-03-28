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
var selectedCountries = new Set(); // Track selected countries

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
            // Create a function to style each feature
            //function style(feature) {
            //    var countryData = data.find(d => d.country === feature.properties.WP_Name);
            //    var value = countryData && countryData[currentIndicator] !== null && countryData[currentIndicator] !== "null" && countryData[currentIndicator] !== "" ? countryData[currentIndicator] : null;
                
            //    return {
            //        fillColor: value !== null ? colorScale(value) : 'rgba(0,0,0,0)', // Fully transparent color
            //        weight: 1,
            //        opacity: 1,
            //        color: 'white',
            //        fillOpacity: value !== null ? 0.7 : 0
            //    };
           // }

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
                var value = countryData && countryData[currentIndicator] !== null && countryData[currentIndicator] !== "null" && countryData[currentIndicator] !== "" ? countryData[currentIndicator] : 'Data unavailable';
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
                onEachFeature: function(feature, layer) {
                    layer.on({
                        mouseover: highlightFeature,
                        mouseout: resetHighlight,
                        click: function(e) {
                            var countryName = feature.properties.WP_Name;
                            var countryData = data.find(d => d.country === countryName);
                            updateInfoWindow(countryName, countryData, data);
                        }
                    });
                }
            }).addTo(map);

            // Add a legend to the map
            var legend = L.control({ position: 'bottomright' });

            legend.onAdd = function (map) {
                var div = L.DomUtil.create('div', 'info legend'),
                    grades = colorScale.range().map(d => colorScale.invertExtent(d)[0]).reverse(),
                    labels = [];

                // Add legend title
                labels.push('<strong>' + currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1) + '</strong>');

                // Add "Best Outcome" label
                labels.push('<i style="background:' + colorScale(grades[0]) + '"></i> Best Outcome');

                // Add color squares for intermediate values without labels
                for (var i = 1; i < grades.length - 1; i++) {
                    var from = grades[i];
                    labels.push('<i style="background:' + colorScale(from) + '"></i>');
                }

                // Add "Worst Outcome" label
                labels.push('<i style="background:' + colorScale(grades[grades.length - 1]) + '"></i> Worst Outcome');

                // Add a label for "N/A" with no fill
                labels.push('<i style="background:none; border:1px solid #ccc;"></i> Data unavailable');

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
                //if (openPopup) {
                //    var layer = openPopup._source;
                //    var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                //    var value = countryData ? countryData[currentIndicator] : 'Data unavailable';
                //    var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>${currentIndicator.charAt(0).toUpperCase() + currentIndicator.slice(1)}: ${value}`;
                //    openPopup.setContent(popupContent).update();
                //}
                if (openPopup) {
                    var layer = openPopup._source;
                    var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                    var value = countryData && countryData[currentIndicator] !== null && countryData[currentIndicator] !== "null" && countryData[currentIndicator] !== "" ? countryData[currentIndicator] : 'Data unavailable';
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

                    // Add "Best Outcome" label
                    labels.push('<i style="background:' + colorScale(grades[0]) + '"></i> Best Outcome');

                    // Add color squares for intermediate values without labels
                    for (var i = 1; i < grades.length - 1; i++) {
                        var from = grades[i];
                        labels.push('<i style="background:' + colorScale(from) + '"></i>');
                    }

                    // Add "Worst Outcome" label
                    labels.push('<i style="background:' + colorScale(grades[grades.length - 1]) + '"></i> Worst Outcome');

                    // Add a label for "N/A" with no fill
                    labels.push('<i style="background:none; border:1px solid #ccc;"></i> Data unavailable');

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
                    
                    // Treat both "null" (string), null (value), and blank values as null
                    //if (capacity === null || capacity === "null" || capacity === "" || commitment === null || commitment === "null" || commitment === "") {
                    //    console.log(`No data for ${feature.properties.WP_Name}`);
                    //    return {
                    //        fillColor: 'rgba(0,0,0,0)', // Fully transparent color
                    //        weight: 1,
                    //        opacity: 1,
                    //        color: 'white',
                    //        fillOpacity: 0
                    //    };
                    //}

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
                                var capacity = countryData ? countryData['Capacity'] : 'Data unavailable';
                                var commitment = countryData ? countryData['Commitment'] : 'Data unavailable';
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
                    labels.push('<i style="background:none; border:1px solid #ccc;"></i> Data unavailable');

                    div.innerHTML = labels.join('<br>');
                    return div;
                };

                proportionalLegend.addTo(map);
            };

            // Function to create the information window
            function createInfoWindow() {
                var infoWindow = document.createElement('div');
                infoWindow.id = 'info-window';
                infoWindow.style.position = 'fixed';
                infoWindow.style.bottom = '0';
                infoWindow.style.left = '10%'; // Center the window horizontally
                infoWindow.style.width = '80%'; // Reduce width to 80%
                infoWindow.style.height = '30%';
                infoWindow.style.backgroundColor = 'white';
                infoWindow.style.borderTop = '1px solid #ccc';
                infoWindow.style.display = 'none';
                infoWindow.style.zIndex = '1000';
                infoWindow.style.overflow = 'hidden';
                infoWindow.style.boxShadow = '0 -2px 10px rgba(0, 0, 0, 0.2)';
                document.body.appendChild(infoWindow);

                // Add close button
                var closeButton = document.createElement('button');
                closeButton.innerText = 'X';
                closeButton.style.position = 'absolute';
                closeButton.style.top = '10px';
                closeButton.style.right = '10px';
                closeButton.style.background = 'transparent';
                closeButton.style.border = 'none';
                closeButton.style.fontSize = '16px';
                closeButton.style.cursor = 'pointer';
                closeButton.onclick = function() {
                    infoWindow.style.display = 'none';
                };
                infoWindow.appendChild(closeButton);

                var leftContainer = document.createElement('div');
                leftContainer.id = 'info-left';
                leftContainer.style.width = '50%';
                leftContainer.style.height = '100%';
                leftContainer.style.float = 'left';
                leftContainer.style.overflowY = 'auto';
                leftContainer.style.padding = '10px';
                infoWindow.appendChild(leftContainer);

                var rightContainer = document.createElement('div');
                rightContainer.id = 'info-right';
                rightContainer.style.width = '50%';
                rightContainer.style.height = '100%';
                rightContainer.style.float = 'right';
                rightContainer.style.padding = '10px';
                infoWindow.appendChild(rightContainer);
            }

            // Function to update the information window
            function updateInfoWindow(countryName, countryData, allData) {
                var infoWindow = document.getElementById('info-window');
                var leftContainer = document.getElementById('info-left');
                var rightContainer = document.getElementById('info-right');

                // Populate the left container with country details
                leftContainer.innerHTML = `<h3>${countryName}</h3>`;
                if (countryData) {
                    var metricsList = '<ul>';
                    Object.keys(countryData).forEach(key => {
                        //if (key !== 'country') {
                        //    metricsList += `<li><b>${key}:</b> ${countryData[key] !== null ? countryData[key] : 'Data unavailable'}</li>`;
                        //}
                        if (key !== 'country') {
                            metricsList += `<li><b>${key}:</b> ${countryData[key] !== null && countryData[key] !== "null" ? countryData[key] : 'Data unavailable'}</li>`;
                        }
                    });
                    metricsList += '</ul>';
                    leftContainer.innerHTML += metricsList;
                } else {
                    leftContainer.innerHTML += '<p>No data available for this country.</p>';
                }

                // Create the scatterplot in the right container
                rightContainer.innerHTML = '';
                var svg = d3.select(rightContainer)
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                var containerWidth = rightContainer.clientWidth;
                var containerHeight = rightContainer.clientHeight;

                // Adjust margins to include 15% padding
                var margin = {
                    top: containerHeight * 0.15,
                    right: containerWidth * 0.15,
                    bottom: containerHeight * 0.15,
                    left: containerWidth * 0.15
                };

                var width = containerWidth - margin.left - margin.right;
                var height = containerHeight - margin.top - margin.bottom;

                // Filter out countries with null or undefined values for Capacity or Commitment
                var validData = allData.filter(d => d['Capacity'] && d['Commitment']);

                // Check if the selected country has valid data
                var hasValidData = countryData && countryData['Capacity'] && countryData['Commitment'];

                if (hasValidData) {
                    var x = d3.scaleLinear()
                        .domain([0, d3.max(validData, d => +d['Capacity'])])
                        .range([0, width]);

                    var y = d3.scaleLinear()
                        .domain([0, d3.max(validData, d => +d['Commitment'])])
                        .range([height, 0]);

                    var g = svg.append('g')
                        .attr('transform', `translate(${margin.left},${margin.top})`);

                    // Add axes
                    g.append('g')
                        .attr('transform', `translate(0,${height})`)
                        .call(d3.axisBottom(x));

                    g.append('g')
                        .call(d3.axisLeft(y));

                    // Add x-axis label
                    g.append('text')
                        .attr('x', width / 2)
                        .attr('y', height + margin.bottom - 10)
                        .attr('text-anchor', 'middle')
                        .style('font-size', '12px')
                        .text('Capacity');

                    // Add y-axis label
                    g.append('text')
                        .attr('transform', 'rotate(-90)')
                        .attr('x', -height / 2)
                        .attr('y', -margin.left + 10)
                        .attr('text-anchor', 'middle')
                        .style('font-size', '12px')
                        .text('Commitment');

                    // Add points
                    g.selectAll('.dot')
                        .data(validData)
                        .enter()
                        .append('circle')
                        .attr('class', 'dot')
                        .attr('cx', d => x(+d['Capacity']))
                        .attr('cy', d => y(+d['Commitment']))
                        .attr('r', 5)
                        .attr('fill', d => d.country === countryName ? 'rgb(15, 72, 114)' : 'light grey')
                        .attr('opacity', d => d.country === countryName ? 1 : 0.25);
                } else {
                    // Display message for insufficient data
                    svg.append('text')
                        .attr('x', containerWidth / 2)
                        .attr('y', containerHeight / 2)
                        .attr('text-anchor', 'middle')
                        .style('font-size', '16px')
                        .style('fill', 'light grey')
                        .text('Insufficient data for this country to calculate position on scatterplot');
                }

                // Show the information window
                infoWindow.style.display = 'block';
            }

            // Function to highlight a country on the map
            function highlightCountryOnMap(countryName) {
                geojsonLayer.eachLayer(function(layer) {
                    if (layer.feature.properties.WP_Name === countryName) {
                        layer.setStyle({
                            weight: 3,
                            color: 'yellow',
                            fillOpacity: 0.9
                        });
                    }
                });
            }

            // Function to reset all highlights on the map
            function resetAllHighlights() {
                geojsonLayer.eachLayer(function(layer) {
                    geojsonLayer.resetStyle(layer);
                });
                selectedCountries.forEach(country => highlightCountryOnMap(country)); // Keep selected countries highlighted
            }

            // Function to handle lasso selection
            function handleLassoSelection(selectedDots) {
                selectedCountries.clear();
                selectedDots.forEach(dot => {
                    selectedCountries.add(dot.country);
                    highlightCountryOnMap(dot.country);
                });
            }

            // Update the scatterplot to include hover and click functionality
            function updateScatterplot(countryName, countryData, allData) {
                var rightContainer = document.getElementById('info-right');
                rightContainer.innerHTML = '';
                var svg = d3.select(rightContainer)
                    .append('svg')
                    .attr('width', '100%')
                    .attr('height', '100%');

                var containerWidth = rightContainer.clientWidth;
                var containerHeight = rightContainer.clientHeight;

                var margin = {
                    top: containerHeight * 0.15,
                    right: containerWidth * 0.15,
                    bottom: containerHeight * 0.15,
                    left: containerWidth * 0.15
                };

                var width = containerWidth - margin.left - margin.right;
                var height = containerHeight - margin.top - margin.bottom;

                var validData = allData.filter(d => d['Capacity'] && d['Commitment']);

                var x = d3.scaleLinear()
                    .domain([0, d3.max(validData, d => +d['Capacity'])])
                    .range([0, width]);

                var y = d3.scaleLinear()
                    .domain([0, d3.max(validData, d => +d['Commitment'])])
                    .range([height, 0]);

                var g = svg.append('g')
                    .attr('transform', `translate(${margin.left},${margin.top})`);

                g.append('g')
                    .attr('transform', `translate(0,${height})`)
                    .call(d3.axisBottom(x));

                g.append('g')
                    .call(d3.axisLeft(y));

                g.append('text')
                    .attr('x', width / 2)
                    .attr('y', height + margin.bottom - 10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '12px')
                    .text('Capacity');

                g.append('text')
                    .attr('transform', 'rotate(-90)')
                    .attr('x', -height / 2)
                    .attr('y', -margin.left + 10)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '12px')
                    .text('Commitment');

                var dots = g.selectAll('.dot')
                    .data(validData)
                    .enter()
                    .append('circle')
                    .attr('class', 'dot')
                    .attr('cx', d => x(+d['Capacity']))
                    .attr('cy', d => y(+d['Commitment']))
                    .attr('r', 5)
                    .attr('fill', d => d.country === countryName ? 'blue' : 'lightgrey')
                    .attr('opacity', d => d.country === countryName ? 0.7 : 0.25)
                    .on('mouseover', function(event, d) {
                        d3.select(this).attr('stroke', 'black').attr('stroke-width', 2);
                        var tooltip = d3.select('body').append('div')
                            .attr('class', 'scatter-tooltip')
                            .style('position', 'absolute')
                            .style('background', 'white')
                            .style('border', '1px solid #ccc')
                            .style('padding', '5px')
                            .style('pointer-events', 'none')
                            .style('font-size', '12px')
                            .text(d.country);
                        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
                    })
                    .on('mouseout', function() {
                        d3.select(this).attr('stroke', null);
                        d3.selectAll('.scatter-tooltip').remove();
                    })
                    .on('click', function(event, d) {
                        selectedCountries.add(d.country);
                        highlightCountryOnMap(d.country);
                    });

                // Add lasso functionality
                var lasso = d3.lasso()
                    .closePathSelect(true)
                    .closePathDistance(100)
                    .items(dots)
                    .targetArea(svg)
                    .on('start', function() {
                        dots.attr('stroke', null);
                    })
                    .on('draw', function() {
                        lasso.items().filter(d3.lasso.selected)
                            .attr('stroke', 'black')
                            .attr('stroke-width', 2);
                    })
                    .on('end', function() {
                        var selectedDots = lasso.items().filter(d3.lasso.selected).data();
                        handleLassoSelection(selectedDots);
                    });

                svg.call(lasso);
            }

            // Modify the map click handler to keep the selected country highlighted
            geojsonLayer.eachLayer(function(layer) {
                layer.on('click', function(e) {
                    var countryName = layer.feature.properties.WP_Name;
                    selectedCountries.add(countryName);
                    highlightCountryOnMap(countryName);
                    var countryData = data.find(d => d.country === countryName);
                    updateInfoWindow(countryName, countryData, data);
                });
            });

            // Create the information window on page load
            createInfoWindow();

        }).catch(function(error) {
            console.error("Error loading TopoJSON data:", error);
        });
    }).catch(function(error) {
        console.error("Error loading metric data:", error);
    });
}).catch(function(error) {
    console.error("Error loading CSV data:", error);
});