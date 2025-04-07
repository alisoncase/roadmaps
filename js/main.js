/* Map of country roadmap data */

document.addEventListener('DOMContentLoaded', function () {
    // Check if Turf.js is loaded
    if (typeof turf === 'undefined') {
        console.error('Turf.js is not loaded or defined. Please ensure the Turf.js library is included before this script.');
    }

    // Initialize the map
    var map = L.map('map', {}).setView([20, 0], 2);

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
    //map.fitBounds(bounds);

    var geojsonLayer;
    var proportionalSymbolsLayer;
    var bivariateLayer;
    var colorScale = d3.scaleSequential(d3.interpolateBlues); // Updated to use sequential unclassed continuous scale
    var currentIndicator = 'Capacity'; // Default metric on map load
    var proportionalLegend; // Legend for proportional symbols
    var openPopup; // Variable to store the currently open popup
    var selectedCountries = new Set(); // Track selected countries

    // Function to reset all highlights on the map
    function resetAllHighlights() {
        geojsonLayer.eachLayer(function(layer) {
            geojsonLayer.resetStyle(layer);
        });
        selectedCountries.clear(); // Clear the set of selected countries
    }

    // Function to dehighlight a specific country on the map
    function dehighlightCountryOnMap(countryName) {
        geojsonLayer.eachLayer(function(layer) {
            if (layer.feature.properties.WP_Name === countryName) {
                geojsonLayer.resetStyle(layer);
            }
        });
        selectedCountries.delete(countryName); // Remove the country from the selected set
    }

    // Function to highlight a country on the map
    function highlightCountryOnMap(countryName) {
        geojsonLayer.eachLayer(function(layer) {
            if (layer.feature.properties.WP_Name === countryName) {
                layer.setStyle({
                    weight: 2,
                    color: 'rgb(128, 0, 0)',
                    fillOpacity: 0.9
                });
                layer.bringToFront(); // Bring the highlighted layer to the top
            }
        });
    }

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
                button.style.backgroundColor = '#2a1a8a';
                button.style.borderColor = '#2a1a8a';
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
                    var value = countryData && countryData[currentIndicator] !== null && countryData[currentIndicator] !== "null" && countryData[currentIndicator] !== "" 
                        ? (+countryData[currentIndicator]).toFixed(2) // Fix the value to two decimal places
                        : 'Data unavailable';
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
                    var div = L.DomUtil.create('div', 'info legend');
                    var gradientId = 'legend-gradient';

                    // Create a gradient bar
                    div.innerHTML = `
                        <strong>${currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1)}</strong>
                        <div style="position: relative; height: 20px; width: 100%; background: linear-gradient(to right, ${d3.interpolateBlues(0)}, ${d3.interpolateBlues(1)});"></div>
                        <div style="display: flex; justify-content: space-between; font-size: 10px;">
                            <span>Worst outcome</span>
                            <span>Best outcome</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-top: 5px; font-size: 10px;">
                            <i style="width: 18px; height: 18px; border: 1px solid #ccc; margin-right: 5px; background: none;"></i>
                            <span>Data unavailable</span>
                        </div>
                    `;
                    return div;
                };

                legend.addTo(map);

                // Function to highlight the selected button
                function highlightSelectedButton(indicator) {
                    // Remove 'active' class from all buttons
                    var buttons = document.querySelectorAll('#indicator-buttons button');
                    buttons.forEach(button => button.classList.remove('active'));

                    // Add 'active' class to the button corresponding to the selected indicator
                    var selectedButton = Array.from(buttons).find(button => button.innerText === indicator.replace(/_/g, ' ').charAt(0).toUpperCase() + indicator.replace(/_/g, ' ').slice(1));
                    if (selectedButton) {
                        selectedButton.classList.add('active');
                    }
                }

                // Function to update the map based on the selected indicator
                window.updateMap = function(indicator) {
                    currentIndicator = indicator;

                    // Remove bivariate layer if it exists
                    if (bivariateLayer) {
                        map.removeLayer(bivariateLayer);
                        bivariateLayer = null;
                        legend.remove(); // Remove the bivariate legend
                    }

                    // Remove the univariate layer if it exists
                    if (geojsonLayer) {
                        map.removeLayer(geojsonLayer);
                    }

                    // Update the domain of the color scale based on the data range
                    var values = data.map(d => +d[indicator]).filter(v => !isNaN(v));
                    colorScale.domain([d3.min(values), d3.max(values)]);

                    // Add the univariate layer
                    geojsonLayer = L.geoJson(geojson, {
                        style: function(feature) {
                            var countryData = data.find(d => d.country === feature.properties.WP_Name);
                            var value = countryData ? countryData[indicator] : null;
                            return {
                                fillColor: value !== null ? colorScale(value) : 'none',
                                weight: 1,
                                opacity: 1,
                                color: 'white',
                                fillOpacity: value !== null ? 0.7 : 0
                            };
                        },
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

                    // Bring the proportional symbols layer to the front if it exists
                    if (proportionalSymbolsLayer) {
                        proportionalSymbolsLayer.eachLayer(function(layer) {
                            layer.bringToFront();
                        });
                    }

                    // Update the popup content if a popup is open
                    if (openPopup) {
                        var layer = openPopup._source;
                        var countryData = data.find(d => d.country === layer.feature.properties.WP_Name);
                        var value = countryData && countryData[currentIndicator] !== null && countryData[currentIndicator] !== "null" && countryData[currentIndicator] !== "" 
                            ? (+countryData[currentIndicator]).toFixed(2) // Fix the value to two decimal places
                            : 'Data unavailable';
                        var popupContent = `<b>${layer.feature.properties.WP_Name}</b><br>${currentIndicator.charAt(0).toUpperCase() + currentIndicator.slice(1)}: ${value}`;
                        openPopup.setContent(popupContent).update();
                    }

                    // Update the legend to show a gradient bar with updated labels
                    legend.onAdd = function(map) {
                        var div = L.DomUtil.create('div', 'info legend');
                        var gradientId = 'legend-gradient';

                        // Create a gradient bar with "Worst outcome" and "Best outcome" labels
                        div.innerHTML = `
                            <strong>${currentIndicator.replace(/_/g, ' ').charAt(0).toUpperCase() + currentIndicator.replace(/_/g, ' ').slice(1)}</strong>
                            <div style="position: relative; height: 20px; width: 100%; background: linear-gradient(to right, ${d3.interpolateBlues(0)}, ${d3.interpolateBlues(1)});"></div>
                            <div style="display: flex; justify-content: space-between; font-size: 10px;">
                                <span>Worst outcome</span>
                                <span>Best outcome</span>
                            </div>
                            <div style="display: flex; align-items: center; margin-top: 5px; font-size: 10px;">
                                <i style="width: 18px; height: 18px; border: 1px solid #ccc; margin-right: 5px; background: none;"></i>
                                <span>Data unavailable</span>
                            </div>
                        `;
                        return div;
                    };

                    legend.addTo(map);

                    // Highlight the selected button
                    highlightSelectedButton(indicator);

                    // Ensure the information panel is hidden when toggling metrics
                    var infoWindow = document.getElementById('info-window');
                    if (infoWindow) {
                        infoWindow.style.display = 'none';
                    }
                };

                // Function to toggle the bivariate map
                window.toggleBivariateMap = function() {
                    // If the bivariate layer is already active, toggle it off
                    if (bivariateLayer) {
                        map.removeLayer(bivariateLayer);
                        bivariateLayer = null;
                        legend.remove(); // Remove the bivariate legend
                        return;
                    }

                    // Remove the univariate layer if it exists
                    if (geojsonLayer) {
                        map.removeLayer(geojsonLayer);
                    }

                    currentIndicator = 'capacity_commitment';

                    // Define the number of quintiles
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
                        // Subdued pink blue color scheme
                        //.range([
                        //    "#e8e8e8", "#ace4e4", "#5ac8c8",
                        //    "#dfb0d6", "#a5add3", "#5698b9",
                        //    "#be64ac", "#8c62aa", "#3b4994"
                        //Bright pink blue color scheme
                        .range([
                            "#e8e6f2", "#b5d3e7", "#4fadd0", 
                            "#e5b4d9", "#b8b3d8", "#3983bb", 
                            "#de4fa6", "#b03598", "#2a1a8a"
                            
                    ]);

                    function bivariateStyle(feature) {
                        var countryData = data.find(d => d.country === feature.properties.WP_Name);
                        var capacity = countryData ? parseFloat(countryData['Capacity']) : null;
                        var commitment = countryData ? parseFloat(countryData['Commitment']) : null;

                        // Check for null values and set no fill if either variable is null
                        if (capacity === null || isNaN(capacity) || commitment === null || isNaN(commitment)) {
                            return {
                                fillColor: 'none',
                                weight: 1,
                                opacity: 1,
                                color: 'white',
                                fillOpacity: 0
                            };
                        }

                        var capacityQuintile = capacityQuintiles(capacity);
                        var commitmentQuintile = commitmentQuintiles(commitment);
                        var mappedCapacityQuintile = mapToThree(capacityQuintile);
                        var mappedCommitmentQuintile = mapToThree(commitmentQuintile);
                        var quintilePair = [mappedCapacityQuintile, mappedCommitmentQuintile];
                        return {
                            fillColor: bivariateColorScale(quintilePair.join(",")),
                            weight: 1,
                            opacity: 1,
                            color: 'white',
                            fillOpacity: 0.7
                        };
                    }

                    // Add a click event to open the information window for the bivariate layer
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
                                    var capacity = countryData && countryData['Capacity'] !== null && countryData['Capacity'] !== "null" && countryData['Capacity'] !== ""
                                        ? (+countryData['Capacity']).toFixed(2) // Fix Capacity to two decimal places
                                        : 'Data unavailable';
                                    var commitment = countryData && countryData['Commitment'] !== null && countryData['Commitment'] !== "null" && countryData['Commitment'] !== ""
                                        ? (+countryData['Commitment']).toFixed(2) // Fix Commitment to two decimal places
                                        : 'Data unavailable';

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
                                },
                                click: function(e) {
                                    var countryName = feature.properties.WP_Name;
                                    var countryData = data.find(d => d.country === countryName);
                                    updateInfoWindow(countryName, countryData, data); // Open the information window
                                }
                            });
                        }
                    });

                    // Add the bivariate layer below the proportional symbols layer
                    bivariateLayer.addTo(map);
                    if (proportionalSymbolsLayer) {
                        proportionalSymbolsLayer.eachLayer(function(layer) {
                            layer.bringToFront();
                        });
                    }

                    // Add static legend for bivariate map
                    legend.onAdd = function (map) {
                        var div = L.DomUtil.create('div', 'info legend'),
                            labels = [];

                        // Add legend title
                        labels.push('<strong>Capacity and Commitment</strong>');

                        // Add bivariate legend image
                        labels.push('<img src="img/bivariate_legend.png" alt="Bivariate Legend" style="width: 60%; display: block; margin: 0 auto;">');

                        // Add "Insufficient data" square
                        labels.push(`
                            <div style="display: flex; align-items: center; margin-top: 5px; font-size: 10px;">
                                <i style="width: 18px; height: 18px; border: 1px solid #ccc; margin-right: 5px; background: none;"></i>
                                <span>Insufficient data</span>
                            </div>
                        `);

                        div.innerHTML = labels.join('<br>');
                        return div;
                    };

                    legend.addTo(map);

                    // Highlight the bivariate button
                    highlightSelectedButton('Capacity and Commitment');
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

                    // Ensure turf is defined before using it
                    if (typeof turf === 'undefined') {
                        console.error('Turf.js is not loaded or defined.');
                    } else {
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
                    }

                    proportionalSymbolsLayer.eachLayer(function(layer) {
                        if (layer.options.radius === 0) {
                            proportionalSymbolsLayer.removeLayer(layer); // Remove markers with radius 0
                        }
                    });

                    proportionalSymbolsLayer.addTo(map);

                    // Bring the proportional symbols layer to the front
                    proportionalSymbolsLayer.eachLayer(function(layer) {
                        layer.bringToFront();
                    });

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
                        resetAllHighlights(); // Reset all highlights when the panel is closed
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

                    infoWindow.style.display = 'block'; // Ensure the info window is visible
                    leftContainer.innerHTML = `<h3>${countryName}</h3>`; // Clear and add country name

                    // Ensure the left container has a valid width
                    var leftWidth = leftContainer.clientWidth;
                    if (leftWidth <= 0) {
                        console.error('Invalid left container width. Ensure the container has a valid width before rendering.');
                        return;
                    }

                    // Populate the left container with dot plots for each metric
                    leftContainer.innerHTML = `<h3>${countryName}</h3>`;
                    if (countryData) {
                        Object.keys(countryData).forEach(key => {
                            // Skip the "Fragility" and "Risk of External Debt Distress" metrics
                            if (key === 'Fragility' || key === 'Risk of External Debt Distress' || key === 'Commitment' || key === 'Capacity' ||key === 'country') {
                                return;
                            }                   
                                                           
                            // Check if the value is null or empty
                            if (!countryData || countryData[key] === null || countryData[key] === "") {
                                var metricContainer = document.createElement('div'); // Define metricContainer
                                metricContainer.style.marginBottom = '15px';

                                // Add the metric name
                                var metricName = document.createElement('div');
                                metricName.textContent = key;
                                metricName.style.fontWeight = 'bold';
                                metricName.style.marginBottom = '5px';
                                metricContainer.appendChild(metricName);

                                // Add the 'Data unavailable' message
                                var unavailableMessage = document.createElement('div');
                                unavailableMessage.textContent = 'Data unavailable';
                                unavailableMessage.style.color = 'darkgrey';
                                unavailableMessage.style.fontStyle = 'italic';
                                metricContainer.appendChild(unavailableMessage);

                                leftContainer.appendChild(metricContainer);
                                return;
                            }
                                
                                // Create a container for each metric's dot plot
                                var metricContainer = document.createElement('div');
                                metricContainer.style.marginBottom = '15px';

                                // Add the metric name
                                var metricName = document.createElement('div');
                                metricName.textContent = key;
                                metricName.style.fontWeight = 'bold';
                                metricName.style.marginBottom = '5px';
                                metricContainer.appendChild(metricName);

                                // Create an SVG for the dot plot
                                var svgWidth = leftContainer.clientWidth - 30; // Adjust for padding
                                var svgHeight = 50;
                                var margin = { top: 10, right: 30, bottom: 20, left: 10 };
                                var width = svgWidth - margin.left - margin.right;
                                var height = svgHeight - margin.top - margin.bottom;

                                if (svgWidth <= 0) {
                                    console.error('Invalid SVG width. Ensure the container has a valid width before rendering the SVG.');
                                    return;
                                }

                                var svg = d3.create('svg')
                                    .attr('width', svgWidth)
                                    .attr('height', svgHeight);

                                var g = svg.append('g')
                                    .attr('transform', `translate(${margin.left},${margin.top})`);

                                // Get all values for the metric
                                var values = allData.map(d => +d[key]).filter(v => !isNaN(v));
                                var selectedValue = +countryData[key];

                                // Calculate the average value for the metric
                                var averageValue = d3.mean(values);
                                
                                // Create scales
                                var xScale = d3.scaleLinear()
                                    .domain([0, 1]) // Set the domain to [0, 1]
                                    .range([0, width]);


                                // Add axis with a single tick at the average value
                                g.append('g')
                                .attr('transform', `translate(0,${height})`)
                                .call(d3.axisBottom(xScale)
                                    .tickValues([averageValue]) // Set the tick to the average value
                                    .tickFormat(() => 'Average') // Set the tick label to "Average"
                                    .tickSize(-height)) // Extend the tick line across the plot
                                .call(g => g.select('.domain').remove()) // Remove the axis line
                                .call(g => g.selectAll('.tick line').attr('stroke', '#ccc')); // Style the tick line

                                // Add dots for all countries
                                g.selectAll('.dot')
                                    .data(values)
                                    .enter()
                                    .append('circle')
                                    .attr('class', 'dot')
                                    .attr('cx', d => xScale(d))
                                    .attr('cy', height / 2)
                                    .attr('r', 3)
                                    .attr('fill', 'lightgrey')
                                    .attr('opacity', 0.7);

                                // Add a highlighted dot for the selected country
                                g.append('circle')
                                    .attr('class', 'selected-dot')
                                    .attr('cx', xScale(selectedValue))
                                    .attr('cy', height / 2)
                                    .attr('r', 5)
                                    .attr('fill', 'rgb(0, 0, 139)')
                                    .attr('opacity', 1)
                                    .on('mouseover', function(event) {
                                        var tooltip = d3.select('body').append('div')
                                            .attr('class', 'scatter-tooltip')
                                            .style('position', 'absolute')
                                            .style('background', 'white')
                                            .style('border', '1px solid #ccc')
                                            .style('padding', '5px')
                                            .style('pointer-events', 'none')
                                            .style('font-size', '12px')
                                            .text(selectedValue.toFixed(2)); // Fix the number to two decimal places
                                        tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 10) + 'px');
                                    })
                                    .on('mouseout', function() {
                                        d3.selectAll('.scatter-tooltip').remove();
                                    });

                                // Append the SVG to the metric container
                                metricContainer.appendChild(svg.node());
                                leftContainer.appendChild(metricContainer);
                            //}
                        });
                    } else {
                        leftContainer.innerHTML += '<p>No data available for this country.</p>';
                    }

                    // Create the scatterplot in the right container
                    updateScatterplot(countryName, countryData, allData);

                    // Show the information window
                    infoWindow.style.display = 'block';
                }

                // Function to create or update the scatterplot in the information panel
                function updateScatterplot(countryName, countryData, allData) {
                    var rightContainer = document.getElementById('info-right');
                    rightContainer.style.display = 'block'; // Ensure the container is visible
                    rightContainer.innerHTML = ''; // Clear the container

                    // Dynamically recalculate the width of the container
                    var svgWidth = rightContainer.clientWidth;
                    if (svgWidth <= 0) {
                        console.error('Invalid SVG width. Ensure the container has a valid width before rendering the SVG.');
                        return; // Exit the function if the width is invalid
                    }

                    var svgHeight = rightContainer.clientHeight;
                    var margin = { top: 20, right: 30, bottom: 70, left: 50 };
                    var width = svgWidth - margin.left - margin.right;
                    var height = svgHeight - margin.top - margin.bottom;

                    // Filter valid data for scatterplot
                    var validData = allData.filter(d => d['Capacity'] && d['Commitment']);

                    // Check if the selected country has null values
                    if (!countryData || !countryData['Capacity'] || !countryData['Commitment']) {
                        rightContainer.innerHTML = `
                            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: darkgrey; font-size: 18px;">
                                Insufficient data to calculate position on scatterplot
                            </div>`;
                        return;
                    }
                   
                    // Create scales
                    var xScale = d3.scaleLinear()
                    .domain([0, 1]) // Set the domain to [0, 1]
                    .range([0, width]);

                    var yScale = d3.scaleLinear()
                    .domain([0, 1]) // Set the domain to [0, 1]
                    .range([height, 0]);

                    // Create SVG
                    var svg = d3.select(rightContainer)
                        .append('svg')
                        .attr('width', svgWidth)
                        .attr('height', svgHeight);

                    var g = svg.append('g')
                        .attr('transform', `translate(${margin.left},${margin.top})`);

                    // Add axes
                    g.append('g')
                        .attr('transform', `translate(0,${height})`)
                        .call(d3.axisBottom(xScale));

                    g.append('g')
                        .call(d3.axisLeft(yScale));

                    // Add axis labels
                    g.append('text')
                        .attr('x', width / 2)
                        .attr('y', height + margin.bottom - 30)
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

                    // Add dots
                    var dots = g.selectAll('.dot')
                        .data(validData)
                        .enter()
                        .append('circle')
                        .attr('class', 'dot')
                        .attr('cx', d => xScale(+d['Capacity']))
                        .attr('cy', d => yScale(+d['Commitment']))
                        .attr('r', 5)
                        .attr('fill', d => d.country === countryName ? 'rgb(0, 0, 139)' : (selectedCountries.has(d.country) ? 'rgb(128, 0, 0)' : 'lightgrey'))
                        .attr('opacity', d => d.country === countryName || selectedCountries.has(d.country) ? 1 : 0.7)
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
                            if (selectedCountries.has(d.country)) {
                                // Dehighlight the country if already selected
                                dehighlightCountryOnMap(d.country);
                                d3.select(this).attr('fill', 'lightgrey').attr('opacity', 0.7);
                            } else {
                                // Highlight the country if not already selected
                                selectedCountries.add(d.country);
                                highlightCountryOnMap(d.country);
                                d3.select(this).attr('fill', 'rgb(128, 0, 0)').attr('opacity', 1);
                            }
                        });

                    // Add lasso selection functionality
                    var isLassoing = false;
                    var lassoStart = null;
                    var lassoEnd = null;

                    svg.on('mousedown', function(event) {
                        isLassoing = true;
                        lassoStart = d3.pointer(event);
                        lassoEnd = null;

                        // Add a temporary lasso rectangle
                        svg.selectAll('.lasso-rect').remove();
                        svg.append('rect')
                            .attr('class', 'lasso-rect')
                            .attr('x', lassoStart[0])
                            .attr('y', lassoStart[1])
                            .attr('width', 0)
                            .attr('height', 0)
                            .attr('fill', 'rgba(0, 0, 255, 0.2)')
                            .attr('stroke', 'blue')
                            .attr('stroke-width', 1);
                    });

                    svg.on('mousemove', function(event) {
                        if (isLassoing) {
                            lassoEnd = d3.pointer(event);

                            // Update the lasso rectangle
                            svg.select('.lasso-rect')
                                .attr('x', Math.min(lassoStart[0], lassoEnd[0]))
                                .attr('y', Math.min(lassoStart[1], lassoEnd[1]))
                                .attr('width', Math.abs(lassoEnd[0] - lassoStart[0]))
                                .attr('height', Math.abs(lassoEnd[1] - lassoStart[1]));
                        }
                    });

                    svg.on('mouseup', function() {
                        if (isLassoing) {
                            isLassoing = false;

                            // Remove the lasso rectangle
                            svg.selectAll('.lasso-rect').remove();

                            // Highlight selected dots
                            if (lassoStart && lassoEnd) {
                                var xMin = Math.min(lassoStart[0], lassoEnd[0]) - margin.left;
                                var xMax = Math.max(lassoStart[0], lassoEnd[0]) - margin.left;
                                var yMin = Math.min(lassoStart[1], lassoEnd[1]) - margin.top;
                                var yMax = Math.max(lassoStart[1], lassoEnd[1]) - margin.top;

                                var selectedDots = dots.filter(function(d) {
                                    var x = xScale(+d['Capacity']);
                                    var y = yScale(+d['Commitment']);
                                    return x >= xMin && x <= xMax && y >= yMin && y <= yMax;
                                });

                                selectedDots.each(function(d) {
                                    if (!selectedCountries.has(d.country)) {
                                        selectedCountries.add(d.country);
                                        highlightCountryOnMap(d.country);
                                        d3.select(this).attr('fill', 'rgb(128, 0, 0)').attr('opacity', 1);
                                    }
                                });
                            }
                        }
                    });
                }

                // Modify the map click handler to ensure the information panel updates correctly
                geojsonLayer.eachLayer(function(layer) {
                    layer.on('click', function(e) {
                        var countryName = layer.feature.properties.WP_Name;
                        var countryData = data.find(d => d.country === countryName);

                        // Ensure the information panel is initialized before updating
                        if (!document.getElementById('info-window')) {
                            createInfoWindow();
                        }

                        // Ensure the information panel is visible before updating its content
                        var infoWindow = document.getElementById('info-window');
                        infoWindow.style.display = 'block';

                        // Update the information panel with the selected country's data
                        updateInfoWindow(countryName, countryData, data);

                        // Highlight the selected country on the map
                        selectedCountries.add(countryName);
                        highlightCountryOnMap(countryName);
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
});