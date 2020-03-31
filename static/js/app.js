(() => {
  'mode strict'

  let data = 'config.json'

  let methods = {
    format(field, format) {
      switch(format) {
        case 'age':
          field = new Date(...field.split('/').map(Number).reverse())
          today = new Date()
          return Math.floor(Math.ceil(Math.abs(field.getTime() - today.getTime()) / (1000 * 3600 * 24)) / 365.25)
          break;
      }
    },

    getData() {
      return new Promise((resolve, reject) => {
        Papa.parse(data.report, {
          downloadRequestHeaders: {
            Origin: location.origin
          },
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: function(result) {
            resolve(result.data)
          }
        })
      })
    },

    getFile(el, title) {
      var link = null,
        proxy = document.createElement('a')
      date_prefix = new Date().toLocaleString().match(/\d+/g).join('')

      fetch(data.report, {
        headers: new Headers({
          Origin: location.origin
        }),
        cors: true
      }).then(function(response) {
        return response.blob()
      }).then(function(blob) {
        if (link) URL.revokeObjectURL(link)
        link = URL.createObjectURL(blob)
        proxy.href = link
        proxy.download = `${title}_${date_prefix}.csv`
        proxy.click()
      })
    },

    plotData(sheet, map) {
      return new Promise((resolve, reject) => {
        let results = document.getElementById('results'),
          tables = {}
        data.tables.forEach(e => {
          let table = document.createElement('table')
          table.innerHTML = `
            <thead>
              <tr>
                <th>${e.title_field}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
            ${e.items.map(i => `
            <tr>
              ${i.color ?
                  `<th class="${i.color}">${i.value}</th>` :
                  `<th><i class="fas ${i.icon} blue"></i> ${i.value}</th>`}
              <td id="${i.value}"></td>
            </tr>
            `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <td id="total"></td>
              </tr>
            </tfoot>`
          table = results.appendChild(table)
          tables[e.title_field] = table
        })

        sheet.forEach(row => {
          let marker_icon = data,
            marker_color = data,
            popup = data.popup,
            popup_template = `
              <p class="caption">
                <i class="fas ${popup.title_icon} ${popup.title_color}"></i>
                  ${row[data.popup.title_field]}
              </p>
              ${popup.content.map(e => {
                if (e.hasOwnProperty('format')) {
                  row[e.data_field] = methods.format(row[e.data_field], e.format)
                }
                return `<span>
                  <i class="fas ${e.icon} ${e.color}"></i>
                   <strong>${e.title}</strong>: ${row[e.data_field]}
                </span><br>`
              }).join('')}`

          data.marker.icon.forEach(e => marker_icon = marker_icon[e])
          data.marker.color.forEach(e => marker_color = marker_color[e])
          marker_icon = marker_icon.items.filter(e => {
            if (row[marker_icon.title_field] == e.value) {
              let value = tables[marker_icon.title_field].querySelector(`#${e.value}`),
                total = tables[marker_icon.title_field].querySelector('#total')
              value.textContent = (Number(value.textContent) || 0) + 1
              total.textContent = (Number(total.textContent) || 0) + 1
              return true
            }
          }).pop().icon || 'fa-number'

          marker_color = marker_color.items.filter(e => {
            if (row[marker_color.title_field] == e.value) {
              let value = tables[marker_color.title_field].querySelector(`#${e.value}`),
                total = tables[marker_color.title_field].querySelector('#total')
              value.textContent = (Number(value.textContent) || 0) + 1
              total.textContent = (Number(total.textContent) || 0) + 1
              return true
            }
          }).pop().color || 'black'

          L.esri.Geocoding.geocode()
            .text(row[data.marker.location_field])
            .run((err, results, response) => {
              if (err) {
                return
              } else {
                let icon = L.ExtraMarkers.icon({
                  icon: marker_icon,
                  markerColor: marker_color,
                  prefix: 'fas'
                })
                if (marker_color !== 'black') {
                  L.marker(results.results[0].latlng, {icon: icon}).addTo(map)
                    .bindPopup(popup_template)
                    .on('mouseover', function(e) {
                      this.openPopup()
                    })
                    .on('click', function(e) {
                      map.flyTo(results.results[0].latlng, 18)
                      this.openPopup()
                    })
                }
              }
            })
        })
        resolve(true)
      })
    },

    setBoundries(map) {
      fetch('static/js/city.geojson')
        .then(response => response.json())
        .then(data => {
          let geojson = L.geoJSON(data, {style: data.style}).addTo(map);
          map.fitBounds(geojson.getBounds());
        })
    },

    init(scope) {
      let self = this,
        map = L.map('map'),
        tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '<a href="https://www.esri.com/">ESRI</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
          tileSize: 512,
          zoomOffset: -1
        }).addTo(map)

      fetch(data)
        .then(response => response.json())
        .then(json => {
          Object.keys(methods).forEach(m => scope[m] = self[m])
          data = json
          getData()
            .then(sheet => plotData(sheet, map))
            .then(success => {
              setBoundries(map)
            })
        })
    }
  }

  return methods.init(this)
}).call((this))
