(() => {
  "mode strict";

  let data = "config.json";

  const methods = {
    collapse(elm, cmd) {
      const selector = elm.getAttribute("data-target"),
        fnmap = {
          toggle: "toggle",
          show: "add",
          hide: "remove",
        };

      const collapser = (selector, cmd) => {
        const targets = Array.from(document.querySelectorAll(selector));
        targets.forEach((target) => {
          target.classList[fnmap[cmd]]("show");
        });
      };
      collapser(selector, cmd);
    },

    createMap() {
      if (data.hasOwnProperty("map")) data.map.remove();
      const map = L.map("map"),
        tile = L.tileLayer(
          "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.esri.com/">ESRI</a>, &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          }
        ).addTo(map);
      map.addControl(new L.Control.Fullscreen());
      return map;
    },

    format(item, format) {
      switch (format) {
        case "age":
          item = new Date(...item.split("/").map(Number).reverse());
          today = new Date();
          return Math.floor(
            Math.ceil(
              Math.abs(item.getTime() - today.getTime()) / (1000 * 3600 * 24)
            ) / 365.25
          );
          break;
      }
    },

    getData(filter) {
      return new Promise((resolve, reject) => {
        Papa.parse(data.report, {
          downloadRequestHeaders: {
            Origin: location.origin,
          },
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function (result) {
            result = result.data;
            if (filter) {
              result = result.filter((row) => {
                return Object.keys(filter).every((column) => {
                  var criteria = filter[column].toLowerCase();
                  return (
                    String(row[column]).toLowerCase().indexOf(criteria) > -1
                  );
                });
              });
            }
            resolve(result);
          },
        });
      });
    },

    renderFilters() {
      let filters = document.getElementById("filters"),
        template = "";
      data.filters.forEach((filter) => {
        let id = Object.keys(filter).pop(),
          type = filter[id];
        template += `
        <div class="column column-1 form-group">
          <label for="${id}">${id}</label>
          ${
            !(type instanceof Array)
              ? `<input id="${id}" type="text" name="${id}">`
              : `<select id="${id}" name="${id}">
          <option value selected></option>
          ${type
            .map((item) => `<option value="${item}">${item}</option>`)
            .join("")}
          </select>`
          }
        </div>`;
      });
      filters.innerHTML = template;
    },

    renderLayers(markers, heatpoints) {
      let overlay = {};
      overlay[data.markers_layer] = markers;
      overlay[data.heat_layer] = L.heatLayer(heatpoints, {
        radius: 40,
        minOpacity: 0.5,
        maxZoom: 14
      });
      data.map.addLayer(overlay[data.markers_layer]);
      data.map.addLayer(overlay[data.heat_layer]);
      L.control.layers(null, overlay).addTo(data.map);
    },

    renderTables() {
      let tables = {};
      data.tables.forEach((e) => {
        let table = document.createElement("table");
        table.innerHTML = `
            <thead>
              <tr>
                <th>${e.title_field}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
            ${e.items
              .map(
                (i) => `
            <tr>
              ${
                i.color
                  ? `<th class="${i.color}">${i.value}</th>`
                  : `<th><i class="fas ${i.icon} blue"></i> ${i.value}</th>`
              }
              <td id="${i.value}"></td>
            </tr>
          `
              )
              .join("")}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td id="total"></td>
              </tr>
            </tfoot>`;
        table = results.appendChild(table);
        tables[e.title_field] = table;
      });
      return tables;
    },

    plotData(sheet, filters) {
      return new Promise((resolve, reject) => {
        let results = document.getElementById("results"),
          count = document.getElementById("count"),
          tables = !filters && methods.renderTables(),
          markers = L.layerGroup(),
          heatpoints = [];

        count.textContent = sheet.length;
        sheet.forEach((row) => {
          let marker_icon = data,
            marker_color = data,
            popup = data.popup,
            popup_template = `${
              data.popup.title_field &&
              `
              <p class="caption">
                <i class="fas ${popup.title_icon} ${popup.title_color}"></i>
                ${row[data.popup.title_field]}
              </p>
            `
            }
            ${popup.content
              .map((e) => {
                if (e.hasOwnProperty("format")) {
                  row[e.data_field] = methods.format(
                    row[e.data_field],
                    e.format
                  );
                }
                return `
              <span>
                <i class="fas ${e.icon} ${e.color}"></i>
                <strong>${e.title}</strong>: ${row[e.data_field]}
              </span><br>
              `;
              })
              .join("")}`;

          data.marker.icon.forEach((e) => (marker_icon = marker_icon[e]));
          data.marker.color.forEach((e) => (marker_color = marker_color[e]));
          marker_icon = marker_icon.items.filter((e) => {
            if (row[marker_icon.title_field] == e.value) {
              if (tables) {
                let value = tables[marker_icon.title_field].querySelector(
                    `#${e.value}`
                  ),
                  total = tables[marker_icon.title_field].querySelector(
                    "#total"
                  );
                value.textContent = (Number(value.textContent) || 0) + 1;
                total.textContent = (Number(total.textContent) || 0) + 1;
              }
              return true;
            }
            return false;
          });
          marker_icon = marker_icon.length
            ? marker_icon.pop().icon
            : "fa-number";

          marker_color = marker_color.items.filter((e) => {
            if (row[marker_color.title_field] == e.value) {
              if (tables) {
                let value = tables[marker_color.title_field].querySelector(
                    `#${e.value}`
                  ),
                  total = tables[marker_color.title_field].querySelector(
                    "#total"
                  );
                value.textContent = (Number(value.textContent) || 0) + 1;
                total.textContent = (Number(total.textContent) || 0) + 1;
              }
              return true;
            }
            return false;
          });
          marker_color = marker_color.length
            ? marker_color.pop()
            : { color: "black", weight: 0 };

          L.esri.Geocoding.geocode()
            .text(row[data.marker.location_field])
            .run((err, results, response) => {
              if (err) {
                return;
              } else {
                let icon = L.ExtraMarkers.icon({
                  icon: marker_icon,
                  markerColor: marker_color.color,
                  prefix: "fas",
                });
                if (marker_color.color !== "black") {
                  heatpoints.push([
                    results.results[0].latlng.lat,
                    results.results[0].latlng.lng,
                    marker_color.weight,
                  ]);
                  L.marker(results.results[0].latlng, { icon: icon })
                    .addTo(markers)
                    .bindPopup(popup_template)
                    .on("mouseover", function (e) {
                      this.openPopup();
                    })
                    .on("click", function (e) {
                      data.map.flyTo(results.results[0].latlng, 18);
                      this.openPopup();
                    });
                }
              }
            });
        });
        renderLayers(markers, heatpoints);
        resolve(true);
      });
    },

    setBoundries() {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      const params = new URLSearchParams(
        "limit=1&format=geojson&polygon_geojson=1"
      );
      Object.keys(data.boundries).forEach((d) =>
        params.append(d, data.boundries[d])
      );
      url.search = params;
      fetch(url.toString())
        .then((response) => response.json())
        .then((json) => {
          let geojson = L.geoJSON(json, { style: data.boundries_style }).addTo(
            data.map
          );
          data.map.fitBounds(geojson.getBounds());
        });
    },

    projectData(filters) {
      data["map"] = createMap();
      getData(filters)
        .then((sheet) => plotData(sheet, filters))
        .then((success) => {
          setBoundries();
        });
    },

    filterData(form) {
      let filters = {};
      form = new FormData(form);
      Array.from(form.entries()).forEach((e) => {
        if (e[1]) filters[e[0]] = e[1];
      });
      projectData(filters);
    },

    init(scope) {
      let self = this;
      fetch(data)
        .then((response) => response.json())
        .then((json) => {
          Object.keys(methods).forEach((m) => (scope[m] = self[m]));
          data = json;
          projectData();
          renderFilters();
        });
    },
  };
  return methods.init(this);
}).call(this);
