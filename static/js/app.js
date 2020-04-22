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
          "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.esri.com/">ESRI</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20,
          }
        ).addTo(map);
      map.addControl(new L.Control.Fullscreen());
      return map;
    },

    filterData(form) {
      let filters = {};
      form = new FormData(form);
      Array.from(form.entries()).forEach((e) => {
        if (e[1]) filters[e[0]] = e[1];
      });
      projectData(filters);
      return false;
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

    getLatLng(address) {
      const url = new URL(
        "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
      );
      const params = new URLSearchParams(
        "?outSr=4326&forStorage=false&outFields=*&maxLocations=20&f=json"
      );
      params.append("singleLine", address);
      url.search = params;
      return fetch(url.toString())
        .then((response) => response.json())
        .then((json) => {
          return {
            lat: json.candidates[0].location.y,
            lng: json.candidates[0].location.x,
          };
        });
    },

    init() {
      fetch(data)
        .then((response) => response.json())
        .then((json) => {
          data = json;
          projectData();
          renderFilters();
        });
    },

    projectData(filters, options) {
      options && collapse(options, "toggle");
      getData(filters).then((result) => renderData(result));
    },

    renderData(result) {
      return new Promise((resolve, reject) => {
        let count = document.getElementById("count"),
          tables = renderTables(),
          markers = L.layerGroup(),
          [marker_icon, marker_color] = [data, data],
          heatpoints = [];
        count.textContent = data.length;
        data.map = createMap();
        data.marker.icon.forEach((e) => (marker_icon = marker_icon[e]));
        data.marker.color.forEach((e) => (marker_color = marker_color[e]));
        result.forEach((bulk) => {
          renderMarker(bulk, marker_icon, marker_color, tables)
            .then((pointer) => {
              pointer.marker.addTo(markers);
              heatpoints.push([pointer.lat, pointer.lng, pointer.weight]);
            });
        });
        renderLayers(markers, heatpoints);
        setBoundries();
        resolve(true);
      });
    },

    renderFilters() {
      let filters = document.getElementById("filters"),
        template = "";
      data.filters.forEach((filter) => {
        let id = Object.keys(filter).pop(),
          type = filter[id];
        template += `<div class="column column-1 form-group">
          <label for="${id}">${id}</label>`;
        if (type instanceof Array) {
          template += `<select id="${id}" name="${id}">
            <option value selected></option>`;
          type.forEach(
            (item) => (template += `<option value="${item}">${item}</option>`)
          );
          template += "</select>";
        } else {
          template += `<input id="${id}" type="text" name="${id}">`;
        }
        template += "</div>";
      });
      filters.innerHTML = template;
    },

    renderLayers(markers, heatpoints) {
      let overlay = {};
      overlay[data.markers_layer] = markers;
      overlay[data.heat_layer] = L.heatLayer(heatpoints, {
        radius: 40,
        minOpacity: 0.5,
        maxZoom: 14,
      });
      data.map.addLayer(overlay[data.markers_layer]);
      data.map.addLayer(overlay[data.heat_layer]);
      L.control.layers(null, overlay).addTo(data.map);
    },

    renderPopup(bulk) {
      let template = "";
      if (data.popup.title_field) {
        template += `<p class="caption">
          <i class="fas ${data.popup.title_icon} ${data.popup.title_color}"></i>
          ${bulk[data.popup.title_field]}
        </p>`;
      }
      data.popup.content.forEach((item) => {
        if (item.hasOwnProperty("format")) {
          bulk[item.data_field] = methods.format(
            bulk[item.data_field],
            item.format
          );
        }
        template += `<span>
          <i class="fas ${item.icon} ${item.color}"></i>
          <strong>${item.title}</strong>: ${bulk[item.data_field]}
        </span><br>`;
      });
      return template;
    },

    renderMarker(bulk, marker_icon, marker_color, tables) {
      let popup = renderPopup(bulk),
        icon = marker_icon.items.filter(
          (i) =>
            bulk[marker_icon.title_field] == i.value &&
            updateResult(tables, marker_icon.title_field, i.value)
        ),
        color = marker_color.items.filter(
          (c) =>
            bulk[marker_color.title_field] == c.value &&
            updateResult(tables, marker_color.title_field, c.value)
        );
      icon = icon.length ? icon.pop().icon : false;
      color = color.length ? color.pop() : false;
      if (!icon || !color) return;
      return getLatLng(bulk[data.marker.location_field])
        .then((latlng) => {
          const marker = L.marker(latlng, {
            icon: L.ExtraMarkers.icon({
              icon: icon,
              markerColor: color.color,
              prefix: "fas",
            }),
          })
            .bindPopup(popup)
            .on("mouseover", function (e) {
              this.openPopup();
            })
            .on("click", function (e) {
              data.map.flyTo(latlng, 18);
              this.openPopup();
            });
          return {
            lat: latlng.lat,
            lng: latlng.lng,
            marker: marker,
            weight: color.weight,
          };
        })
        .catch((error) => error);
    },

    renderTables() {
      let results = document.getElementById("results"),
        tables = {};
      results.innerHTML = "";
      data.tables.forEach((e) => {
        let table = document.createElement("table"),
          template = "";
        template += `<thead>
          <tr>
            <th>${e.title_field}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>`;
        e.items.forEach((i) => {
          if (i.color) {
            template += `<tr>
              <th class="${i.color}">${i.value}</th>`;
          } else {
            template += `<tr>
              <th><i class="fas ${i.icon} blue"></i> ${i.value}</th>`;
          }
          template += `<td id="${i.value}"></td></tr>`;
        });
        template += `</tbody>
          <tfoot>
            <tr>
              <th>TOTAL</th>
              <th id="total"></th>
            </tr>
          </tfoot>`;
        table.innerHTML = template;
        table = results.appendChild(table);
        tables[e.title_field] = table;
      });
      return tables;
    },

    updateResult(tables, item, value) {
      if (tables) {
        ["#total", `#${value}`].forEach((el) => {
          el = tables[item].querySelector(el);
          el.textContent = (Number(el.textContent) || 0) + 1;
        });
      }
      return true;
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
  };
  Object.assign(window, methods);
  init();
})();
