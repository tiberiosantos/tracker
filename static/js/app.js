(() => {
  'mode strict'

  let data = {
    download: document.getElementById('download').dataset.href,
    layers: {
      Leve: {
        text: 'milds',
        icon: 'fa-head-side-mask',
        color: 'blue',
        layer: L.layerGroup()
      },
      Grave: {
        text: 'serious',
        icon: 'fa-procedures',
        color: 'orange',
        layer: L.layerGroup()
      },
      Recuperado: {
        text: 'recoveries',
        icon: 'fa-male',
        color: 'green',
        layer: L.layerGroup()
      },
      Fatalidade: {
        text: 'fatalities',
        icon: 'fa-book-medical',
        color: 'red',
        layer: L.layerGroup()
      }
    },
    style: {
      color: '#8395a7',
      weight: 5,
      opacity: 0.65
    }
  }

  let methods = {
    getData() {
      return new Promise((resolve, reject) => {
        Papa.parse(data.download, {
          downloadRequestHeaders: {
            'Origin': location.origin
          },
          download: true,
          header: true,
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

      fetch(el.dataset.href, {
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
    getLayers() {
      let layers = {}
      Object.keys(data.layers).forEach(e => {
        layers[e] = data.layers[e].layer
      })
      return layers
    },
    setMarkersLayer(sheet) {
      return new Promise((resolve, reject) => {
        sheet.forEach(row => {
          L.esri.Geocoding.geocode()
            .text(row.ENDEREÇO)
            .run((err, results, response) => {
              if (err) {
                return
              } else {
                let icon = L.ExtraMarkers.icon({
                  icon: data.layers[row.CASO].icon || 'fa-number',
                  markerColor: data.layers[row.CASO].color || 'black',
                  prefix: 'fas'
                }),
                  marker = L.marker(results.results[0].latlng, {icon: icon})
                  .bindPopup(`<p class="caption"><i class="fas fa-user green"></i> ${row.PACIENTE}</p>
                    <span><i class="fas fa-award blue"></i> <strong>Idade</strong>: ${row.IDADE}</span><br>
                    <span><i class="fas fa-map-marker-alt blue"></i> <strong>Endereço</strong>: ${results.results[0].text}</span><br>
                    <span><i class="fas fa-medkit blue"></i> <strong>Caso</strong>: ${row.CASO}</span><br>
                    <span><i class="fas fa-stethoscope blue"></i> <strong>Situação</strong>: ${row.SITUAÇÃO}</span>
                  `)
                  .on('mouseover', function(e) {
                    this.openPopup()
                  });
                if (icon.options.markerColor !== 'black') {
                  marker.addTo(data.layers[row.CASO].layer)
                }
              }
            })
            let sel = document.getElementById(data.layers[row.CASO].text);
            sel.textContent = (Number(sel.textContent) || 0) + 1;
          })
        resolve(true)
      })
    },
    setBoundries(map) {
      fetch('static/js/city.geojson')
        .then(function(response) {
          return response.json()
        })
        .then(function(data) {
          let geojson = L.geoJSON(data, {style: data.style}).addTo(map);
          map.fitBounds(geojson.getBounds());
        })
    },
    init(scope) {
      Object.keys(methods).forEach(m => scope[m] = this[m])
      getData()
        .then(data => setMarkersLayer(data))
        .then(ok => {
          if (ok) {
            let tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '<a href="https://www.esri.com/">ESRI</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }),
              layers = getLayers(),
              map = L.map('map', {
                layers: [tile].concat(Object.values(layers))
              })
            setBoundries(map)
            L.control.layers({Topografia: tile}, layers).addTo(map);
          }
        })
    }
  }
  return methods.init(this)
}).call((this))
